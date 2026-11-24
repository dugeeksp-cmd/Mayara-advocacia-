import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type {
  ChangelogChecklistState,
  ClientRecord,
  DocumentTemplate,
  FooterProfile,
  HeaderProfile,
  LetterheadSettings,
  LogoAsset,
  ServiceLink,
  ServiceLinkStatus,
  SignatureConfigSettings,
  SignatureMethod,
} from '../types/legal';
import {
  extractLast4Digits,
  generateSecureToken,
  sha256Hex,
} from '../utils/masksAndFormatters';
import {
  DEFAULT_LETTERHEAD,
  DEFAULT_SIGNATURE_CONFIG,
  DEFAULT_TEMPLATES,
} from '../utils/templateEngine';
import {
  DEFAULT_BODY_FONT_PX,
  DEFAULT_FOOTERS,
  DEFAULT_HEADERS,
  DEFAULT_LOGOS,
  OFFICE_SCOPE_ID,
  pxToLegacyTextSize,
  resolveFooterFontSizePx,
  resolveHeaderFontSizePx,
  resolveHeaderLogoSizePx,
  resolveTemplateBodyFontSizePx,
} from '../utils/timbradoTheme';
import { findClientByCpf as findClientByCpfInList } from '../utils/legalFieldOptions';
import {
  applyBatchAssetToTemplateList,
  type BatchAssetType,
} from '../utils/headerLayout';
import { auth, db, storage } from './firebaseConfig';

export type PersistenceMode = 'firebase' | 'local';
export type CloudSyncState = 'cloud' | 'fallback';

export interface CreateLinkInput {
  clientId?: string | null;
  clientName: string;
  whatsapp: string;
  templateId: string;
  templateTitle: string;
}

export interface UpdateLinkStatusInput {
  status: ServiceLinkStatus;
  signatureMethod?: SignatureMethod;
  signatureEnvelopeId?: string | null;
  signatureAuditHash?: string | null;
  signedPdfUrl?: string | null;
  signedPdfStoragePath?: string | null;
  signedPdfName?: string | null;
}

export interface UploadSignedPdfResult {
  url: string;
  storagePath: string | null;
  fileName: string;
}

export type SaveHeaderInput = Omit<HeaderProfile, 'officeId' | 'createdAt' | 'updatedAt' | 'updatedBy'> & {
  createdAt?: string;
};
export type SaveFooterInput = Omit<FooterProfile, 'officeId' | 'createdAt' | 'updatedAt' | 'updatedBy'> & {
  createdAt?: string;
};
export type SaveLogoInput = Omit<LogoAsset, 'officeId' | 'createdAt' | 'updatedAt' | 'updatedBy'> & {
  createdAt?: string;
};
export type SaveTemplateInput = Omit<
  DocumentTemplate,
  'ownerUid' | 'officeId' | 'createdAt' | 'updatedAt'
> & {
  createdAt?: string;
};
export type SaveClientInput = Omit<
  ClientRecord,
  'officeId' | 'createdAt' | 'updatedAt' | 'updatedBy'
> & {
  createdAt?: string;
};

// ---------------------------------------------------------------------------
// Master Password Hash (SHA-256 of default "Mayara@229359") — Zero plaintext
// ---------------------------------------------------------------------------
const DEFAULT_MASTER_HASH = 'cef9def5b60276e010d8f3cc53a106dd23a1894ffcf3160ba46d11ef45a6497a';
const MASTER_HASH_STORAGE_KEY = 'mm_adv_master_hash_v1';

export async function verifyMasterPassword(password: string): Promise<boolean> {
  const inputHash = await sha256Hex(password.trim());
  const storedHash =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(MASTER_HASH_STORAGE_KEY) || DEFAULT_MASTER_HASH
      : DEFAULT_MASTER_HASH;
  return inputHash === storedHash;
}

export async function updateMasterPassword(newPassword: string): Promise<void> {
  const newHash = await sha256Hex(newPassword.trim());
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MASTER_HASH_STORAGE_KEY, newHash);
  }
}

// ---------------------------------------------------------------------------
// Local Fallback Cache Keys (Zero-Retention LGPD: non-PII metadata only!)
// ---------------------------------------------------------------------------
const CACHE_KEYS = {
  headers: 'mm_adv_cache_headers_v2',
  footers: 'mm_adv_cache_footers_v2',
  logos: 'mm_adv_cache_logos_v2',
  templates: 'mm_adv_cache_templates_v2',
  links: 'mm_adv_cache_atendimentos_v2',
  clients: 'mm_adv_cache_clients_v2',
  letterhead: 'mm_adv_cache_letterhead_v2',
  signatureConfig: 'mm_adv_cache_sig_config_v2',
  changelog: 'mm_adv_cache_changelog_v2',
};

export const DEMO_SERVICE_LINK: ServiceLink = {
  tokenId: 'mm_demo_pendente_01',
  clientName: 'Mariana Costa Oliveira',
  whatsapp: '(22) 99812-4321',
  pin: '4321',
  templateId: 'procuracao-ad-judicia',
  templateTitle: 'Procuração Ad Judicia',
  status: 'pendente',
  signatureMethod: 'none',
  officeId: OFFICE_SCOPE_ID,
  ownerUid: 'office_admin',
  createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  completedAt: null,
};

function readCache<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota issues in restricted browsers
  }
}

function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (
    typeof val === 'object' &&
    val !== null &&
    'toDate' in val &&
    typeof (val as { toDate: () => Date }).toDate === 'function'
  ) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Falha ao ler arquivo PDF.'));
    };
    reader.onerror = () => reject(new Error('Erro na leitura do arquivo PDF.'));
    reader.readAsDataURL(blob);
  });
}

function actorId(): string {
  return auth.currentUser?.uid || 'office_admin';
}

// ---------------------------------------------------------------------------
// Sync State Broadcaster
// ---------------------------------------------------------------------------
let currentSyncState: CloudSyncState = 'cloud';
let currentMode: PersistenceMode = 'firebase';
const syncListeners = new Set<(state: CloudSyncState) => void>();
const localLinkListeners = new Set<(links: ServiceLink[]) => void>();
const localHeaderListeners = new Set<(items: HeaderProfile[]) => void>();
const localFooterListeners = new Set<(items: FooterProfile[]) => void>();
const localLogoListeners = new Set<(items: LogoAsset[]) => void>();
const localTemplateListeners = new Set<(items: DocumentTemplate[]) => void>();
const localClientListeners = new Set<(items: ClientRecord[]) => void>();

function setSyncState(next: CloudSyncState) {
  if (currentSyncState !== next) {
    currentSyncState = next;
    for (const cb of syncListeners) cb(next);
  }
}

export function getCloudSyncState(): CloudSyncState {
  return currentSyncState;
}

export function subscribeToSyncState(cb: (state: CloudSyncState) => void): Unsubscribe {
  cb(currentSyncState);
  syncListeners.add(cb);
  return () => syncListeners.delete(cb);
}

export function setPersistenceMode(mode: PersistenceMode): void {
  currentMode = mode;
}

export function getPersistenceMode(): PersistenceMode {
  return currentMode;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------
function mapHeaderDoc(data: Record<string, unknown>): HeaderProfile {
  const alignment = (data.alignment as HeaderProfile['alignment']) || 'center';
  const legacyTextSize = data.textSize as HeaderProfile['textSize'] | undefined;
  const rawFontPx = typeof data.fontSizePx === 'number' ? data.fontSizePx : undefined;
  const rawLogoPx = typeof data.logoSizePx === 'number' ? data.logoSizePx : undefined;
  const fontSizePx = resolveHeaderFontSizePx({ fontSizePx: rawFontPx, textSize: legacyTextSize });
  const logoSizePx = resolveHeaderLogoSizePx({ logoSizePx: rawLogoPx });
  return {
    id: String(data.id),
    name: String(data.name || 'Cabeçalho'),
    officeTitle: String(data.officeTitle || DEFAULT_LETTERHEAD.officeTitle),
    oabNumber: String(data.oabNumber || DEFAULT_LETTERHEAD.oabNumber),
    subtitle: typeof data.subtitle === 'string' ? data.subtitle : '',
    alignment,
    logoPosition: (data.logoPosition as HeaderProfile['logoPosition']) || alignment || 'center',
    textPosition: (data.textPosition as HeaderProfile['textPosition']) || 'below',
    fontFamily: (data.fontFamily as HeaderProfile['fontFamily']) || 'playfair',
    textSize: legacyTextSize || pxToLegacyTextSize(fontSizePx),
    fontSizePx,
    logoSizePx,
    textColor: typeof data.textColor === 'string' ? data.textColor : '#0B1D3A',
    isDefault: Boolean(data.isDefault),
    officeId: typeof data.officeId === 'string' ? data.officeId : OFFICE_SCOPE_ID,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : 'office_admin',
  };
}

function mapFooterDoc(data: Record<string, unknown>): FooterProfile {
  const legacyTextSize = data.textSize as FooterProfile['textSize'] | undefined;
  const rawFontPx = typeof data.fontSizePx === 'number' ? data.fontSizePx : undefined;
  const fontSizePx = resolveFooterFontSizePx({ fontSizePx: rawFontPx, textSize: legacyTextSize });
  return {
    id: String(data.id),
    name: String(data.name || 'Rodapé'),
    addressFooter: String(data.addressFooter || DEFAULT_LETTERHEAD.addressFooter),
    phone: String(data.phone || DEFAULT_LETTERHEAD.phone),
    email: String(data.email || DEFAULT_LETTERHEAD.email),
    instagram: typeof data.instagram === 'string' ? data.instagram : '',
    website: typeof data.website === 'string' ? data.website : '',
    alignment: (data.alignment as FooterProfile['alignment']) || 'center',
    fontFamily: (data.fontFamily as FooterProfile['fontFamily']) || 'inter',
    textSize: legacyTextSize || pxToLegacyTextSize(fontSizePx),
    fontSizePx,
    textColor: typeof data.textColor === 'string' ? data.textColor : '#475569',
    isDefault: Boolean(data.isDefault),
    officeId: typeof data.officeId === 'string' ? data.officeId : OFFICE_SCOPE_ID,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : 'office_admin',
  };
}

function mapLogoDoc(data: Record<string, unknown>): LogoAsset {
  return {
    id: String(data.id),
    name: String(data.name || 'Logotipo'),
    formatLabel: typeof data.formatLabel === 'string' ? data.formatLabel : '',
    dataUrl: String(data.dataUrl || ''),
    isDefault: Boolean(data.isDefault),
    officeId: typeof data.officeId === 'string' ? data.officeId : OFFICE_SCOPE_ID,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : 'office_admin',
  };
}

function mapTemplateDoc(data: Record<string, unknown>): DocumentTemplate {
  const rawBodyPx = typeof data.bodyFontSizePx === 'number' ? data.bodyFontSizePx : undefined;
  return {
    id: String(data.id),
    title: String(data.title),
    category: String(data.category),
    content: String(data.content),
    bodyFontSizePx: resolveTemplateBodyFontSizePx({ bodyFontSizePx: rawBodyPx }),
    isDefault: Boolean(data.isDefault),
    customFields: Array.isArray(data.customFields) ? data.customFields : [],
    headerId:
      data.headerId === null
        ? null
        : typeof data.headerId === 'string' && data.headerId.length > 0
          ? data.headerId
          : undefined,
    footerId:
      data.footerId === null
        ? null
        : typeof data.footerId === 'string' && data.footerId.length > 0
          ? data.footerId
          : undefined,
    logoId:
      data.logoId === null
        ? null
        : typeof data.logoId === 'string' && data.logoId.length > 0
          ? data.logoId
          : undefined,
    officeId: typeof data.officeId === 'string' ? data.officeId : OFFICE_SCOPE_ID,
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : 'office_admin',
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

function mapClientDoc(data: Record<string, unknown>): ClientRecord {
  return {
    id: String(data.id),
    fullName: String(data.fullName || ''),
    cpf: typeof data.cpf === 'string' ? data.cpf : '',
    rg: typeof data.rg === 'string' ? data.rg : '',
    email: typeof data.email === 'string' ? data.email : '',
    whatsapp: String(data.whatsapp || ''),
    address: typeof data.address === 'string' ? data.address : '',
    nationality: typeof data.nationality === 'string' ? data.nationality : '',
    maritalStatus: typeof data.maritalStatus === 'string' ? data.maritalStatus : '',
    profession: typeof data.profession === 'string' ? data.profession : '',
    officeId: typeof data.officeId === 'string' ? data.officeId : OFFICE_SCOPE_ID,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : 'office_admin',
  };
}

function mapServiceLinkDoc(data: Record<string, unknown>): ServiceLink {
  return {
    tokenId: String(data.tokenId),
    clientId: typeof data.clientId === 'string' ? data.clientId : null,
    clientName: String(data.clientName),
    whatsapp: String(data.whatsapp),
    pin: String(data.pin),
    templateId: String(data.templateId),
    templateTitle: String(data.templateTitle),
    status: (data.status as ServiceLinkStatus) || 'pendente',
    signatureMethod: data.signatureMethod === 'govbr' ? 'govbr' : 'none',
    signatureEnvelopeId:
      typeof data.signatureEnvelopeId === 'string' ? data.signatureEnvelopeId : null,
    signatureAuditHash:
      typeof data.signatureAuditHash === 'string' ? data.signatureAuditHash : null,
    signedPdfUrl: typeof data.signedPdfUrl === 'string' ? data.signedPdfUrl : null,
    signedPdfStoragePath:
      typeof data.signedPdfStoragePath === 'string' ? data.signedPdfStoragePath : null,
    signedPdfName: typeof data.signedPdfName === 'string' ? data.signedPdfName : null,
    officeId: typeof data.officeId === 'string' ? data.officeId : OFFICE_SCOPE_ID,
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : 'office_admin',
    createdAt: toIsoString(data.createdAt),
    completedAt: data.completedAt ? toIsoString(data.completedAt) : null,
  };
}

function sortByCreatedDesc<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function scopedQuery(collectionName: string) {
  return query(collection(db, collectionName), where('officeId', '==', OFFICE_SCOPE_ID));
}

function notifyLocal<T>(listeners: Set<(items: T[]) => void>, items: T[]) {
  for (const cb of listeners) cb([...items]);
}

// ---------------------------------------------------------------------------
// Seed Flag (per session)
// ---------------------------------------------------------------------------
let seedPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Unified Cloud-First DataService (Firestore Real-Time + Automatic Fallback)
// ---------------------------------------------------------------------------
export const dataService = {
  async ensureSeedData(): Promise<void> {
    if (seedPromise) return seedPromise;
    seedPromise = (async () => {
      const uid = actorId();
      try {
        // 1. Headers
        const headersSnap = await getDocs(scopedQuery('headers'));
        if (headersSnap.empty) {
          for (const h of DEFAULT_HEADERS) {
            const fontSizePx = resolveHeaderFontSizePx(h);
            const logoSizePx = resolveHeaderLogoSizePx(h);
            await setDoc(doc(db, 'headers', h.id), {
              id: h.id,
              name: h.name,
              officeTitle: h.officeTitle,
              oabNumber: h.oabNumber,
              subtitle: h.subtitle || '',
              alignment: h.alignment,
              logoPosition: h.logoPosition || h.alignment || 'center',
              textPosition: h.textPosition || 'below',
              fontFamily: h.fontFamily,
              textSize: h.textSize || pxToLegacyTextSize(fontSizePx),
              fontSizePx,
              logoSizePx,
              textColor: h.textColor,
              isDefault: h.isDefault,
              officeId: OFFICE_SCOPE_ID,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              updatedBy: uid,
            });
          }
          writeCache(CACHE_KEYS.headers, DEFAULT_HEADERS);
        }

        // 2. Footers
        const footersSnap = await getDocs(scopedQuery('footers'));
        if (footersSnap.empty) {
          for (const f of DEFAULT_FOOTERS) {
            const fontSizePx = resolveFooterFontSizePx(f);
            await setDoc(doc(db, 'footers', f.id), {
              id: f.id,
              name: f.name,
              addressFooter: f.addressFooter,
              phone: f.phone,
              email: f.email,
              instagram: f.instagram || '',
              website: f.website || '',
              alignment: f.alignment,
              fontFamily: f.fontFamily,
              textSize: f.textSize || pxToLegacyTextSize(fontSizePx),
              fontSizePx,
              textColor: f.textColor,
              isDefault: f.isDefault,
              officeId: OFFICE_SCOPE_ID,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              updatedBy: uid,
            });
          }
          writeCache(CACHE_KEYS.footers, DEFAULT_FOOTERS);
        }

        // 3. Settings (letterhead + signatureConfig)
        const letterheadRef = doc(db, 'settings', 'letterhead');
        const letterheadSnap = await getDoc(letterheadRef);
        if (!letterheadSnap.exists()) {
          await setDoc(letterheadRef, {
            officeTitle: DEFAULT_LETTERHEAD.officeTitle,
            oabNumber: DEFAULT_LETTERHEAD.oabNumber,
            subtitle: DEFAULT_LETTERHEAD.subtitle ?? '',
            headerAlignment: DEFAULT_LETTERHEAD.headerAlignment ?? 'center',
            addressFooter: DEFAULT_LETTERHEAD.addressFooter,
            phone: DEFAULT_LETTERHEAD.phone,
            email: DEFAULT_LETTERHEAD.email,
            instagram: DEFAULT_LETTERHEAD.instagram ?? '',
            website: DEFAULT_LETTERHEAD.website ?? '',
            logoDataUrl: null,
            sealDataUrl: null,
            officeId: OFFICE_SCOPE_ID,
            updatedAt: serverTimestamp(),
            updatedBy: uid,
          });
        }

        const sigRef = doc(db, 'settings', 'signatureConfig');
        const sigSnap = await getDoc(sigRef);
        if (!sigSnap.exists()) {
          await setDoc(sigRef, {
            govbrEnabled: DEFAULT_SIGNATURE_CONFIG.govbrEnabled,
            govbrPortalUrl: DEFAULT_SIGNATURE_CONFIG.govbrPortalUrl,
            instructionsNote: DEFAULT_SIGNATURE_CONFIG.instructionsNote ?? '',
            requireSignedUpload: DEFAULT_SIGNATURE_CONFIG.requireSignedUpload,
            officeId: OFFICE_SCOPE_ID,
            updatedAt: serverTimestamp(),
            updatedBy: uid,
          });
        }

        // 4. Templates
        const templatesSnap = await getDocs(scopedQuery('templates'));
        if (templatesSnap.empty) {
          for (const tpl of DEFAULT_TEMPLATES) {
            await setDoc(doc(db, 'templates', tpl.id), {
              id: tpl.id,
              title: tpl.title,
              category: tpl.category,
              content: tpl.content,
              bodyFontSizePx: resolveTemplateBodyFontSizePx(tpl),
              isDefault: tpl.isDefault,
              customFields: tpl.customFields ?? [],
              headerId: 'header_principal',
              footerId: 'footer_principal',
              logoId: null,
              officeId: OFFICE_SCOPE_ID,
              ownerUid: uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          writeCache(CACHE_KEYS.templates, DEFAULT_TEMPLATES);
        }

        // 5. Demo Atendimento
        const atendimentosSnap = await getDocs(scopedQuery('atendimentos'));
        if (atendimentosSnap.empty) {
          await setDoc(doc(db, 'atendimentos', DEMO_SERVICE_LINK.tokenId), {
            tokenId: DEMO_SERVICE_LINK.tokenId,
            clientName: DEMO_SERVICE_LINK.clientName,
            whatsapp: DEMO_SERVICE_LINK.whatsapp,
            pin: DEMO_SERVICE_LINK.pin,
            templateId: DEMO_SERVICE_LINK.templateId,
            templateTitle: DEMO_SERVICE_LINK.templateTitle,
            status: 'pendente',
            signatureMethod: 'none',
            signatureEnvelopeId: null,
            signatureAuditHash: null,
            signedPdfUrl: null,
            signedPdfStoragePath: null,
            signedPdfName: null,
            officeId: OFFICE_SCOPE_ID,
            ownerUid: uid,
            createdAt: serverTimestamp(),
            completedAt: null,
          });
          writeCache(CACHE_KEYS.links, [DEMO_SERVICE_LINK]);
        }

        setSyncState('cloud');
      } catch (err) {
        console.warn('Firestore seed fallback ativo:', err);
        setSyncState('fallback');
        if (!readCache<HeaderProfile[] | null>(CACHE_KEYS.headers, null)) {
          writeCache(CACHE_KEYS.headers, DEFAULT_HEADERS);
        }
        if (!readCache<FooterProfile[] | null>(CACHE_KEYS.footers, null)) {
          writeCache(CACHE_KEYS.footers, DEFAULT_FOOTERS);
        }
        if (!readCache<DocumentTemplate[] | null>(CACHE_KEYS.templates, null)) {
          writeCache(CACHE_KEYS.templates, DEFAULT_TEMPLATES);
        }
        if (!readCache<ServiceLink[] | null>(CACHE_KEYS.links, null)) {
          writeCache(CACHE_KEYS.links, [DEMO_SERVICE_LINK]);
        }
      }
    })();

    try {
      await seedPromise;
    } finally {
      seedPromise = null;
    }
  },

  // -------------------------------------------------------------------------
  // Headers CRUD & Real-Time Subscription
  // -------------------------------------------------------------------------
  subscribeToHeaders(
    onData: (headers: HeaderProfile[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    localHeaderListeners.add(onData);
    const unsubFirestore = onSnapshot(
      scopedQuery('headers'),
      (snap) => {
        setSyncState('cloud');
        const list = snap.empty
          ? DEFAULT_HEADERS
          : snap.docs.map((d) => mapHeaderDoc(d.data() as Record<string, unknown>));
        writeCache(CACHE_KEYS.headers, list);
        onData(list);
      },
      (err) => {
        console.warn('Firestore headers listener fallback:', err);
        setSyncState('fallback');
        if (onError) onError(err);
        onData(readCache(CACHE_KEYS.headers, DEFAULT_HEADERS));
      }
    );

    return () => {
      localHeaderListeners.delete(onData);
      unsubFirestore();
    };
  },

  async getHeaders(): Promise<HeaderProfile[]> {
    try {
      const snap = await getDocs(scopedQuery('headers'));
      setSyncState('cloud');
      if (snap.empty) return readCache(CACHE_KEYS.headers, DEFAULT_HEADERS);
      const list = snap.docs.map((d) => mapHeaderDoc(d.data() as Record<string, unknown>));
      writeCache(CACHE_KEYS.headers, list);
      return list;
    } catch {
      setSyncState('fallback');
      return readCache(CACHE_KEYS.headers, DEFAULT_HEADERS);
    }
  },

  async saveHeader(input: SaveHeaderInput): Promise<HeaderProfile> {
    const uid = actorId();
    const nowIso = new Date().toISOString();
    const cached = readCache<HeaderProfile[]>(CACHE_KEYS.headers, DEFAULT_HEADERS);
    const existing = cached.find((h) => h.id === input.id);
    const fontSizePx = resolveHeaderFontSizePx(input);
    const logoSizePx = resolveHeaderLogoSizePx(input);
    const derivedTextSize = pxToLegacyTextSize(fontSizePx);
    const saved: HeaderProfile = {
      ...input,
      subtitle: input.subtitle ?? '',
      logoPosition: input.logoPosition || input.alignment || 'center',
      textPosition: input.textPosition || 'below',
      fontSizePx,
      logoSizePx,
      textSize: derivedTextSize,
      officeId: OFFICE_SCOPE_ID,
      createdAt: existing?.createdAt || input.createdAt || nowIso,
      updatedAt: nowIso,
      updatedBy: uid,
    };

    // Update local cache immediately
    let nextList = cached.some((h) => h.id === saved.id)
      ? cached.map((h) => (h.id === saved.id ? saved : h))
      : [...cached, saved];
    if (saved.isDefault) {
      nextList = nextList.map((h) => ({ ...h, isDefault: h.id === saved.id }));
    }
    writeCache(CACHE_KEYS.headers, nextList);
    notifyLocal(localHeaderListeners, nextList);

    try {
      const refDoc = doc(db, 'headers', saved.id);
      const snap = await getDoc(refDoc);
      const payload = {
        id: saved.id,
        name: saved.name.trim(),
        officeTitle: saved.officeTitle.trim(),
        oabNumber: saved.oabNumber.trim(),
        subtitle: (saved.subtitle || '').trim(),
        alignment: saved.alignment,
        logoPosition: saved.logoPosition || saved.alignment || 'center',
        textPosition: saved.textPosition || 'below',
        fontFamily: saved.fontFamily,
        textSize: derivedTextSize,
        fontSizePx,
        logoSizePx,
        textColor: saved.textColor,
        isDefault: saved.isDefault,
        officeId: OFFICE_SCOPE_ID,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      };
      if (snap.exists()) {
        await updateDoc(refDoc, payload);
      } else {
        await setDoc(refDoc, { ...payload, createdAt: serverTimestamp() });
      }
      if (saved.isDefault) {
        const allSnap = await getDocs(scopedQuery('headers'));
        await Promise.all(
          allSnap.docs
            .filter((d) => d.id !== saved.id && d.data().isDefault)
            .map((d) =>
              updateDoc(doc(db, 'headers', d.id), {
                isDefault: false,
                updatedAt: serverTimestamp(),
                updatedBy: uid,
              })
            )
        );
      }
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore saveHeader fallback:', err);
      setSyncState('fallback');
    }
    return saved;
  },

  async deleteHeader(id: string): Promise<void> {
    const cached = readCache<HeaderProfile[]>(CACHE_KEYS.headers, DEFAULT_HEADERS);
    const next = cached.filter((h) => h.id !== id);
    writeCache(CACHE_KEYS.headers, next);
    notifyLocal(localHeaderListeners, next);

    try {
      await deleteDoc(doc(db, 'headers', id));
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore deleteHeader fallback:', err);
      setSyncState('fallback');
    }
  },

  // -------------------------------------------------------------------------
  // Footers CRUD & Real-Time Subscription
  // -------------------------------------------------------------------------
  subscribeToFooters(
    onData: (footers: FooterProfile[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    localFooterListeners.add(onData);
    const unsubFirestore = onSnapshot(
      scopedQuery('footers'),
      (snap) => {
        setSyncState('cloud');
        const list = snap.empty
          ? DEFAULT_FOOTERS
          : snap.docs.map((d) => mapFooterDoc(d.data() as Record<string, unknown>));
        writeCache(CACHE_KEYS.footers, list);
        onData(list);
      },
      (err) => {
        console.warn('Firestore footers listener fallback:', err);
        setSyncState('fallback');
        if (onError) onError(err);
        onData(readCache(CACHE_KEYS.footers, DEFAULT_FOOTERS));
      }
    );

    return () => {
      localFooterListeners.delete(onData);
      unsubFirestore();
    };
  },

  async getFooters(): Promise<FooterProfile[]> {
    try {
      const snap = await getDocs(scopedQuery('footers'));
      setSyncState('cloud');
      if (snap.empty) return readCache(CACHE_KEYS.footers, DEFAULT_FOOTERS);
      const list = snap.docs.map((d) => mapFooterDoc(d.data() as Record<string, unknown>));
      writeCache(CACHE_KEYS.footers, list);
      return list;
    } catch {
      setSyncState('fallback');
      return readCache(CACHE_KEYS.footers, DEFAULT_FOOTERS);
    }
  },

  async saveFooter(input: SaveFooterInput): Promise<FooterProfile> {
    const uid = actorId();
    const nowIso = new Date().toISOString();
    const cached = readCache<FooterProfile[]>(CACHE_KEYS.footers, DEFAULT_FOOTERS);
    const existing = cached.find((f) => f.id === input.id);
    const fontSizePx = resolveFooterFontSizePx(input);
    const derivedTextSize = pxToLegacyTextSize(fontSizePx);
    const saved: FooterProfile = {
      ...input,
      instagram: input.instagram ?? '',
      website: input.website ?? '',
      fontSizePx,
      textSize: derivedTextSize,
      officeId: OFFICE_SCOPE_ID,
      createdAt: existing?.createdAt || input.createdAt || nowIso,
      updatedAt: nowIso,
      updatedBy: uid,
    };

    let nextList = cached.some((f) => f.id === saved.id)
      ? cached.map((f) => (f.id === saved.id ? saved : f))
      : [...cached, saved];
    if (saved.isDefault) {
      nextList = nextList.map((f) => ({ ...f, isDefault: f.id === saved.id }));
    }
    writeCache(CACHE_KEYS.footers, nextList);
    notifyLocal(localFooterListeners, nextList);

    try {
      const refDoc = doc(db, 'footers', saved.id);
      const snap = await getDoc(refDoc);
      const payload = {
        id: saved.id,
        name: saved.name.trim(),
        addressFooter: saved.addressFooter.trim(),
        phone: saved.phone.trim(),
        email: saved.email.trim(),
        instagram: (saved.instagram || '').trim(),
        website: (saved.website || '').trim(),
        alignment: saved.alignment,
        fontFamily: saved.fontFamily,
        textSize: derivedTextSize,
        fontSizePx,
        textColor: saved.textColor,
        isDefault: saved.isDefault,
        officeId: OFFICE_SCOPE_ID,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      };
      if (snap.exists()) {
        await updateDoc(refDoc, payload);
      } else {
        await setDoc(refDoc, { ...payload, createdAt: serverTimestamp() });
      }
      if (saved.isDefault) {
        const allSnap = await getDocs(scopedQuery('footers'));
        await Promise.all(
          allSnap.docs
            .filter((d) => d.id !== saved.id && d.data().isDefault)
            .map((d) =>
              updateDoc(doc(db, 'footers', d.id), {
                isDefault: false,
                updatedAt: serverTimestamp(),
                updatedBy: uid,
              })
            )
        );
      }
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore saveFooter fallback:', err);
      setSyncState('fallback');
    }
    return saved;
  },

  async deleteFooter(id: string): Promise<void> {
    const cached = readCache<FooterProfile[]>(CACHE_KEYS.footers, DEFAULT_FOOTERS);
    const next = cached.filter((f) => f.id !== id);
    writeCache(CACHE_KEYS.footers, next);
    notifyLocal(localFooterListeners, next);

    try {
      await deleteDoc(doc(db, 'footers', id));
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore deleteFooter fallback:', err);
      setSyncState('fallback');
    }
  },

  // -------------------------------------------------------------------------
  // Logos CRUD & Real-Time Subscription
  // -------------------------------------------------------------------------
  subscribeToLogos(
    onData: (logos: LogoAsset[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    localLogoListeners.add(onData);
    const unsubFirestore = onSnapshot(
      scopedQuery('logos'),
      (snap) => {
        setSyncState('cloud');
        const list = snap.docs.map((d) => mapLogoDoc(d.data() as Record<string, unknown>));
        writeCache(CACHE_KEYS.logos, list);
        onData(list);
      },
      (err) => {
        console.warn('Firestore logos listener fallback:', err);
        setSyncState('fallback');
        if (onError) onError(err);
        onData(readCache(CACHE_KEYS.logos, DEFAULT_LOGOS));
      }
    );

    return () => {
      localLogoListeners.delete(onData);
      unsubFirestore();
    };
  },

  async getLogos(): Promise<LogoAsset[]> {
    try {
      const snap = await getDocs(scopedQuery('logos'));
      setSyncState('cloud');
      const list = snap.docs.map((d) => mapLogoDoc(d.data() as Record<string, unknown>));
      writeCache(CACHE_KEYS.logos, list);
      return list;
    } catch {
      setSyncState('fallback');
      return readCache(CACHE_KEYS.logos, DEFAULT_LOGOS);
    }
  },

  async saveLogo(input: SaveLogoInput): Promise<LogoAsset> {
    const uid = actorId();
    const nowIso = new Date().toISOString();
    const cached = readCache<LogoAsset[]>(CACHE_KEYS.logos, DEFAULT_LOGOS);
    const existing = cached.find((l) => l.id === input.id);
    const saved: LogoAsset = {
      ...input,
      formatLabel: input.formatLabel ?? '',
      officeId: OFFICE_SCOPE_ID,
      createdAt: existing?.createdAt || input.createdAt || nowIso,
      updatedAt: nowIso,
      updatedBy: uid,
    };

    let nextList = cached.some((l) => l.id === saved.id)
      ? cached.map((l) => (l.id === saved.id ? saved : l))
      : [...cached, saved];
    if (saved.isDefault) {
      nextList = nextList.map((l) => ({ ...l, isDefault: l.id === saved.id }));
    }
    writeCache(CACHE_KEYS.logos, nextList);
    notifyLocal(localLogoListeners, nextList);

    try {
      const refDoc = doc(db, 'logos', saved.id);
      const snap = await getDoc(refDoc);
      const payload = {
        id: saved.id,
        name: saved.name.trim(),
        formatLabel: (saved.formatLabel || '').trim(),
        dataUrl: saved.dataUrl,
        isDefault: saved.isDefault,
        officeId: OFFICE_SCOPE_ID,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      };
      if (snap.exists()) {
        await updateDoc(refDoc, payload);
      } else {
        await setDoc(refDoc, { ...payload, createdAt: serverTimestamp() });
      }
      if (saved.isDefault) {
        const allSnap = await getDocs(scopedQuery('logos'));
        await Promise.all(
          allSnap.docs
            .filter((d) => d.id !== saved.id && d.data().isDefault)
            .map((d) =>
              updateDoc(doc(db, 'logos', d.id), {
                isDefault: false,
                updatedAt: serverTimestamp(),
                updatedBy: uid,
              })
            )
        );
      }
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore saveLogo fallback:', err);
      setSyncState('fallback');
    }
    return saved;
  },

  async deleteLogo(id: string): Promise<void> {
    const cached = readCache<LogoAsset[]>(CACHE_KEYS.logos, DEFAULT_LOGOS);
    const next = cached.filter((l) => l.id !== id);
    writeCache(CACHE_KEYS.logos, next);
    notifyLocal(localLogoListeners, next);

    try {
      await deleteDoc(doc(db, 'logos', id));
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore deleteLogo fallback:', err);
      setSyncState('fallback');
    }
  },

  // -------------------------------------------------------------------------
  // Settings (Letterhead Fallback & Signature Config)
  // -------------------------------------------------------------------------
  async getLetterhead(): Promise<LetterheadSettings> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'letterhead'));
      setSyncState('cloud');
      if (!snap.exists()) return readCache(CACHE_KEYS.letterhead, DEFAULT_LETTERHEAD);
      const d = snap.data();
      const mapped: LetterheadSettings = {
        officeTitle: d.officeTitle,
        oabNumber: d.oabNumber,
        subtitle: d.subtitle || '',
        headerAlignment: d.headerAlignment || 'center',
        addressFooter: d.addressFooter,
        phone: d.phone,
        email: d.email,
        instagram: d.instagram || '',
        website: d.website || '',
        logoDataUrl: d.logoDataUrl ?? null,
        sealDataUrl: d.sealDataUrl ?? null,
        officeId: d.officeId || OFFICE_SCOPE_ID,
        updatedAt: toIsoString(d.updatedAt),
        updatedBy: d.updatedBy || 'office_admin',
      };
      writeCache(CACHE_KEYS.letterhead, mapped);
      return mapped;
    } catch {
      setSyncState('fallback');
      return readCache(CACHE_KEYS.letterhead, DEFAULT_LETTERHEAD);
    }
  },

  async saveLetterhead(
    settings: Omit<LetterheadSettings, 'updatedAt' | 'updatedBy'>
  ): Promise<LetterheadSettings> {
    const uid = actorId();
    const saved: LetterheadSettings = {
      ...settings,
      officeId: OFFICE_SCOPE_ID,
      updatedAt: new Date().toISOString(),
      updatedBy: uid,
    };
    writeCache(CACHE_KEYS.letterhead, saved);

    try {
      await setDoc(doc(db, 'settings', 'letterhead'), {
        officeTitle: settings.officeTitle,
        oabNumber: settings.oabNumber,
        subtitle: settings.subtitle ?? '',
        headerAlignment: settings.headerAlignment ?? 'center',
        addressFooter: settings.addressFooter,
        phone: settings.phone,
        email: settings.email,
        instagram: settings.instagram ?? '',
        website: settings.website ?? '',
        logoDataUrl: settings.logoDataUrl ?? null,
        sealDataUrl: settings.sealDataUrl ?? null,
        officeId: OFFICE_SCOPE_ID,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore saveLetterhead fallback:', err);
      setSyncState('fallback');
    }
    return saved;
  },

  async getSignatureConfig(): Promise<SignatureConfigSettings> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'signatureConfig'));
      setSyncState('cloud');
      if (!snap.exists()) return readCache(CACHE_KEYS.signatureConfig, DEFAULT_SIGNATURE_CONFIG);
      const d = snap.data();
      const mapped: SignatureConfigSettings = {
        govbrEnabled: d.govbrEnabled !== undefined ? Boolean(d.govbrEnabled) : true,
        govbrPortalUrl:
          typeof d.govbrPortalUrl === 'string' && d.govbrPortalUrl.length >= 8
            ? d.govbrPortalUrl
            : DEFAULT_SIGNATURE_CONFIG.govbrPortalUrl,
        instructionsNote:
          typeof d.instructionsNote === 'string'
            ? d.instructionsNote
            : DEFAULT_SIGNATURE_CONFIG.instructionsNote,
        requireSignedUpload:
          d.requireSignedUpload !== undefined ? Boolean(d.requireSignedUpload) : true,
        officeId: d.officeId || OFFICE_SCOPE_ID,
        updatedAt: toIsoString(d.updatedAt),
        updatedBy: d.updatedBy || 'office_admin',
      };
      writeCache(CACHE_KEYS.signatureConfig, mapped);
      return mapped;
    } catch {
      setSyncState('fallback');
      return readCache(CACHE_KEYS.signatureConfig, DEFAULT_SIGNATURE_CONFIG);
    }
  },

  async saveSignatureConfig(
    config: Omit<SignatureConfigSettings, 'updatedAt' | 'updatedBy'>
  ): Promise<SignatureConfigSettings> {
    const uid = actorId();
    const saved: SignatureConfigSettings = {
      ...config,
      officeId: OFFICE_SCOPE_ID,
      updatedAt: new Date().toISOString(),
      updatedBy: uid,
    };
    writeCache(CACHE_KEYS.signatureConfig, saved);

    try {
      await setDoc(doc(db, 'settings', 'signatureConfig'), {
        govbrEnabled: config.govbrEnabled,
        govbrPortalUrl: config.govbrPortalUrl.trim() || DEFAULT_SIGNATURE_CONFIG.govbrPortalUrl,
        instructionsNote: (config.instructionsNote || '').trim(),
        requireSignedUpload: config.requireSignedUpload,
        officeId: OFFICE_SCOPE_ID,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore saveSignatureConfig fallback:', err);
      setSyncState('fallback');
    }
    return saved;
  },

  // -------------------------------------------------------------------------
  // Templates CRUD & Real-Time Subscription
  // -------------------------------------------------------------------------
  subscribeToTemplates(
    onData: (templates: DocumentTemplate[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    localTemplateListeners.add(onData);
    const unsubFirestore = onSnapshot(
      scopedQuery('templates'),
      (snap) => {
        setSyncState('cloud');
        const list = snap.empty
          ? DEFAULT_TEMPLATES
          : snap.docs.map((d) => mapTemplateDoc(d.data() as Record<string, unknown>));
        writeCache(CACHE_KEYS.templates, list);
        onData(list);
      },
      (err) => {
        console.warn('Firestore templates listener fallback:', err);
        setSyncState('fallback');
        if (onError) onError(err);
        onData(readCache(CACHE_KEYS.templates, DEFAULT_TEMPLATES));
      }
    );

    return () => {
      localTemplateListeners.delete(onData);
      unsubFirestore();
    };
  },

  async getTemplates(): Promise<DocumentTemplate[]> {
    try {
      const snap = await getDocs(scopedQuery('templates'));
      setSyncState('cloud');
      if (snap.empty) return readCache(CACHE_KEYS.templates, DEFAULT_TEMPLATES);
      const list = snap.docs.map((d) => mapTemplateDoc(d.data() as Record<string, unknown>));
      writeCache(CACHE_KEYS.templates, list);
      return list;
    } catch {
      setSyncState('fallback');
      return readCache(CACHE_KEYS.templates, DEFAULT_TEMPLATES);
    }
  },

  async getTemplateById(id: string): Promise<DocumentTemplate | null> {
    try {
      const snap = await getDoc(doc(db, 'templates', id));
      setSyncState('cloud');
      if (snap.exists()) {
        return mapTemplateDoc(snap.data() as Record<string, unknown>);
      }
    } catch {
      setSyncState('fallback');
    }
    const cached = readCache<DocumentTemplate[]>(CACHE_KEYS.templates, DEFAULT_TEMPLATES);
    return (
      cached.find((t) => t.id === id) ??
      DEFAULT_TEMPLATES.find((t) => t.id === id) ??
      null
    );
  },

  async saveTemplate(template: SaveTemplateInput): Promise<DocumentTemplate> {
    const uid = actorId();
    const nowIso = new Date().toISOString();
    const cached = readCache<DocumentTemplate[]>(CACHE_KEYS.templates, DEFAULT_TEMPLATES);
    const existingLocal = cached.find((t) => t.id === template.id);

    const bodyFontSizePx = resolveTemplateBodyFontSizePx(template);

    const saved: DocumentTemplate = {
      ...template,
      bodyFontSizePx,
      customFields: template.customFields ?? [],
      headerId: template.headerId === undefined ? undefined : template.headerId,
      footerId: template.footerId === undefined ? undefined : template.footerId,
      logoId: template.logoId === undefined ? undefined : template.logoId,
      officeId: OFFICE_SCOPE_ID,
      ownerUid: existingLocal?.ownerUid || uid,
      createdAt: existingLocal?.createdAt || template.createdAt || nowIso,
      updatedAt: nowIso,
    };

    let nextList = cached.some((t) => t.id === saved.id)
      ? cached.map((t) => (t.id === saved.id ? saved : t))
      : [...cached, saved];
    if (saved.isDefault) {
      nextList = nextList.map((t) => ({ ...t, isDefault: t.id === saved.id }));
    }
    writeCache(CACHE_KEYS.templates, nextList);
    notifyLocal(localTemplateListeners, nextList);

    try {
      const docRef = doc(db, 'templates', template.id);
      const existingSnap = await getDoc(docRef);
      const commonFields: Record<string, unknown> = {
        title: template.title.trim(),
        category: template.category.trim(),
        content: template.content,
        bodyFontSizePx: bodyFontSizePx ?? DEFAULT_BODY_FONT_PX,
        isDefault: template.isDefault,
        customFields: template.customFields ?? [],
        headerId: template.headerId === undefined ? null : template.headerId,
        footerId: template.footerId === undefined ? null : template.footerId,
        logoId: template.logoId === undefined ? null : template.logoId,
        officeId: OFFICE_SCOPE_ID,
        updatedAt: serverTimestamp(),
      };

      // Note: undefined headerId/footerId/logoId means "use default"; only store null when explicitly null,
      // otherwise omit or store explicit string/null cleanly:
      if (template.headerId === undefined) delete commonFields.headerId;
      if (template.footerId === undefined) delete commonFields.footerId;
      if (template.logoId === undefined) delete commonFields.logoId;

      if (existingSnap.exists()) {
        await updateDoc(docRef, commonFields);
      } else {
        await setDoc(docRef, {
          id: template.id,
          ...commonFields,
          ownerUid: uid,
          createdAt: serverTimestamp(),
        });
      }

      // Enforce exclusive single default template across all templates in Firestore
      if (saved.isDefault) {
        const allSnap = await getDocs(scopedQuery('templates'));
        await Promise.all(
          allSnap.docs
            .filter((d) => d.id !== saved.id && d.data().isDefault)
            .map((d) =>
              updateDoc(doc(db, 'templates', d.id), {
                isDefault: false,
                updatedAt: serverTimestamp(),
              })
            )
        );
      }
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore saveTemplate fallback:', err);
      setSyncState('fallback');
    }
    return saved;
  },

  async deleteTemplate(id: string): Promise<void> {
    const cached = readCache<DocumentTemplate[]>(CACHE_KEYS.templates, DEFAULT_TEMPLATES);
    const next = cached.filter((t) => t.id !== id);
    writeCache(CACHE_KEYS.templates, next);
    notifyLocal(localTemplateListeners, next);

    try {
      await deleteDoc(doc(db, 'templates', id));
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore deleteTemplate fallback:', err);
      setSyncState('fallback');
    }
  },

  /**
   * Batch-applies a Header, Footer, or Logo ONLY to selected DocumentTemplates
   * so future generated documents adopt the new pattern without altering existing
   * atendimentos or previously generated/signed PDFs.
   */
  async applyAssetToTemplates(params: {
    assetType: BatchAssetType;
    assetId: string;
    templateIds: string[];
  }): Promise<DocumentTemplate[]> {
    const { assetType, assetId, templateIds } = params;
    if (templateIds.length === 0) {
      return readCache<DocumentTemplate[]>(CACHE_KEYS.templates, DEFAULT_TEMPLATES);
    }

    const nowIso = new Date().toISOString();
    const cached = readCache<DocumentTemplate[]>(CACHE_KEYS.templates, DEFAULT_TEMPLATES);
    const updatedList = applyBatchAssetToTemplateList(
      cached,
      assetType,
      assetId,
      templateIds,
      nowIso
    );
    writeCache(CACHE_KEYS.templates, updatedList);
    notifyLocal(localTemplateListeners, updatedList);

    const fieldKey: 'headerId' | 'footerId' | 'logoId' =
      assetType === 'header' ? 'headerId' : assetType === 'footer' ? 'footerId' : 'logoId';

    try {
      await Promise.all(
        templateIds.map(async (tplId) => {
          const docRef = doc(db, 'templates', tplId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            await updateDoc(docRef, {
              [fieldKey]: assetId,
              updatedAt: serverTimestamp(),
            });
          } else {
            const localTpl = updatedList.find((t) => t.id === tplId);
            if (localTpl) {
              await setDoc(docRef, {
                id: localTpl.id,
                title: localTpl.title,
                category: localTpl.category,
                content: localTpl.content,
                bodyFontSizePx: resolveTemplateBodyFontSizePx(localTpl),
                isDefault: localTpl.isDefault,
                customFields: localTpl.customFields ?? [],
                headerId: localTpl.headerId === undefined ? null : localTpl.headerId,
                footerId: localTpl.footerId === undefined ? null : localTpl.footerId,
                logoId: localTpl.logoId === undefined ? null : localTpl.logoId,
                officeId: OFFICE_SCOPE_ID,
                ownerUid: localTpl.ownerUid || actorId(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          }
        })
      );
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore applyAssetToTemplates fallback:', err);
      setSyncState('fallback');
    }

    return updatedList;
  },

  // -------------------------------------------------------------------------
  // Atendimentos (ServiceLinks) CRUD & Real-Time Subscription
  // -------------------------------------------------------------------------
  subscribeToLinks(
    onData: (links: ServiceLink[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    localLinkListeners.add(onData);
    const unsubFirestore = onSnapshot(
      scopedQuery('atendimentos'),
      (snapshot) => {
        setSyncState('cloud');
        const list = sortByCreatedDesc(
          snapshot.docs.map((d) => mapServiceLinkDoc(d.data() as Record<string, unknown>))
        );
        writeCache(CACHE_KEYS.links, list);
        onData(list);
      },
      (err) => {
        console.warn('Firestore atendimentos listener fallback:', err);
        setSyncState('fallback');
        if (onError) onError(err);
        onData(sortByCreatedDesc(readCache(CACHE_KEYS.links, [DEMO_SERVICE_LINK])));
      }
    );

    return () => {
      localLinkListeners.delete(onData);
      unsubFirestore();
    };
  },

  async getLinkByToken(tokenId: string): Promise<ServiceLink | null> {
    try {
      const snap = await getDoc(doc(db, 'atendimentos', tokenId));
      setSyncState('cloud');
      if (snap.exists()) {
        return mapServiceLinkDoc(snap.data() as Record<string, unknown>);
      }
      // Backward-compatibility check for legacy serviceLinks collection
      const legacySnap = await getDoc(doc(db, 'serviceLinks', tokenId));
      if (legacySnap.exists()) {
        return mapServiceLinkDoc(legacySnap.data() as Record<string, unknown>);
      }
    } catch {
      setSyncState('fallback');
    }

    const cached = readCache<ServiceLink[]>(CACHE_KEYS.links, [DEMO_SERVICE_LINK]);
    return (
      cached.find((l) => l.tokenId === tokenId) ??
      (tokenId === DEMO_SERVICE_LINK.tokenId ? DEMO_SERVICE_LINK : null)
    );
  },

  async createServiceLink(input: CreateLinkInput): Promise<ServiceLink> {
    const uid = actorId();
    const tokenId = generateSecureToken(16);
    const pin = extractLast4Digits(input.whatsapp);
    if (pin.length !== 4) {
      throw new Error('O número de WhatsApp precisa ter ao menos 4 dígitos para definir o PIN.');
    }

    const created: ServiceLink = {
      tokenId,
      clientId: input.clientId ?? null,
      clientName: input.clientName.trim(),
      whatsapp: input.whatsapp.trim(),
      pin,
      templateId: input.templateId,
      templateTitle: input.templateTitle,
      status: 'pendente',
      signatureMethod: 'none',
      officeId: OFFICE_SCOPE_ID,
      ownerUid: uid,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    const cached = readCache<ServiceLink[]>(CACHE_KEYS.links, [DEMO_SERVICE_LINK]);
    const nextList = [created, ...cached];
    writeCache(CACHE_KEYS.links, nextList);
    notifyLocal(localLinkListeners, nextList);

    try {
      await setDoc(doc(db, 'atendimentos', tokenId), {
        tokenId,
        clientId: created.clientId ?? null,
        clientName: created.clientName,
        whatsapp: created.whatsapp,
        pin,
        templateId: created.templateId,
        templateTitle: created.templateTitle,
        status: 'pendente',
        signatureMethod: 'none',
        signatureEnvelopeId: null,
        signatureAuditHash: null,
        signedPdfUrl: null,
        signedPdfStoragePath: null,
        signedPdfName: null,
        officeId: OFFICE_SCOPE_ID,
        ownerUid: uid,
        createdAt: serverTimestamp(),
        completedAt: null,
      });
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore createServiceLink fallback:', err);
      setSyncState('fallback');
    }

    return created;
  },

  async updateLinkStatus(tokenId: string, patch: UpdateLinkStatusInput): Promise<void> {
    const cached = readCache<ServiceLink[]>(CACHE_KEYS.links, [DEMO_SERVICE_LINK]);
    const nextList = cached.map((item) =>
      item.tokenId !== tokenId
        ? item
        : {
            ...item,
            status: patch.status,
            signatureMethod: patch.signatureMethod ?? item.signatureMethod,
            signatureEnvelopeId:
              patch.signatureEnvelopeId !== undefined
                ? patch.signatureEnvelopeId
                : item.signatureEnvelopeId,
            signatureAuditHash:
              patch.signatureAuditHash !== undefined
                ? patch.signatureAuditHash
                : item.signatureAuditHash,
            signedPdfUrl: patch.signedPdfUrl !== undefined ? patch.signedPdfUrl : item.signedPdfUrl,
            signedPdfStoragePath:
              patch.signedPdfStoragePath !== undefined
                ? patch.signedPdfStoragePath
                : item.signedPdfStoragePath,
            signedPdfName:
              patch.signedPdfName !== undefined ? patch.signedPdfName : item.signedPdfName,
            completedAt: patch.status === 'concluido' ? new Date().toISOString() : null,
          }
    );
    writeCache(CACHE_KEYS.links, nextList);
    notifyLocal(localLinkListeners, nextList);

    try {
      const payload: Record<string, unknown> = { status: patch.status };
      if (patch.signatureMethod !== undefined) payload.signatureMethod = patch.signatureMethod;
      if (patch.signatureEnvelopeId !== undefined)
        payload.signatureEnvelopeId = patch.signatureEnvelopeId;
      if (patch.signatureAuditHash !== undefined)
        payload.signatureAuditHash = patch.signatureAuditHash;
      if (patch.signedPdfUrl !== undefined) payload.signedPdfUrl = patch.signedPdfUrl;
      if (patch.signedPdfStoragePath !== undefined)
        payload.signedPdfStoragePath = patch.signedPdfStoragePath;
      if (patch.signedPdfName !== undefined) payload.signedPdfName = patch.signedPdfName;
      payload.completedAt = patch.status === 'concluido' ? serverTimestamp() : null;

      const atendimentoRef = doc(db, 'atendimentos', tokenId);
      const snap = await getDoc(atendimentoRef);
      if (snap.exists()) {
        await updateDoc(atendimentoRef, payload);
      } else {
        const legacyRef = doc(db, 'serviceLinks', tokenId);
        const legacySnap = await getDoc(legacyRef);
        if (legacySnap.exists()) {
          await updateDoc(legacyRef, payload);
        }
      }
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore updateLinkStatus fallback:', err);
      setSyncState('fallback');
    }
  },

  async deleteServiceLink(link: ServiceLink): Promise<void> {
    const cached = readCache<ServiceLink[]>(CACHE_KEYS.links, [DEMO_SERVICE_LINK]);
    const nextList = cached.filter((l) => l.tokenId !== link.tokenId);
    writeCache(CACHE_KEYS.links, nextList);
    notifyLocal(localLinkListeners, nextList);

    try {
      if (link.signedPdfStoragePath && !link.signedPdfStoragePath.startsWith('local-')) {
        try {
          await deleteObject(ref(storage, link.signedPdfStoragePath));
        } catch {
          // Storage object might already be removed
        }
      }
      await deleteDoc(doc(db, 'atendimentos', link.tokenId)).catch(() => {});
      await deleteDoc(doc(db, 'serviceLinks', link.tokenId)).catch(() => {});
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore deleteServiceLink fallback:', err);
      setSyncState('fallback');
    }
  },

  async uploadSignedPdf(
    tokenId: string,
    file: Blob,
    fileName: string
  ): Promise<UploadSignedPdfResult> {
    const safeName = fileName.replace(/[^a-zA-Z0-9_.\-]/g, '_');
    const storagePath = `signed-documents/${tokenId}/${safeName}`;
    try {
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file, { contentType: 'application/pdf' });
      const url = await getDownloadURL(storageRef);
      return {
        url,
        storagePath,
        fileName: safeName,
      };
    } catch (storageError) {
      console.warn('Firebase Storage upload fallback:', storageError);
      // Graceful fallback for test/sandbox environments without Storage bucket enabled
      const dataUrl = await blobToDataUrl(file);
      return {
        url: dataUrl.length <= 1900 ? dataUrl : `https://storage.local/signed-documents/${tokenId}/${safeName}`,
        storagePath: `local-session/${tokenId}/${safeName}`,
        fileName: safeName,
      };
    }
  },

  // -------------------------------------------------------------------------
  // Clients CRUD & Real-Time Subscription (Manual lawyer registration)
  // -------------------------------------------------------------------------
  subscribeToClients(
    onData: (clients: ClientRecord[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    localClientListeners.add(onData);
    const unsubFirestore = onSnapshot(
      scopedQuery('clients'),
      (snap) => {
        setSyncState('cloud');
        const list = sortByCreatedDesc(
          snap.docs.map((d) => mapClientDoc(d.data() as Record<string, unknown>))
        );
        writeCache(CACHE_KEYS.clients, list);
        onData(list);
      },
      (err) => {
        console.warn('Firestore clients listener fallback:', err);
        setSyncState('fallback');
        if (onError) onError(err);
        onData(sortByCreatedDesc(readCache<ClientRecord[]>(CACHE_KEYS.clients, [])));
      }
    );

    return () => {
      localClientListeners.delete(onData);
      unsubFirestore();
    };
  },

  async findClientByCpf(cpfInput: string): Promise<ClientRecord | null> {
    const cached = readCache<ClientRecord[]>(CACHE_KEYS.clients, []);
    try {
      const snap = await getDocs(scopedQuery('clients'));
      setSyncState('cloud');
      const list = sortByCreatedDesc(
        snap.docs.map((d) => mapClientDoc(d.data() as Record<string, unknown>))
      );
      if (list.length > 0) {
        writeCache(CACHE_KEYS.clients, list);
      }
      return findClientByCpfInList(list.length > 0 ? list : cached, cpfInput);
    } catch {
      setSyncState('fallback');
      return findClientByCpfInList(cached, cpfInput);
    }
  },

  async saveClient(input: SaveClientInput): Promise<ClientRecord> {
    const uid = actorId();
    const nowIso = new Date().toISOString();
    const cached = readCache<ClientRecord[]>(CACHE_KEYS.clients, []);
    const byId = cached.find((c) => c.id === input.id);
    const byCpf = !byId && input.cpf ? findClientByCpfInList(cached, input.cpf) : null;
    const existing = byId || byCpf || undefined;
    const resolvedId = existing?.id || input.id;

    const saved: ClientRecord = {
      ...input,
      id: resolvedId,
      officeId: OFFICE_SCOPE_ID,
      createdAt: existing?.createdAt || input.createdAt || nowIso,
      updatedAt: nowIso,
      updatedBy: uid,
    };

    const nextList = cached.some((c) => c.id === saved.id)
      ? cached.map((c) => (c.id === saved.id ? saved : c))
      : [saved, ...cached];
    writeCache(CACHE_KEYS.clients, nextList);
    notifyLocal(localClientListeners, nextList);

    try {
      const refDoc = doc(db, 'clients', saved.id);
      const snap = await getDoc(refDoc);
      const payload = {
        id: saved.id,
        fullName: saved.fullName.trim(),
        cpf: saved.cpf.trim(),
        rg: saved.rg.trim(),
        email: saved.email.trim(),
        whatsapp: saved.whatsapp.trim(),
        address: saved.address.trim(),
        nationality: saved.nationality.trim(),
        maritalStatus: saved.maritalStatus.trim(),
        profession: saved.profession.trim(),
        officeId: OFFICE_SCOPE_ID,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      };
      if (snap.exists()) {
        await updateDoc(refDoc, payload);
      } else {
        await setDoc(refDoc, { ...payload, createdAt: serverTimestamp() });
      }
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore saveClient fallback:', err);
      setSyncState('fallback');
    }
    return saved;
  },

  async deleteClient(id: string): Promise<void> {
    const cached = readCache<ClientRecord[]>(CACHE_KEYS.clients, []);
    const nextList = cached.filter((c) => c.id !== id);
    writeCache(CACHE_KEYS.clients, nextList);
    notifyLocal(localClientListeners, nextList);

    try {
      await deleteDoc(doc(db, 'clients', id));
      setSyncState('cloud');
    } catch (err) {
      console.warn('Firestore deleteClient fallback:', err);
      setSyncState('fallback');
    }
  },

  // -------------------------------------------------------------------------
  // Changelog / Version Homologation Checklist
  // -------------------------------------------------------------------------
  async getChangelogChecklist(version: string): Promise<ChangelogChecklistState> {
    const fallback: ChangelogChecklistState = {
      version,
      checkedIds: [],
      officeId: OFFICE_SCOPE_ID,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
    try {
      const snap = await getDoc(doc(db, 'settings', 'changelogProgress'));
      if (!snap.exists()) {
        return readCache<ChangelogChecklistState>(CACHE_KEYS.changelog, fallback);
      }
      const d = snap.data();
      const mapped: ChangelogChecklistState = {
        version: typeof d.version === 'string' ? d.version : version,
        checkedIds: Array.isArray(d.checkedIds) ? d.checkedIds.map(String) : [],
        officeId: typeof d.officeId === 'string' ? d.officeId : OFFICE_SCOPE_ID,
        updatedAt: toIsoString(d.updatedAt),
        updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : 'office_admin',
      };
      writeCache(CACHE_KEYS.changelog, mapped);
      return mapped;
    } catch {
      return readCache<ChangelogChecklistState>(CACHE_KEYS.changelog, fallback);
    }
  },

  async saveChangelogChecklist(
    version: string,
    checkedIds: string[]
  ): Promise<ChangelogChecklistState> {
    const uid = actorId();
    const saved: ChangelogChecklistState = {
      version,
      checkedIds,
      officeId: OFFICE_SCOPE_ID,
      updatedAt: new Date().toISOString(),
      updatedBy: uid,
    };
    writeCache(CACHE_KEYS.changelog, saved);

    try {
      await setDoc(doc(db, 'settings', 'changelogProgress'), {
        version,
        checkedIds: checkedIds.slice(0, 50),
        officeId: OFFICE_SCOPE_ID,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    } catch (err) {
      console.warn('Firestore saveChangelogChecklist fallback:', err);
    }
    return saved;
  },
};
