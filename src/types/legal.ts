export type SignatureMethod = 'none' | 'govbr';
export type ServiceLinkStatus = 'pendente' | 'assinando' | 'concluido';
export type HeaderAlignment = 'left' | 'center' | 'right';
export type HeaderLogoPosition = 'left' | 'center' | 'right';
export type HeaderTextPosition = 'below' | 'above' | 'beside';
export type CustomFieldType = 'text' | 'number' | 'date' | 'cpf_cnpj' | 'email' | 'phone';

export type TimbradoFontFamily =
  | 'playfair'
  | 'inter'
  | 'times'
  | 'georgia'
  | 'montserrat'
  | 'lora';

export type TimbradoTextSize = 'small' | 'medium' | 'large';

export interface CustomTemplateField {
  key: string;
  tag: string;
  label: string;
  fieldType: CustomFieldType;
}

export interface HeaderProfile {
  id: string;
  name: string;
  officeTitle: string;
  oabNumber: string;
  subtitle?: string;
  alignment: HeaderAlignment;
  logoPosition?: HeaderLogoPosition;
  textPosition?: HeaderTextPosition;
  fontFamily: TimbradoFontFamily;
  textSize: TimbradoTextSize;
  textColor: string;
  isDefault: boolean;
  officeId?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface FooterProfile {
  id: string;
  name: string;
  addressFooter: string;
  phone: string;
  email: string;
  instagram?: string;
  website?: string;
  alignment: HeaderAlignment;
  fontFamily: TimbradoFontFamily;
  textSize: TimbradoTextSize;
  textColor: string;
  isDefault: boolean;
  officeId?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface LogoAsset {
  id: string;
  name: string;
  formatLabel?: string;
  dataUrl: string;
  isDefault: boolean;
  officeId?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
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
  officeId?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SignatureConfigSettings {
  govbrEnabled: boolean;
  govbrPortalUrl: string;
  instructionsNote?: string;
  requireSignedUpload: boolean;
  officeId?: string;
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
  headerId?: string | null;
  footerId?: string | null;
  logoId?: string | null;
  officeId?: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientRecord {
  id: string;
  fullName: string;
  cpf: string;
  rg: string;
  email: string;
  whatsapp: string;
  address: string;
  nationality: string;
  maritalStatus: string;
  profession: string;
  officeId?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ChangelogChecklistState {
  version: string;
  checkedIds: string[];
  officeId?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ServiceLink {
  tokenId: string;
  clientId?: string | null;
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
  officeId?: string;
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
