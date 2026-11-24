import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type {
  DocumentTemplate,
  LetterheadSettings,
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
import { auth, db, handleFirestoreError, OperationType, storage } from './firebaseConfig';

export type PersistenceMode = 'firebase' | 'local';

export interface CreateLinkInput {
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

export interface IDataService {
  getLetterhead(): Promise<LetterheadSettings>;
  saveLetterhead(settings: Omit<LetterheadSettings, 'updatedAt' | 'updatedBy'>): Promise<LetterheadSettings>;
  getSignatureConfig(): Promise<SignatureConfigSettings>;
  saveSignatureConfig(
    config: Omit<SignatureConfigSettings, 'updatedAt' | 'updatedBy'>
  ): Promise<SignatureConfigSettings>;
  getTemplates(): Promise<DocumentTemplate[]>;
  getTemplateById(id: string): Promise<DocumentTemplate | null>;
  saveTemplate(
    template: Omit<DocumentTemplate, 'ownerUid' | 'createdAt' | 'updatedAt'> & { createdAt?: string }
  ): Promise<DocumentTemplate>;
  deleteTemplate(id: string): Promise<void>;
  subscribeToLinks(
    onData: (links: ServiceLink[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe;
  getLinkByToken(tokenId: string): Promise<ServiceLink | null>;
  createServiceLink(input: CreateLinkInput): Promise<ServiceLink>;
  updateLinkStatus(tokenId: string, patch: UpdateLinkStatusInput): Promise<void>;
  deleteServiceLink(link: ServiceLink): Promise<void>;
  uploadSignedPdf(tokenId: string, file: Blob, fileName: string): Promise<UploadSignedPdfResult>;
  ensureSeedData(): Promise<void>;
}

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
// Timestamp Conversion Helper
// ---------------------------------------------------------------------------
function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
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

// ---------------------------------------------------------------------------
// 1. Firebase Cloud Firestore & Storage Repository
// ---------------------------------------------------------------------------
class FirebaseDataRepository implements IDataService {
  private requireUid(): string {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error('Autenticação administrativa do Firebase necessária.');
    }
    return uid;
  }

  async ensureSeedData(): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      const letterheadRef = doc(db, 'settings', 'letterhead');
      const letterheadSnap = await getDoc(letterheadRef);
      if (!letterheadSnap.exists()) {
        await setDoc(letterheadRef, {
          officeTitle: DEFAULT_LETTERHEAD.officeTitle,
          oabNumber: DEFAULT_LETTERHEAD.oabNumber,
          subtitle: DEFAULT_LETTERHEAD.subtitle ?? '',
          addressFooter: DEFAULT_LETTERHEAD.addressFooter,
          phone: DEFAULT_LETTERHEAD.phone,
          email: DEFAULT_LETTERHEAD.email,
          instagram: DEFAULT_LETTERHEAD.instagram ?? '',
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        });
      }

      const sigRef = doc(db, 'settings', 'signatureConfig');
      const sigSnap = await getDoc(sigRef);
      if (!sigSnap.exists()) {
        await setDoc(sigRef, {
          defaultProvider: DEFAULT_SIGNATURE_CONFIG.defaultProvider,
          clicksignEnabled: DEFAULT_SIGNATURE_CONFIG.clicksignEnabled,
          docusignEnabled: DEFAULT_SIGNATURE_CONFIG.docusignEnabled,
          govbrEnabled: DEFAULT_SIGNATURE_CONFIG.govbrEnabled,
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        });
      }

      const templatesSnap = await getDocs(collection(db, 'templates'));
      if (templatesSnap.empty) {
        for (const tpl of DEFAULT_TEMPLATES) {
          await setDoc(doc(db, 'templates', tpl.id), {
            id: tpl.id,
            title: tpl.title,
            category: tpl.category,
            content: tpl.content,
            isDefault: tpl.isDefault,
            ownerUid: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'seed');
    }
  }

  async getLetterhead(): Promise<LetterheadSettings> {
    const path = 'settings/letterhead';
    try {
      const snap = await getDoc(doc(db, 'settings', 'letterhead'));
      if (!snap.exists()) return DEFAULT_LETTERHEAD;
      const d = snap.data();
      return {
        officeTitle: d.officeTitle,
        oabNumber: d.oabNumber,
        subtitle: d.subtitle,
        headerAlignment: d.headerAlignment || 'center',
        addressFooter: d.addressFooter,
        phone: d.phone,
        email: d.email,
        instagram: d.instagram,
        website: d.website || '',
        logoDataUrl: d.logoDataUrl ?? null,
        sealDataUrl: d.sealDataUrl ?? null,
        updatedAt: toIsoString(d.updatedAt),
        updatedBy: d.updatedBy,
      };
    } catch {
      return DEFAULT_LETTERHEAD;
    }
  }

  async saveLetterhead(
    settings: Omit<LetterheadSettings, 'updatedAt' | 'updatedBy'>
  ): Promise<LetterheadSettings> {
    const uid = this.requireUid();
    const path = 'settings/letterhead';
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
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
      return {
        ...settings,
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getSignatureConfig(): Promise<SignatureConfigSettings> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'signatureConfig'));
      if (!snap.exists()) return DEFAULT_SIGNATURE_CONFIG;
      const d = snap.data();
      return {
        defaultProvider: d.defaultProvider,
        clicksignEnabled: d.clicksignEnabled,
        docusignEnabled: d.docusignEnabled,
        govbrEnabled: d.govbrEnabled,
        updatedAt: toIsoString(d.updatedAt),
        updatedBy: d.updatedBy,
      };
    } catch {
      return DEFAULT_SIGNATURE_CONFIG;
    }
  }

  async saveSignatureConfig(
    config: Omit<SignatureConfigSettings, 'updatedAt' | 'updatedBy'>
  ): Promise<SignatureConfigSettings> {
    const uid = this.requireUid();
    const path = 'settings/signatureConfig';
    try {
      await setDoc(doc(db, 'settings', 'signatureConfig'), {
        defaultProvider: config.defaultProvider,
        clicksignEnabled: config.clicksignEnabled,
        docusignEnabled: config.docusignEnabled,
        govbrEnabled: config.govbrEnabled,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
      return {
        ...config,
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getTemplates(): Promise<DocumentTemplate[]> {
    const path = 'templates';
    try {
      const snap = await getDocs(collection(db, 'templates'));
      if (snap.empty) return DEFAULT_TEMPLATES;
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id,
          title: data.title,
          category: data.category,
          content: data.content,
          isDefault: Boolean(data.isDefault),
          customFields: Array.isArray(data.customFields) ? data.customFields : [],
          ownerUid: data.ownerUid,
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async getTemplateById(id: string): Promise<DocumentTemplate | null> {
    const path = `templates/${id}`;
    try {
      const snap = await getDoc(doc(db, 'templates', id));
      if (!snap.exists()) {
        return DEFAULT_TEMPLATES.find((t) => t.id === id) ?? null;
      }
      const data = snap.data();
      return {
        id: data.id,
        title: data.title,
        category: data.category,
        content: data.content,
        isDefault: Boolean(data.isDefault),
        customFields: Array.isArray(data.customFields) ? data.customFields : [],
        ownerUid: data.ownerUid,
        createdAt: toIsoString(data.createdAt),
        updatedAt: toIsoString(data.updatedAt),
      };
    } catch {
      return DEFAULT_TEMPLATES.find((t) => t.id === id) ?? null;
    }
  }

  async saveTemplate(
    template: Omit<DocumentTemplate, 'ownerUid' | 'createdAt' | 'updatedAt'> & { createdAt?: string }
  ): Promise<DocumentTemplate> {
    const uid = this.requireUid();
    const path = `templates/${template.id}`;
    try {
      const existingSnap = await getDoc(doc(db, 'templates', template.id));
      if (existingSnap.exists()) {
        const existingData = existingSnap.data();
        await updateDoc(doc(db, 'templates', template.id), {
          title: template.title,
          category: template.category,
          content: template.content,
          isDefault: template.isDefault,
          customFields: template.customFields ?? [],
          updatedAt: serverTimestamp(),
        });
        return {
          ...template,
          customFields: template.customFields ?? [],
          ownerUid: existingData.ownerUid,
          createdAt: toIsoString(existingData.createdAt),
          updatedAt: new Date().toISOString(),
        };
      } else {
        await setDoc(doc(db, 'templates', template.id), {
          id: template.id,
          title: template.title,
          category: template.category,
          content: template.content,
          isDefault: template.isDefault,
          customFields: template.customFields ?? [],
          ownerUid: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return {
          ...template,
          customFields: template.customFields ?? [],
          ownerUid: uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    this.requireUid();
    const path = `templates/${id}`;
    try {
      await deleteDoc(doc(db, 'templates', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  subscribeToLinks(
    onData: (links: ServiceLink[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const path = 'serviceLinks';
    const q = query(collection(db, 'serviceLinks'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: ServiceLink[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            tokenId: data.tokenId,
            clientName: data.clientName,
            whatsapp: data.whatsapp,
            pin: data.pin,
            templateId: data.templateId,
            templateTitle: data.templateTitle,
            status: data.status,
            signatureMethod: data.signatureMethod,
            signatureEnvelopeId: data.signatureEnvelopeId ?? null,
            signatureAuditHash: data.signatureAuditHash ?? null,
            signedPdfUrl: data.signedPdfUrl ?? null,
            signedPdfStoragePath: data.signedPdfStoragePath ?? null,
            signedPdfName: data.signedPdfName ?? null,
            ownerUid: data.ownerUid,
            createdAt: toIsoString(data.createdAt),
            completedAt: data.completedAt ? toIsoString(data.completedAt) : null,
          };
        });
        onData(list);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  async getLinkByToken(tokenId: string): Promise<ServiceLink | null> {
    const path = `serviceLinks/${tokenId}`;
    try {
      const snap = await getDoc(doc(db, 'serviceLinks', tokenId));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        tokenId: data.tokenId,
        clientName: data.clientName,
        whatsapp: data.whatsapp,
        pin: data.pin,
        templateId: data.templateId,
        templateTitle: data.templateTitle,
        status: data.status,
        signatureMethod: data.signatureMethod,
        signatureEnvelopeId: data.signatureEnvelopeId ?? null,
        signatureAuditHash: data.signatureAuditHash ?? null,
        signedPdfUrl: data.signedPdfUrl ?? null,
        signedPdfStoragePath: data.signedPdfStoragePath ?? null,
        signedPdfName: data.signedPdfName ?? null,
        ownerUid: data.ownerUid,
        createdAt: toIsoString(data.createdAt),
        completedAt: data.completedAt ? toIsoString(data.completedAt) : null,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async createServiceLink(input: CreateLinkInput): Promise<ServiceLink> {
    const uid = this.requireUid();
    const tokenId = generateSecureToken(16);
    const pin = extractLast4Digits(input.whatsapp);
    if (pin.length !== 4) {
      throw new Error('O número de WhatsApp precisa ter ao menos 4 dígitos para definir o PIN.');
    }
    const path = `serviceLinks/${tokenId}`;
    try {
      await setDoc(doc(db, 'serviceLinks', tokenId), {
        tokenId,
        clientName: input.clientName.trim(),
        whatsapp: input.whatsapp.trim(),
        pin,
        templateId: input.templateId,
        templateTitle: input.templateTitle,
        status: 'pendente',
        signatureMethod: 'none',
        signatureEnvelopeId: null,
        signatureAuditHash: null,
        signedPdfUrl: null,
        signedPdfStoragePath: null,
        signedPdfName: null,
        ownerUid: uid,
        createdAt: serverTimestamp(),
        completedAt: null,
      });

      return {
        tokenId,
        clientName: input.clientName.trim(),
        whatsapp: input.whatsapp.trim(),
        pin,
        templateId: input.templateId,
        templateTitle: input.templateTitle,
        status: 'pendente',
        signatureMethod: 'none',
        ownerUid: uid,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updateLinkStatus(tokenId: string, patch: UpdateLinkStatusInput): Promise<void> {
    const path = `serviceLinks/${tokenId}`;
    try {
      const payload: Record<string, unknown> = {
        status: patch.status,
      };
      if (patch.signatureMethod !== undefined) payload.signatureMethod = patch.signatureMethod;
      if (patch.signatureEnvelopeId !== undefined) payload.signatureEnvelopeId = patch.signatureEnvelopeId;
      if (patch.signatureAuditHash !== undefined) payload.signatureAuditHash = patch.signatureAuditHash;
      if (patch.signedPdfUrl !== undefined) payload.signedPdfUrl = patch.signedPdfUrl;
      if (patch.signedPdfStoragePath !== undefined) payload.signedPdfStoragePath = patch.signedPdfStoragePath;
      if (patch.signedPdfName !== undefined) payload.signedPdfName = patch.signedPdfName;
      if (patch.status === 'concluido') {
        payload.completedAt = serverTimestamp();
      } else {
        payload.completedAt = null;
      }

      await updateDoc(doc(db, 'serviceLinks', tokenId), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteServiceLink(link: ServiceLink): Promise<void> {
    this.requireUid();
    const path = `serviceLinks/${link.tokenId}`;
    try {
      if (link.signedPdfStoragePath) {
        try {
          await deleteObject(ref(storage, link.signedPdfStoragePath));
        } catch {
          // Storage object might already be removed
        }
      }
      await deleteDoc(doc(db, 'serviceLinks', link.tokenId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

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
      // If Firebase Storage bucket isn't enabled on Spark yet and file is small (< 1MB), throw informative error
      console.error('Firebase Storage upload error:', storageError);
      throw new Error(
        'Não foi possível enviar o PDF para o Firebase Storage. Verifique se o Firebase Storage está ativado no projeto.'
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Local Session Repository (Zero-Retention LGPD: only non-PII metadata!)
//    Used when unlocked with Master Password without Firebase Google Auth.
// ---------------------------------------------------------------------------
const LOCAL_KEYS = {
  letterhead: 'mm_adv_letterhead_v1',
  signatureConfig: 'mm_adv_sig_config_v1',
  templates: 'mm_adv_templates_v1',
  links: 'mm_adv_links_v1',
};

const SEEDED_DEMO_LINKS: ServiceLink[] = [
  {
    tokenId: 'mm_demo_pendente_01',
    clientName: 'Mariana Costa Oliveira',
    whatsapp: '(22) 99812-4321',
    pin: '4321',
    templateId: 'procuracao-ad-judicia',
    templateTitle: 'Procuração Ad Judicia',
    status: 'pendente',
    signatureMethod: 'none',
    ownerUid: 'local_admin',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    completedAt: null,
  },
];

class LocalSessionDataRepository implements IDataService {
  private listeners = new Set<(links: ServiceLink[]) => void>();
  private signedPdfBlobs = new Map<string, string>();

  private readJson<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private writeJson<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  private notifyLinks(): void {
    const current = this.readJson<ServiceLink[]>(LOCAL_KEYS.links, SEEDED_DEMO_LINKS);
    for (const cb of this.listeners) {
      cb([...current]);
    }
  }

  async ensureSeedData(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!window.localStorage.getItem(LOCAL_KEYS.templates)) {
      this.writeJson(LOCAL_KEYS.templates, DEFAULT_TEMPLATES);
    }
    if (!window.localStorage.getItem(LOCAL_KEYS.letterhead)) {
      this.writeJson(LOCAL_KEYS.letterhead, DEFAULT_LETTERHEAD);
    }
    if (!window.localStorage.getItem(LOCAL_KEYS.signatureConfig)) {
      this.writeJson(LOCAL_KEYS.signatureConfig, DEFAULT_SIGNATURE_CONFIG);
    }
    if (!window.localStorage.getItem(LOCAL_KEYS.links)) {
      this.writeJson(LOCAL_KEYS.links, SEEDED_DEMO_LINKS);
    }
  }

  async getLetterhead(): Promise<LetterheadSettings> {
    await this.ensureSeedData();
    return this.readJson<LetterheadSettings>(LOCAL_KEYS.letterhead, DEFAULT_LETTERHEAD);
  }

  async saveLetterhead(
    settings: Omit<LetterheadSettings, 'updatedAt' | 'updatedBy'>
  ): Promise<LetterheadSettings> {
    const next: LetterheadSettings = {
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: 'local_admin',
    };
    this.writeJson(LOCAL_KEYS.letterhead, next);
    return next;
  }

  async getSignatureConfig(): Promise<SignatureConfigSettings> {
    await this.ensureSeedData();
    return this.readJson<SignatureConfigSettings>(
      LOCAL_KEYS.signatureConfig,
      DEFAULT_SIGNATURE_CONFIG
    );
  }

  async saveSignatureConfig(
    config: Omit<SignatureConfigSettings, 'updatedAt' | 'updatedBy'>
  ): Promise<SignatureConfigSettings> {
    const next: SignatureConfigSettings = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: 'local_admin',
    };
    this.writeJson(LOCAL_KEYS.signatureConfig, next);
    return next;
  }

  async getTemplates(): Promise<DocumentTemplate[]> {
    await this.ensureSeedData();
    return this.readJson<DocumentTemplate[]>(LOCAL_KEYS.templates, DEFAULT_TEMPLATES);
  }

  async getTemplateById(id: string): Promise<DocumentTemplate | null> {
    const all = await this.getTemplates();
    return all.find((t) => t.id === id) ?? null;
  }

  async saveTemplate(
    template: Omit<DocumentTemplate, 'ownerUid' | 'createdAt' | 'updatedAt'> & { createdAt?: string }
  ): Promise<DocumentTemplate> {
    const all = await this.getTemplates();
    const now = new Date().toISOString();
    const idx = all.findIndex((t) => t.id === template.id);
    const saved: DocumentTemplate = {
      ...template,
      ownerUid: 'local_admin',
      createdAt: idx >= 0 ? all[idx].createdAt : template.createdAt ?? now,
      updatedAt: now,
    };
    if (idx >= 0) {
      all[idx] = saved;
    } else {
      all.push(saved);
    }
    this.writeJson(LOCAL_KEYS.templates, all);
    return saved;
  }

  async deleteTemplate(id: string): Promise<void> {
    const all = await this.getTemplates();
    this.writeJson(
      LOCAL_KEYS.templates,
      all.filter((t) => t.id !== id)
    );
  }

  subscribeToLinks(onData: (links: ServiceLink[]) => void): Unsubscribe {
    void this.ensureSeedData().then(() => {
      onData(this.readJson<ServiceLink[]>(LOCAL_KEYS.links, SEEDED_DEMO_LINKS));
    });
    this.listeners.add(onData);
    return () => {
      this.listeners.delete(onData);
    };
  }

  async getLinkByToken(tokenId: string): Promise<ServiceLink | null> {
    await this.ensureSeedData();
    const all = this.readJson<ServiceLink[]>(LOCAL_KEYS.links, SEEDED_DEMO_LINKS);
    return all.find((l) => l.tokenId === tokenId) ?? null;
  }

  async createServiceLink(input: CreateLinkInput): Promise<ServiceLink> {
    await this.ensureSeedData();
    const tokenId = generateSecureToken(16);
    const pin = extractLast4Digits(input.whatsapp);
    if (pin.length !== 4) {
      throw new Error('O número de WhatsApp precisa ter ao menos 4 dígitos para definir o PIN.');
    }
    const created: ServiceLink = {
      tokenId,
      clientName: input.clientName.trim(),
      whatsapp: input.whatsapp.trim(),
      pin,
      templateId: input.templateId,
      templateTitle: input.templateTitle,
      status: 'pendente',
      signatureMethod: 'none',
      ownerUid: 'local_admin',
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    const all = this.readJson<ServiceLink[]>(LOCAL_KEYS.links, SEEDED_DEMO_LINKS);
    all.unshift(created);
    this.writeJson(LOCAL_KEYS.links, all);
    this.notifyLinks();
    return created;
  }

  async updateLinkStatus(tokenId: string, patch: UpdateLinkStatusInput): Promise<void> {
    const all = this.readJson<ServiceLink[]>(LOCAL_KEYS.links, SEEDED_DEMO_LINKS);
    const idx = all.findIndex((l) => l.tokenId === tokenId);
    if (idx < 0) throw new Error('Link de atendimento não encontrado.');
    const current = all[idx];
    all[idx] = {
      ...current,
      status: patch.status,
      signatureMethod: patch.signatureMethod ?? current.signatureMethod,
      signatureEnvelopeId:
        patch.signatureEnvelopeId !== undefined
          ? patch.signatureEnvelopeId
          : current.signatureEnvelopeId,
      signatureAuditHash:
        patch.signatureAuditHash !== undefined
          ? patch.signatureAuditHash
          : current.signatureAuditHash,
      signedPdfUrl: patch.signedPdfUrl !== undefined ? patch.signedPdfUrl : current.signedPdfUrl,
      signedPdfStoragePath:
        patch.signedPdfStoragePath !== undefined
          ? patch.signedPdfStoragePath
          : current.signedPdfStoragePath,
      signedPdfName:
        patch.signedPdfName !== undefined ? patch.signedPdfName : current.signedPdfName,
      completedAt: patch.status === 'concluido' ? new Date().toISOString() : null,
    };
    this.writeJson(LOCAL_KEYS.links, all);
    this.notifyLinks();
  }

  async deleteServiceLink(link: ServiceLink): Promise<void> {
    const all = this.readJson<ServiceLink[]>(LOCAL_KEYS.links, SEEDED_DEMO_LINKS);
    this.writeJson(
      LOCAL_KEYS.links,
      all.filter((l) => l.tokenId !== link.tokenId)
    );
    this.signedPdfBlobs.delete(link.tokenId);
    this.notifyLinks();
  }

  async uploadSignedPdf(
    tokenId: string,
    file: Blob,
    fileName: string
  ): Promise<UploadSignedPdfResult> {
    const dataUrl = await blobToDataUrl(file);
    this.signedPdfBlobs.set(tokenId, dataUrl);
    return {
      url: dataUrl,
      storagePath: `local-session/${tokenId}/${fileName}`,
      fileName,
    };
  }
}

// ---------------------------------------------------------------------------
// Unified Facade (Switchable without touching any UI component)
// ---------------------------------------------------------------------------
const firebaseRepo = new FirebaseDataRepository();
const localRepo = new LocalSessionDataRepository();

let currentMode: PersistenceMode = 'local';

export function setPersistenceMode(mode: PersistenceMode): void {
  currentMode = mode;
}

export function getPersistenceMode(): PersistenceMode {
  return currentMode;
}

function activeRepo(): IDataService {
  return currentMode === 'firebase' ? firebaseRepo : localRepo;
}

export const dataService: IDataService = {
  getLetterhead: () => activeRepo().getLetterhead(),
  saveLetterhead: (s) => activeRepo().saveLetterhead(s),
  getSignatureConfig: () => activeRepo().getSignatureConfig(),
  saveSignatureConfig: (c) => activeRepo().saveSignatureConfig(c),
  getTemplates: () => activeRepo().getTemplates(),
  getTemplateById: async (id) => {
    const localMatch = await localRepo.getTemplateById(id);
    if (currentMode === 'local' && localMatch) return localMatch;
    return firebaseRepo.getTemplateById(id);
  },
  saveTemplate: (t) => activeRepo().saveTemplate(t),
  deleteTemplate: (id) => activeRepo().deleteTemplate(id),
  subscribeToLinks: (onData, onError) => activeRepo().subscribeToLinks(onData, onError),
  getLinkByToken: async (tokenId) => {
    // Check local demo/master-password links first if present, else query Firestore directly
    const localMatch = await localRepo.getLinkByToken(tokenId);
    if (localMatch) {
      setPersistenceMode('local');
      return localMatch;
    }
    const fbMatch = await firebaseRepo.getLinkByToken(tokenId);
    if (fbMatch) {
      setPersistenceMode('firebase');
      return fbMatch;
    }
    return null;
  },
  createServiceLink: (input) => activeRepo().createServiceLink(input),
  updateLinkStatus: (tokenId, patch) => activeRepo().updateLinkStatus(tokenId, patch),
  deleteServiceLink: (link) => activeRepo().deleteServiceLink(link),
  uploadSignedPdf: (tokenId, file, fileName) => activeRepo().uploadSignedPdf(tokenId, file, fileName),
  ensureSeedData: () => activeRepo().ensureSeedData(),
};
