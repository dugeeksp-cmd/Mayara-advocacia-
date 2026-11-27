import type {
  HeaderProfile,
  SignerParty,
  TemplateTagField,
} from '../types/legal';

export const DEFAULT_LAWYER_SIGNER_NAME = 'Mayara Chagas Martins';
export const DEFAULT_LAWYER_SIGNER_DOCUMENT = 'OAB/RJ 229.359';
export const SAMPLE_CLIENT_SIGNER_NAME = 'Maria Aparecida da Silva (Exemplo)';
export const SAMPLE_CLIENT_SIGNER_CPF = '123.456.789-00';

export interface ResolvedSignerParty {
  id: string;
  name: string;
  document: string;
  role: string;
}

export function createSignerId(prefix = 'sig'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function buildDefaultLawyerSigner(
  header?: Pick<HeaderProfile, 'oabNumber'> | null
): SignerParty {
  return {
    id: 'signer_lawyer_default',
    kind: 'lawyer',
    name: DEFAULT_LAWYER_SIGNER_NAME,
    document: (header?.oabNumber || '').trim() || DEFAULT_LAWYER_SIGNER_DOCUMENT,
    role: 'Advogada / Outorgada',
  };
}

export function buildDefaultClientSigner(): SignerParty {
  return {
    id: 'signer_client_default',
    kind: 'client',
    name: '{{NOME_COMPLETO}}',
    document: 'CPF {{CPF}}',
    role: 'Outorgante / Contratante',
  };
}

export function buildDefaultTemplateSigners(
  header?: Pick<HeaderProfile, 'oabNumber'> | null
): SignerParty[] {
  return [buildDefaultLawyerSigner(header), buildDefaultClientSigner()];
}

export function normalizeSignerList(signers?: SignerParty[] | null): SignerParty[] {
  if (!Array.isArray(signers)) return [];
  return signers
    .slice(0, 12)
    .map((s, idx) => ({
      id:
        typeof s?.id === 'string' && s.id.trim().length > 0
          ? s.id.trim().slice(0, 64)
          : `signer_${idx + 1}`,
      kind:
        s?.kind === 'lawyer' || s?.kind === 'client' || s?.kind === 'custom'
          ? s.kind
          : 'custom',
      name: typeof s?.name === 'string' ? s.name.trim().slice(0, 160) : '',
      document: typeof s?.document === 'string' ? s.document.trim().slice(0, 100) : '',
      role: typeof s?.role === 'string' ? s.role.trim().slice(0, 80) : '',
    }))
    .filter((s) => s.name.length > 0 || s.document.length > 0 || s.role.length > 0);
}

export function resolveTemplateDocumentTitle(template: {
  title: string;
  documentTitle?: string | null;
}): string {
  const custom = (template.documentTitle || '').trim();
  return custom.length > 0 ? custom : template.title;
}

export function resolveSignersForDocument(params: {
  signers?: SignerParty[] | null;
  clientName: string;
  clientCpf?: string;
  header?: Pick<HeaderProfile, 'oabNumber'> | null;
  sampleMode?: boolean;
}): ResolvedSignerParty[] {
  const { signers, clientName, clientCpf = '', header, sampleMode = false } = params;

  const baseSigners =
    Array.isArray(signers) && signers.length > 0
      ? normalizeSignerList(signers)
      : buildDefaultTemplateSigners(header);

  const effectiveName = sampleMode
    ? clientName.trim() || SAMPLE_CLIENT_SIGNER_NAME
    : clientName.trim() || 'Cliente';
  const effectiveCpf = sampleMode
    ? clientCpf.trim() || SAMPLE_CLIENT_SIGNER_CPF
    : clientCpf.trim();
  const effectiveOab = (header?.oabNumber || '').trim() || DEFAULT_LAWYER_SIGNER_DOCUMENT;

  const resolved: ResolvedSignerParty[] = [];

  for (const s of baseSigners) {
    let name = s.name;
    let document = s.document;
    const role = s.role.trim();

    name = name
      .split('{{NOME_COMPLETO}}')
      .join(effectiveName)
      .split('{{CPF}}')
      .join(effectiveCpf)
      .split('{{OAB}}')
      .join(effectiveOab)
      .trim();

    if (s.kind === 'client' && (!name || name === '{{NOME_COMPLETO}}')) {
      name = effectiveName;
    }

    if (document.includes('{{CPF}}')) {
      document = effectiveCpf
        ? document.split('{{CPF}}').join(effectiveCpf).trim()
        : '';
    }
    if (document.includes('{{NOME_COMPLETO}}')) {
      document = document.split('{{NOME_COMPLETO}}').join(effectiveName).trim();
    }
    if (document.includes('{{OAB}}')) {
      document = document.split('{{OAB}}').join(effectiveOab).trim();
    }

    if (s.kind === 'client' && !document && effectiveCpf) {
      document = `CPF ${effectiveCpf}`;
    }

    if (!name && !document) continue;

    resolved.push({
      id: s.id,
      name: name || 'Assinante',
      document,
      role,
    });
  }

  if (resolved.length === 0) {
    resolved.push({
      id: 'signer_client_fallback',
      name: effectiveName,
      document: effectiveCpf ? `CPF ${effectiveCpf}` : '',
      role: '',
    });
  }

  return resolved;
}

/**
 * Ensures the CPF field always appears first at the top of client intake forms,
 * preserving the relative order of all remaining fields.
 */
export function sortTemplateFieldsCpfFirst(fields: TemplateTagField[]): TemplateTagField[] {
  const cpfFields: TemplateTagField[] = [];
  const otherFields: TemplateTagField[] = [];

  for (const field of fields) {
    if (field.key === 'CPF' || field.mask === 'cpf') {
      cpfFields.push(field);
    } else {
      otherFields.push(field);
    }
  }

  return [...cpfFields, ...otherFields];
}
