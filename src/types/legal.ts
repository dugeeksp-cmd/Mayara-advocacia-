export type SignatureProvider = 'clicksign' | 'docusign';
export type SignatureMethod = 'none' | 'govbr' | 'clicksign' | 'docusign';
export type ServiceLinkStatus = 'pendente' | 'assinando' | 'concluido';
export type HeaderAlignment = 'left' | 'center' | 'right';
export type CustomFieldType = 'text' | 'number' | 'date' | 'cpf_cnpj' | 'email' | 'phone';

export interface CustomTemplateField {
  key: string;
  tag: string;
  label: string;
  fieldType: CustomFieldType;
}

export interface LetterheadSettings {
  officeTitle: string;
  oabNumber: string;
  subtitle?: string;
  headerAlignment?: HeaderAlignment;
  addressFooter: string;
  phone: string;
  email: string;
  instagram?: string;
  website?: string;
  logoDataUrl?: string | null;
  sealDataUrl?: string | null;
  updatedAt: string;
  updatedBy: string;
}

export interface SignatureConfigSettings {
  defaultProvider: SignatureProvider;
  clicksignEnabled: boolean;
  docusignEnabled: boolean;
  govbrEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface DocumentTemplate {
  id: string;
  title: string;
  category: string;
  content: string;
  isDefault: boolean;
  customFields?: CustomTemplateField[];
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceLink {
  tokenId: string;
  clientName: string;
  whatsapp: string;
  pin: string;
  templateId: string;
  templateTitle: string;
  status: ServiceLinkStatus;
  signatureMethod: SignatureMethod;
  signatureEnvelopeId?: string | null;
  signatureAuditHash?: string | null;
  signedPdfUrl?: string | null;
  signedPdfStoragePath?: string | null;
  signedPdfName?: string | null;
  ownerUid: string;
  createdAt: string;
  completedAt?: string | null;
}

export type FieldMaskType = 'none' | 'cpf' | 'cpf_cnpj' | 'rg' | 'cep' | 'email' | 'phone';

export interface TemplateTagField {
  key: string;
  rawToken: string;
  label: string;
  placeholder: string;
  type: 'text' | 'email' | 'number' | 'date';
  mask: FieldMaskType;
  fieldType?: CustomFieldType;
  isAddressComposite?: boolean;
  isCustom?: boolean;
}

export interface SignatureEnvelope {
  envelopeId: string;
  provider: SignatureProvider;
  status: 'awaiting_signature' | 'signed' | 'failed';
  mode: 'live' | 'sandbox';
  documentHash: string;
  signingUrl?: string;
  signerName: string;
  signedAt?: string;
  auditHash?: string;
  signatureDataUrl?: string;
}

export interface SignatureServerConfig {
  clicksignConfigured: boolean;
  docusignConfigured: boolean;
  clicksignEnv: string;
}
