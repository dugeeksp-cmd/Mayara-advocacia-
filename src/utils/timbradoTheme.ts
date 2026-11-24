import type {
  DocumentTemplate,
  FooterProfile,
  HeaderProfile,
  LetterheadSettings,
  LogoAsset,
  TimbradoFontFamily,
  TimbradoTextSize,
} from '../types/legal';

export const OFFICE_SCOPE_ID = 'mayara_martins_oab_229359';

export interface TimbradoFontOption {
  id: TimbradoFontFamily;
  label: string;
  category: string;
  cssFamily: string;
  pdfFamily: 'times' | 'helvetica' | 'courier';
}

export const TIMBRADO_FONT_OPTIONS: TimbradoFontOption[] = [
  {
    id: 'playfair',
    label: 'Playfair Display',
    category: 'Editorial Clássica',
    cssFamily: "'Playfair Display', Georgia, serif",
    pdfFamily: 'times',
  },
  {
    id: 'inter',
    label: 'Inter / Plus Jakarta',
    category: 'Moderna Jurídica',
    cssFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
    pdfFamily: 'helvetica',
  },
  {
    id: 'times',
    label: 'Times New Roman',
    category: 'Tradicional Forense',
    cssFamily: "'Times New Roman', Times, serif",
    pdfFamily: 'times',
  },
  {
    id: 'georgia',
    label: 'Georgia',
    category: 'Serifa Elegante',
    cssFamily: 'Georgia, Cambria, serif',
    pdfFamily: 'times',
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    category: 'Geométrica Limpa',
    cssFamily: "'Montserrat', 'Plus Jakarta Sans', sans-serif",
    pdfFamily: 'helvetica',
  },
  {
    id: 'lora',
    label: 'Lora',
    category: 'Contemporânea Jurídica',
    cssFamily: "'Lora', Georgia, serif",
    pdfFamily: 'times',
  },
];

export interface TimbradoSizeOption {
  id: TimbradoTextSize;
  label: string;
  headerTitleCssPx: number;
  headerSubCssPx: number;
  headerTitlePdfPt: number;
  headerSubPdfPt: number;
  footerCssPx: number;
  footerPdfPt: number;
}

export const TIMBRADO_SIZE_OPTIONS: TimbradoSizeOption[] = [
  {
    id: 'small',
    label: 'Pequeno',
    headerTitleCssPx: 12,
    headerSubCssPx: 10,
    headerTitlePdfPt: 10.5,
    headerSubPdfPt: 8.5,
    footerCssPx: 10,
    footerPdfPt: 7,
  },
  {
    id: 'medium',
    label: 'Médio',
    headerTitleCssPx: 14,
    headerSubCssPx: 12,
    headerTitlePdfPt: 12.5,
    headerSubPdfPt: 9.5,
    footerCssPx: 11.5,
    footerPdfPt: 8,
  },
  {
    id: 'large',
    label: 'Grande',
    headerTitleCssPx: 17,
    headerSubCssPx: 13,
    headerTitlePdfPt: 14.5,
    headerSubPdfPt: 10.5,
    footerCssPx: 13,
    footerPdfPt: 9.5,
  },
];

export const TIMBRADO_COLOR_SWATCHES = [
  { hex: '#0B1D3A', label: 'Azul Marinho' },
  { hex: '#0F172A', label: 'Preto / Grafite' },
  { hex: '#9A7835', label: 'Dourado Fosco' },
  { hex: '#475569', label: 'Cinza Chumbo' },
] as const;

export const DEFAULT_HEADERS: HeaderProfile[] = [
  {
    id: 'header_principal',
    name: 'Cabeçalho Principal',
    officeTitle: 'MAYARA MARTINS — ADVOCACIA E CONSULTORIA JURÍDICA',
    oabNumber: 'OAB/RJ 229.359',
    subtitle: 'Subseção Saquarema · Seção do Estado do Rio de Janeiro',
    alignment: 'center',
    fontFamily: 'playfair',
    textSize: 'medium',
    textColor: '#0B1D3A',
    isDefault: true,
    officeId: OFFICE_SCOPE_ID,
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'header_minimalista',
    name: 'Cabeçalho Minimalista',
    officeTitle: 'MAYARA CHAGAS MARTINS | ADVOGADA',
    oabNumber: 'OAB/RJ 229.359',
    subtitle: '',
    alignment: 'left',
    fontFamily: 'inter',
    textSize: 'small',
    textColor: '#0F172A',
    isDefault: false,
    officeId: OFFICE_SCOPE_ID,
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
    updatedBy: 'system',
  },
];

export const DEFAULT_FOOTERS: FooterProfile[] = [
  {
    id: 'footer_principal',
    name: 'Rodapé Completo Saquarema',
    addressFooter: 'Rua Alfredo Menezes nº 720 - Loja 21 - Bacaxá, Saquarema/RJ - CEP 28994-675',
    phone: '(22) 99805-0980',
    email: 'maycmartinsadv@hotmail.com',
    instagram: '@mayaramartins_adv',
    website: '',
    alignment: 'center',
    fontFamily: 'inter',
    textSize: 'medium',
    textColor: '#475569',
    isDefault: true,
    officeId: OFFICE_SCOPE_ID,
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
    updatedBy: 'system',
  },
];

export const DEFAULT_LOGOS: LogoAsset[] = [];

export function getFontOption(fontFamily?: TimbradoFontFamily): TimbradoFontOption {
  return TIMBRADO_FONT_OPTIONS.find((f) => f.id === fontFamily) || TIMBRADO_FONT_OPTIONS[0];
}

export function getSizeOption(textSize?: TimbradoTextSize): TimbradoSizeOption {
  return TIMBRADO_SIZE_OPTIONS.find((s) => s.id === textSize) || TIMBRADO_SIZE_OPTIONS[1];
}

export function normalizeHexColor(color?: string | null, fallback = '#0B1D3A'): string {
  if (!color) return fallback;
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

export function hexToRgb(hex?: string | null): [number, number, number] {
  const normalized = normalizeHexColor(hex);
  const num = parseInt(normalized.slice(1), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export interface ResolvedTemplateTimbrado {
  header: HeaderProfile | null;
  footer: FooterProfile | null;
  logo: LogoAsset | null;
}

export function resolveTemplateTimbrado(params: {
  template?: Pick<DocumentTemplate, 'headerId' | 'footerId' | 'logoId'> | null;
  headers: HeaderProfile[];
  footers: FooterProfile[];
  logos: LogoAsset[];
  fallbackLetterhead?: LetterheadSettings;
}): ResolvedTemplateTimbrado {
  const { template, headers, footers, logos, fallbackLetterhead } = params;

  // Header resolution: explicit null means "Sem cabeçalho"
  let header: HeaderProfile | null = null;
  if (template?.headerId === null) {
    header = null;
  } else if (typeof template?.headerId === 'string' && template.headerId.length > 0) {
    header =
      headers.find((h) => h.id === template.headerId) ||
      headers.find((h) => h.isDefault) ||
      headers[0] ||
      null;
  } else {
    header = headers.find((h) => h.isDefault) || headers[0] || null;
  }

  if (!header && template?.headerId !== null && fallbackLetterhead) {
    header = {
      id: 'header_fallback',
      name: 'Cabeçalho Principal',
      officeTitle: fallbackLetterhead.officeTitle,
      oabNumber: fallbackLetterhead.oabNumber,
      subtitle: fallbackLetterhead.subtitle || '',
      alignment: fallbackLetterhead.headerAlignment || 'center',
      fontFamily: 'playfair',
      textSize: 'medium',
      textColor: '#0B1D3A',
      isDefault: true,
      officeId: OFFICE_SCOPE_ID,
      createdAt: fallbackLetterhead.updatedAt,
      updatedAt: fallbackLetterhead.updatedAt,
      updatedBy: fallbackLetterhead.updatedBy,
    };
  }

  // Footer resolution: explicit null means "Sem rodapé"
  let footer: FooterProfile | null = null;
  if (template?.footerId === null) {
    footer = null;
  } else if (typeof template?.footerId === 'string' && template.footerId.length > 0) {
    footer =
      footers.find((f) => f.id === template.footerId) ||
      footers.find((f) => f.isDefault) ||
      footers[0] ||
      null;
  } else {
    footer = footers.find((f) => f.isDefault) || footers[0] || null;
  }

  if (!footer && template?.footerId !== null && fallbackLetterhead) {
    footer = {
      id: 'footer_fallback',
      name: 'Rodapé Padrão',
      addressFooter: fallbackLetterhead.addressFooter,
      phone: fallbackLetterhead.phone,
      email: fallbackLetterhead.email,
      instagram: fallbackLetterhead.instagram || '',
      website: fallbackLetterhead.website || '',
      alignment: 'center',
      fontFamily: 'inter',
      textSize: 'medium',
      textColor: '#475569',
      isDefault: true,
      officeId: OFFICE_SCOPE_ID,
      createdAt: fallbackLetterhead.updatedAt,
      updatedAt: fallbackLetterhead.updatedAt,
      updatedBy: fallbackLetterhead.updatedBy,
    };
  }

  // Logo resolution: explicit null means "Sem logotipo"
  let logo: LogoAsset | null = null;
  if (template?.logoId === null) {
    logo = null;
  } else if (typeof template?.logoId === 'string' && template.logoId.length > 0) {
    logo =
      logos.find((l) => l.id === template.logoId) ||
      logos.find((l) => l.isDefault) ||
      logos[0] ||
      null;
  } else {
    logo = logos.find((l) => l.isDefault) || logos[0] || null;
  }

  if (!logo && template?.logoId !== null && fallbackLetterhead?.logoDataUrl) {
    logo = {
      id: 'logo_fallback',
      name: 'Logomarca do Escritório',
      formatLabel: 'Principal',
      dataUrl: fallbackLetterhead.logoDataUrl,
      isDefault: true,
      officeId: OFFICE_SCOPE_ID,
      createdAt: fallbackLetterhead.updatedAt,
      updatedAt: fallbackLetterhead.updatedAt,
      updatedBy: fallbackLetterhead.updatedBy,
    };
  }

  return { header, footer, logo };
}

export function deriveLetterheadFromProfiles(params: {
  headers: HeaderProfile[];
  footers: FooterProfile[];
  logos: LogoAsset[];
  fallback: LetterheadSettings;
}): LetterheadSettings {
  const { headers, footers, logos, fallback } = params;
  const defHeader = headers.find((h) => h.isDefault) || headers[0];
  const defFooter = footers.find((f) => f.isDefault) || footers[0];
  const defLogo = logos.find((l) => l.isDefault) || logos[0];

  return {
    ...fallback,
    officeTitle: defHeader ? defHeader.officeTitle : fallback.officeTitle,
    oabNumber: defHeader ? defHeader.oabNumber : fallback.oabNumber,
    subtitle: defHeader ? defHeader.subtitle || '' : fallback.subtitle,
    headerAlignment: defHeader ? defHeader.alignment : fallback.headerAlignment,
    addressFooter: defFooter ? defFooter.addressFooter : fallback.addressFooter,
    phone: defFooter ? defFooter.phone : fallback.phone,
    email: defFooter ? defFooter.email : fallback.email,
    instagram: defFooter ? defFooter.instagram || '' : fallback.instagram,
    website: defFooter ? defFooter.website || '' : fallback.website,
    logoDataUrl: defLogo ? defLogo.dataUrl : fallback.logoDataUrl ?? null,
  };
}
