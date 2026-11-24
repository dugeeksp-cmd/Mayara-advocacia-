import { jsPDF } from 'jspdf';
import type {
  FooterProfile,
  HeaderProfile,
  LetterheadSettings,
  LogoAsset,
  SignatureProvider,
} from '../types/legal';
import { sanitizeFilenamePart, sha256Hex } from './masksAndFormatters';
import {
  getFontOption,
  getSizeOption,
  hexToRgb,
} from './timbradoTheme';

export interface GeneratedPdfArtifact {
  blob: Blob;
  arrayBuffer: ArrayBuffer;
  fileName: string;
  sha256: string;
}

const BOLD_PREFIXES = [
  'OUTORGANTE:',
  'OUTORGADA:',
  'PODERES:',
  'CONTRATANTE:',
  'CONTRATADA:',
  'CLÁUSULA',
];

function drawResolvedHeader(
  doc: jsPDF,
  header: HeaderProfile | null,
  logo: LogoAsset | null,
  pageWidth: number,
  marginX: number
): number {
  // Subtle top navy accent bar
  doc.setFillColor(11, 29, 58); // #0B1D3A
  doc.rect(0, 0, pageWidth, 5.5, 'F');

  // If "Sem cabeçalho" AND "Sem logotipo", start body cleanly near top
  if (!header && !logo) {
    return 20;
  }

  const align = header?.alignment || 'center';
  const textX =
    align === 'left' ? marginX : align === 'right' ? pageWidth - marginX : pageWidth / 2;

  let textOffsetY = 19;
  if (logo?.dataUrl && logo.dataUrl.startsWith('data:image/')) {
    try {
      const imgFormat = logo.dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      const logoW = 16;
      const logoH = 16;
      const logoX =
        align === 'left'
          ? marginX
          : align === 'right'
            ? pageWidth - marginX - logoW
            : (pageWidth - logoW) / 2;
      doc.addImage(logo.dataUrl, imgFormat, logoX, 10, logoW, logoH);
      textOffsetY = 31;
    } catch {
      // Ignore malformed image
    }
  }

  if (!header) {
    return textOffsetY + 6;
  }

  const fontOpt = getFontOption(header.fontFamily);
  const sizeOpt = getSizeOption(header.textSize);
  const [r, g, b] = hexToRgb(header.textColor);

  // Office Title
  doc.setFont(fontOpt.pdfFamily, 'bold');
  doc.setFontSize(sizeOpt.headerTitlePdfPt);
  doc.setTextColor(r, g, b);
  doc.text(header.officeTitle.toUpperCase(), textX, textOffsetY, { align });

  // OAB & Subtitle
  doc.setFont(fontOpt.pdfFamily, 'bold');
  doc.setFontSize(sizeOpt.headerSubPdfPt);
  doc.setTextColor(154, 120, 53); // Matte Gold #9A7835
  const oabLine = header.subtitle
    ? `${header.oabNumber}  |  ${header.subtitle}`
    : header.oabNumber;
  doc.text(oabLine, textX, textOffsetY + 5.8, { align });

  const dividerY = textOffsetY + 10;
  doc.setDrawColor(184, 147, 74);
  doc.setLineWidth(0.6);
  doc.line(marginX, dividerY, pageWidth - marginX, dividerY);

  return dividerY + 8;
}

function drawResolvedFooter(
  doc: jsPDF,
  footer: FooterProfile | null,
  letterheadFallback: LetterheadSettings | undefined,
  pageWidth: number,
  pageHeight: number,
  marginX: number
): void {
  if (!footer) return;

  const footerTop = pageHeight - 23;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(marginX, footerTop, pageWidth - marginX, footerTop);

  if (letterheadFallback?.sealDataUrl && letterheadFallback.sealDataUrl.startsWith('data:image/')) {
    try {
      const imgFormat = letterheadFallback.sealDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(
        letterheadFallback.sealDataUrl,
        imgFormat,
        pageWidth - marginX - 12,
        footerTop + 2,
        12,
        12
      );
    } catch {
      // Ignore malformed seal
    }
  }

  const align = footer.alignment || 'center';
  const textX =
    align === 'left' ? marginX : align === 'right' ? pageWidth - marginX : pageWidth / 2;
  const fontOpt = getFontOption(footer.fontFamily);
  const sizeOpt = getSizeOption(footer.textSize);
  const [r, g, b] = hexToRgb(footer.textColor);

  doc.setFont(fontOpt.pdfFamily, 'normal');
  doc.setFontSize(sizeOpt.footerPdfPt);
  doc.setTextColor(r, g, b);
  doc.text(footer.addressFooter, textX, footerTop + 5.5, { align });

  const contactParts = [
    footer.phone ? `Tel/WhatsApp: ${footer.phone}` : '',
    footer.email ? `E-mail: ${footer.email}` : '',
    footer.instagram ? footer.instagram : '',
    footer.website ? footer.website : '',
  ].filter(Boolean);
  doc.text(contactParts.join('  |  '), textX, footerTop + 10.5, { align });
}

function legacyHeaderFromLetterhead(lh?: LetterheadSettings): HeaderProfile | null {
  if (!lh) return null;
  return {
    id: 'legacy_header',
    name: 'Cabeçalho Principal',
    officeTitle: lh.officeTitle,
    oabNumber: lh.oabNumber,
    subtitle: lh.subtitle || '',
    alignment: lh.headerAlignment || 'center',
    fontFamily: 'playfair',
    textSize: 'medium',
    textColor: '#0B1D3A',
    isDefault: true,
    createdAt: lh.updatedAt,
    updatedAt: lh.updatedAt,
    updatedBy: lh.updatedBy,
  };
}

function legacyFooterFromLetterhead(lh?: LetterheadSettings): FooterProfile | null {
  if (!lh) return null;
  return {
    id: 'legacy_footer',
    name: 'Rodapé Padrão',
    addressFooter: lh.addressFooter,
    phone: lh.phone,
    email: lh.email,
    instagram: lh.instagram || '',
    website: lh.website || '',
    alignment: 'center',
    fontFamily: 'inter',
    textSize: 'medium',
    textColor: '#475569',
    isDefault: true,
    createdAt: lh.updatedAt,
    updatedAt: lh.updatedAt,
    updatedBy: lh.updatedBy,
  };
}

function legacyLogoFromLetterhead(lh?: LetterheadSettings): LogoAsset | null {
  if (!lh?.logoDataUrl) return null;
  return {
    id: 'legacy_logo',
    name: 'Logomarca',
    dataUrl: lh.logoDataUrl,
    isDefault: true,
    createdAt: lh.updatedAt,
    updatedAt: lh.updatedAt,
    updatedBy: lh.updatedBy,
  };
}

export async function generateLegalDocumentPdf(params: {
  documentTitle: string;
  renderedText: string;
  letterhead?: LetterheadSettings;
  header?: HeaderProfile | null;
  footer?: FooterProfile | null;
  logo?: LogoAsset | null;
  clientName: string;
}): Promise<GeneratedPdfArtifact> {
  const { documentTitle, renderedText, letterhead, clientName } = params;
  const resolvedHeader =
    params.header !== undefined ? params.header : legacyHeaderFromLetterhead(letterhead);
  const resolvedFooter =
    params.footer !== undefined ? params.footer : legacyFooterFromLetterhead(letterhead);
  const resolvedLogo =
    params.logo !== undefined ? params.logo : legacyLogoFromLetterhead(letterhead);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 22;
  const contentWidth = pageWidth - marginX * 2;
  const maxBodyY = pageHeight - 36;

  let cursorY = drawResolvedHeader(doc, resolvedHeader, resolvedLogo, pageWidth, marginX);

  // Document Title
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(11, 29, 58);
  doc.text(documentTitle.toUpperCase(), pageWidth / 2, cursorY + 4, { align: 'center' });
  cursorY += 15;

  const paragraphs = renderedText.split(/\n\s*\n/);

  for (const rawParagraph of paragraphs) {
    const paragraph = rawParagraph.replace(/\s+/g, ' ').trim();
    if (!paragraph) continue;

    const matchedPrefix = BOLD_PREFIXES.find((prefix) => paragraph.startsWith(prefix));
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);

    const lines = doc.splitTextToSize(paragraph, contentWidth) as string[];
    const blockHeight = lines.length * 5.6 + 4;

    if (cursorY + blockHeight > maxBodyY) {
      drawResolvedFooter(doc, resolvedFooter, letterhead, pageWidth, pageHeight, marginX);
      doc.addPage();
      cursorY = drawResolvedHeader(doc, resolvedHeader, resolvedLogo, pageWidth, marginX);
      doc.setFont('times', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
    }

    if (matchedPrefix && lines.length > 0) {
      const colonIdx = lines[0].indexOf(':');
      if (colonIdx > 0 && colonIdx <= 24) {
        const prefixText = lines[0].slice(0, colonIdx + 1);
        const restFirstLine = lines[0].slice(colonIdx + 1);
        doc.setFont('times', 'bold');
        doc.text(prefixText, marginX, cursorY);
        const prefixWidth = doc.getTextWidth(prefixText);
        doc.setFont('times', 'normal');
        doc.text(restFirstLine, marginX + prefixWidth, cursorY);
        cursorY += 5.6;
        for (let i = 1; i < lines.length; i++) {
          doc.text(lines[i], marginX, cursorY);
          cursorY += 5.6;
        }
        cursorY += 4.5;
        continue;
      }
    }

    for (const line of lines) {
      doc.text(line, marginX, cursorY);
      cursorY += 5.6;
    }
    cursorY += 4.5;
  }

  // Ensure enough space for signature block (needs ~42mm)
  if (cursorY + 42 > maxBodyY) {
    drawResolvedFooter(doc, resolvedFooter, letterhead, pageWidth, pageHeight, marginX);
    doc.addPage();
    cursorY = drawResolvedHeader(doc, resolvedHeader, resolvedLogo, pageWidth, marginX) + 8;
  } else {
    cursorY += 10;
  }

  // Signature line & Gov.br / Electronic seal reservation box
  const sigLineWidth = 96;
  const sigStartX = (pageWidth - sigLineWidth) / 2;

  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.roundedRect(sigStartX - 8, cursorY, sigLineWidth + 16, 22, 2, 2, 'S');
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Área reservada para Assinatura Eletrônica (Gov.br / Clicksign / DocuSign)',
    pageWidth / 2,
    cursorY + 5,
    { align: 'center' }
  );

  doc.setDrawColor(11, 29, 58);
  doc.setLineWidth(0.4);
  doc.line(sigStartX, cursorY + 15, sigStartX + sigLineWidth, cursorY + 15);

  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 29, 58);
  doc.text(clientName.toUpperCase(), pageWidth / 2, cursorY + 19.5, { align: 'center' });

  drawResolvedFooter(doc, resolvedFooter, letterhead, pageWidth, pageHeight, marginX);

  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const sha256 = await sha256Hex(arrayBuffer);

  const safeDoc = sanitizeFilenamePart(documentTitle);
  const safeClient = sanitizeFilenamePart(clientName);
  const fileName = `${safeDoc}_${safeClient}.pdf`;

  return {
    blob,
    arrayBuffer,
    fileName,
    sha256,
  };
}

/**
 * Generates an electronically signed PDF containing the original document content
 * plus an embedded MP 2.200-2/2001 digital signature seal & audit certificate.
 */
export async function generateSignedDocumentPdf(params: {
  documentTitle: string;
  renderedText: string;
  letterhead?: LetterheadSettings;
  header?: HeaderProfile | null;
  footer?: FooterProfile | null;
  logo?: LogoAsset | null;
  clientName: string;
  provider: SignatureProvider;
  envelopeId: string;
  documentHash: string;
  auditHash: string;
  signedAtIso: string;
  signatureDataUrl?: string;
}): Promise<GeneratedPdfArtifact> {
  const {
    documentTitle,
    renderedText,
    letterhead,
    clientName,
    provider,
    envelopeId,
    documentHash,
    auditHash,
    signedAtIso,
    signatureDataUrl,
  } = params;

  const resolvedHeader =
    params.header !== undefined ? params.header : legacyHeaderFromLetterhead(letterhead);
  const resolvedFooter =
    params.footer !== undefined ? params.footer : legacyFooterFromLetterhead(letterhead);
  const resolvedLogo =
    params.logo !== undefined ? params.logo : legacyLogoFromLetterhead(letterhead);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 22;
  const contentWidth = pageWidth - marginX * 2;
  const maxBodyY = pageHeight - 36;

  let cursorY = drawResolvedHeader(doc, resolvedHeader, resolvedLogo, pageWidth, marginX);

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(11, 29, 58);
  doc.text(documentTitle.toUpperCase(), pageWidth / 2, cursorY + 4, { align: 'center' });
  cursorY += 15;

  const paragraphs = renderedText.split(/\n\s*\n/);
  for (const rawParagraph of paragraphs) {
    const paragraph = rawParagraph.replace(/\s+/g, ' ').trim();
    if (!paragraph) continue;

    const matchedPrefix = BOLD_PREFIXES.find((prefix) => paragraph.startsWith(prefix));
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);

    const lines = doc.splitTextToSize(paragraph, contentWidth) as string[];
    const blockHeight = lines.length * 5.6 + 4;

    if (cursorY + blockHeight > maxBodyY) {
      drawResolvedFooter(doc, resolvedFooter, letterhead, pageWidth, pageHeight, marginX);
      doc.addPage();
      cursorY = drawResolvedHeader(doc, resolvedHeader, resolvedLogo, pageWidth, marginX);
    }

    if (matchedPrefix && lines.length > 0) {
      const colonIdx = lines[0].indexOf(':');
      if (colonIdx > 0 && colonIdx <= 24) {
        const prefixText = lines[0].slice(0, colonIdx + 1);
        const restFirstLine = lines[0].slice(colonIdx + 1);
        doc.setFont('times', 'bold');
        doc.text(prefixText, marginX, cursorY);
        const prefixWidth = doc.getTextWidth(prefixText);
        doc.setFont('times', 'normal');
        doc.text(restFirstLine, marginX + prefixWidth, cursorY);
        cursorY += 5.6;
        for (let i = 1; i < lines.length; i++) {
          doc.text(lines[i], marginX, cursorY);
          cursorY += 5.6;
        }
        cursorY += 4.5;
        continue;
      }
    }

    for (const line of lines) {
      doc.text(line, marginX, cursorY);
      cursorY += 5.6;
    }
    cursorY += 4.5;
  }

  // Embedded Electronic Signature Block
  if (cursorY + 52 > maxBodyY) {
    drawResolvedFooter(doc, resolvedFooter, letterhead, pageWidth, pageHeight, marginX);
    doc.addPage();
    cursorY = drawResolvedHeader(doc, resolvedHeader, resolvedLogo, pageWidth, marginX) + 6;
  } else {
    cursorY += 8;
  }

  const providerLabel = provider === 'clicksign' ? 'Clicksign' : 'DocuSign';
  doc.setFillColor(247, 248, 250);
  doc.setDrawColor(11, 29, 58);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginX, cursorY, contentWidth, 42, 2, 2, 'FD');

  if (signatureDataUrl && signatureDataUrl.startsWith('data:image/png')) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', marginX + 6, cursorY + 4, 48, 16);
    } catch {
      // Skip image embedding if malformed
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(11, 29, 58);
  doc.text(`ASSINADO ELETRONICAMENTE VIA ${providerLabel.toUpperCase()}`, marginX + 60, cursorY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Signatário: ${clientName.toUpperCase()}`, marginX + 60, cursorY + 14);
  doc.text(`Envelope ID: ${envelopeId}`, marginX + 60, cursorY + 19);
  doc.text(`Data/Hora UTC: ${signedAtIso}`, marginX + 60, cursorY + 24);
  doc.text(`Hash Original (SHA-256): ${documentHash.slice(0, 36)}...`, marginX + 6, cursorY + 31);
  doc.text(`Hash Auditoria (MP 2.200-2/2001): ${auditHash.slice(0, 36)}...`, marginX + 6, cursorY + 36);

  drawResolvedFooter(doc, resolvedFooter, letterhead, pageWidth, pageHeight, marginX);

  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const sha256 = await sha256Hex(arrayBuffer);

  const safeDoc = sanitizeFilenamePart(documentTitle);
  const safeClient = sanitizeFilenamePart(clientName);
  const fileName = `${safeDoc}_${safeClient}_ASSINADO_${providerLabel.toUpperCase()}.pdf`;

  return {
    blob,
    arrayBuffer,
    fileName,
    sha256,
  };
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
