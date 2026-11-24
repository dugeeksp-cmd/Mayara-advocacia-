import { jsPDF } from 'jspdf';
import type {
  FooterProfile,
  HeaderProfile,
  LetterheadSettings,
  LogoAsset,
} from '../types/legal';
import { sanitizeFilenamePart, sha256Hex } from './masksAndFormatters';
import {
  computeBesidePdfGeometry,
  resolveHeaderLayout,
} from './headerLayout';
import {
  bodyPxToPdfPt,
  DEFAULT_FOOTER_FONT_PX,
  DEFAULT_HEADER_FONT_PX,
  DEFAULT_LOGO_SIZE_PX,
  footerPxToPdfPt,
  getFontOption,
  headerPxToPdfPt,
  hexToRgb,
  logoPxToPdfTargetWidthMm,
  resolveFooterFontSizePx,
  resolveHeaderFontSizePx,
  resolveHeaderLogoSizePx,
  resolveTemplateBodyFontSizePx,
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

function computeLogoBoxDimensions(
  doc: jsPDF,
  dataUrl: string,
  targetWidthMm = 30,
  maxWidthMm = 95,
  maxHeightMm = 48
): { width: number; height: number; format: 'PNG' | 'JPEG' } {
  const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
  const clampedTargetW = Math.min(maxWidthMm, Math.max(8, targetWidthMm));
  try {
    const props = doc.getImageProperties(dataUrl);
    if (props?.width > 0 && props?.height > 0) {
      const ratio = props.width / props.height;
      let width = clampedTargetW;
      let height = width / ratio;
      if (height > maxHeightMm) {
        height = maxHeightMm;
        width = height * ratio;
      }
      if (width > maxWidthMm) {
        width = maxWidthMm;
        height = width / ratio;
      }
      return {
        width: Math.max(6, Number(width.toFixed(2))),
        height: Math.max(6, Number(height.toFixed(2))),
        format,
      };
    }
  } catch {
    // Fallback to square logo dimensions if image metadata unavailable
  }
  const side = Math.min(clampedTargetW, maxHeightMm);
  return { width: side, height: side, format };
}

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

  const contentWidth = pageWidth - marginX * 2;
  const layout = resolveHeaderLayout(header);
  const logoSizePx = resolveHeaderLogoSizePx(header);
  const isBeside = layout.textPosition === 'beside';
  const maxLogoW = isBeside ? contentWidth * 0.52 : contentWidth * 0.85;
  const maxLogoH = isBeside ? 40 : 48;
  const targetLogoW = logoPxToPdfTargetWidthMm(logoSizePx, maxLogoW);

  const hasLogo = Boolean(logo?.dataUrl && logo.dataUrl.startsWith('data:image/'));
  const logoDims =
    hasLogo && logo?.dataUrl
      ? computeLogoBoxDimensions(doc, logo.dataUrl, targetLogoW, maxLogoW, maxLogoH)
      : null;

  const logoAlignX = (logoW: number) =>
    layout.logoPosition === 'left'
      ? marginX
      : layout.logoPosition === 'right'
        ? pageWidth - marginX - logoW
        : (pageWidth - logoW) / 2;

  if (!header && logoDims && logo?.dataUrl) {
    try {
      doc.addImage(logo.dataUrl, logoDims.format, logoAlignX(logoDims.width), 10, logoDims.width, logoDims.height);
    } catch {
      // Ignore malformed image
    }
    return 10 + logoDims.height + 9;
  }

  if (!header) {
    return 20;
  }

  const fontOpt = getFontOption(header.fontFamily);
  const headerFontPx = resolveHeaderFontSizePx(header);
  const { titlePt, subPt } = headerPxToPdfPt(headerFontPx);
  const [r, g, b] = hexToRgb(header.textColor);
  const titleText = header.officeTitle.toUpperCase();
  const oabLine = header.subtitle
    ? `${header.oabNumber}  |  ${header.subtitle}`
    : header.oabNumber;

  const titleLineH = titlePt * 0.44 + 0.6;
  const subLineH = subPt * 0.44 + 0.5;
  const titleBaselineOffset = titlePt * 0.35;

  // HORIZONTAL 2-COLUMN LAYOUT ("beside") WHEN LOGO IS PRESENT
  if (layout.textPosition === 'beside' && hasLogo && logoDims && logo?.dataUrl) {
    const tentativeColW =
      layout.logoPosition === 'center'
        ? contentWidth - logoDims.width - 8
        : contentWidth - logoDims.width - 6;

    doc.setFont(fontOpt.pdfFamily, 'bold');
    doc.setFontSize(titlePt);
    const titleLines = doc.splitTextToSize(titleText, Math.max(40, tentativeColW)) as string[];
    const titleWidths = titleLines.map((line) => doc.getTextWidth(line));

    doc.setFont(fontOpt.pdfFamily, 'bold');
    doc.setFontSize(subPt);
    const subLines = doc.splitTextToSize(oabLine, Math.max(40, tentativeColW)) as string[];
    const subWidths = subLines.map((line) => doc.getTextWidth(line));

    const measuredTextWidth = Math.max(0, ...titleWidths, ...subWidths);
    const subGap = 1.6;
    const textBlockHeight =
      titleLines.length * titleLineH + subGap + subLines.length * subLineH;

    const geo = computeBesidePdfGeometry({
      pageWidth,
      marginX,
      topY: 10.5,
      logoW: logoDims.width,
      logoH: logoDims.height,
      logoPosition: layout.logoPosition,
      textAlignment: layout.textAlignment,
      textBlockHeight,
      measuredTextWidth,
    });

    try {
      doc.addImage(logo.dataUrl, logoDims.format, geo.logoX, geo.logoY, logoDims.width, logoDims.height);
    } catch {
      // Ignore malformed image
    }

    let cursorY = geo.firstTextTopY + titleBaselineOffset;
    doc.setFont(fontOpt.pdfFamily, 'bold');
    doc.setFontSize(titlePt);
    doc.setTextColor(r, g, b);
    for (const line of titleLines) {
      doc.text(line, geo.textAnchorX, cursorY, { align: geo.textAlign });
      cursorY += titleLineH;
    }

    cursorY += subGap;
    doc.setFont(fontOpt.pdfFamily, 'bold');
    doc.setFontSize(subPt);
    doc.setTextColor(154, 120, 53); // Matte Gold #9A7835
    for (const line of subLines) {
      doc.text(line, geo.textAnchorX, cursorY, { align: geo.textAlign });
      cursorY += subLineH;
    }

    doc.setDrawColor(184, 147, 74);
    doc.setLineWidth(0.6);
    doc.line(marginX, geo.dividerY, pageWidth - marginX, geo.dividerY);
    return geo.nextBodyY;
  }

  // VERTICAL STACKED LAYOUTS ("below" or "above")
  const textAlign = layout.textAlignment;
  const textX =
    textAlign === 'left'
      ? marginX
      : textAlign === 'right'
        ? pageWidth - marginX
        : pageWidth / 2;

  doc.setFont(fontOpt.pdfFamily, 'bold');
  doc.setFontSize(titlePt);
  const titleLines = doc.splitTextToSize(titleText, contentWidth) as string[];

  doc.setFont(fontOpt.pdfFamily, 'bold');
  doc.setFontSize(subPt);
  const subLines = doc.splitTextToSize(oabLine, contentWidth) as string[];

  let cursorY = 11;

  if (layout.textPosition === 'above') {
    cursorY += titleBaselineOffset + 1;
    doc.setFont(fontOpt.pdfFamily, 'bold');
    doc.setFontSize(titlePt);
    doc.setTextColor(r, g, b);
    for (const line of titleLines) {
      doc.text(line, textX, cursorY, { align: textAlign });
      cursorY += titleLineH;
    }

    cursorY += 1.2;
    doc.setFont(fontOpt.pdfFamily, 'bold');
    doc.setFontSize(subPt);
    doc.setTextColor(154, 120, 53);
    for (const line of subLines) {
      doc.text(line, textX, cursorY, { align: textAlign });
      cursorY += subLineH;
    }

    if (hasLogo && logoDims && logo?.dataUrl) {
      const imgY = cursorY + 1;
      try {
        doc.addImage(
          logo.dataUrl,
          logoDims.format,
          logoAlignX(logoDims.width),
          imgY,
          logoDims.width,
          logoDims.height
        );
      } catch {
        // Ignore malformed image
      }
      cursorY = imgY + logoDims.height + 4;
    } else {
      cursorY += 2.5;
    }
  } else {
    // Default: "below" (Image on top, text below)
    if (hasLogo && logoDims && logo?.dataUrl) {
      try {
        doc.addImage(
          logo.dataUrl,
          logoDims.format,
          logoAlignX(logoDims.width),
          10,
          logoDims.width,
          logoDims.height
        );
      } catch {
        // Ignore malformed image
      }
      cursorY = 10 + logoDims.height + 5.5;
    } else {
      cursorY = 17;
    }

    doc.setFont(fontOpt.pdfFamily, 'bold');
    doc.setFontSize(titlePt);
    doc.setTextColor(r, g, b);
    for (const line of titleLines) {
      doc.text(line, textX, cursorY, { align: textAlign });
      cursorY += titleLineH;
    }

    cursorY += 1.2;
    doc.setFont(fontOpt.pdfFamily, 'bold');
    doc.setFontSize(subPt);
    doc.setTextColor(154, 120, 53);
    for (const line of subLines) {
      doc.text(line, textX, cursorY, { align: textAlign });
      cursorY += subLineH;
    }
    cursorY += 2;
  }

  doc.setDrawColor(184, 147, 74);
  doc.setLineWidth(0.6);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);

  return cursorY + 8;
}

function resolveFooterReservedHeightMm(footer: FooterProfile | null): number {
  if (!footer) return 18;
  const footerPt = footerPxToPdfPt(resolveFooterFontSizePx(footer));
  return Math.max(23, Math.round(footerPt * 1.9 + 9));
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

  const fontOpt = getFontOption(footer.fontFamily);
  const footerPt = footerPxToPdfPt(resolveFooterFontSizePx(footer));
  const reservedH = resolveFooterReservedHeightMm(footer);
  const footerTop = pageHeight - reservedH;
  const lineStep = Math.max(4.5, Number((footerPt * 0.56).toFixed(1)));

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
  const [r, g, b] = hexToRgb(footer.textColor);

  doc.setFont(fontOpt.pdfFamily, 'normal');
  doc.setFontSize(footerPt);
  doc.setTextColor(r, g, b);
  doc.text(footer.addressFooter, textX, footerTop + 5.5, { align });

  const contactParts = [
    footer.phone ? `Tel/WhatsApp: ${footer.phone}` : '',
    footer.email ? `E-mail: ${footer.email}` : '',
    footer.instagram ? footer.instagram : '',
    footer.website ? footer.website : '',
  ].filter(Boolean);
  doc.text(contactParts.join('  |  '), textX, footerTop + 5.5 + lineStep, { align });
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
    fontSizePx: DEFAULT_HEADER_FONT_PX,
    logoSizePx: DEFAULT_LOGO_SIZE_PX,
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
    fontSizePx: DEFAULT_FOOTER_FONT_PX,
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
  bodyFontSizePx?: number;
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

  const bodyPx = resolveTemplateBodyFontSizePx({ bodyFontSizePx: params.bodyFontSizePx });
  const bodyPt = bodyPxToPdfPt(bodyPx);
  const bodyLineH = Number((bodyPt * 0.51).toFixed(2));
  const docTitlePt = Math.max(12, Number((bodyPt + 3).toFixed(1)));

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
  const maxBodyY = pageHeight - resolveFooterReservedHeightMm(resolvedFooter) - 10;

  let cursorY = drawResolvedHeader(doc, resolvedHeader, resolvedLogo, pageWidth, marginX);

  // Document Title
  doc.setFont('times', 'bold');
  doc.setFontSize(docTitlePt);
  doc.setTextColor(11, 29, 58);
  doc.text(documentTitle.toUpperCase(), pageWidth / 2, cursorY + 4, { align: 'center' });
  cursorY += 15;

  const paragraphs = renderedText.split(/\n\s*\n/);

  for (const rawParagraph of paragraphs) {
    const paragraph = rawParagraph.replace(/\s+/g, ' ').trim();
    if (!paragraph) continue;

    const matchedPrefix = BOLD_PREFIXES.find((prefix) => paragraph.startsWith(prefix));
    doc.setFont('times', 'normal');
    doc.setFontSize(bodyPt);
    doc.setTextColor(15, 23, 42);

    const lines = doc.splitTextToSize(paragraph, contentWidth) as string[];
    const blockHeight = lines.length * bodyLineH + 4;

    if (cursorY + blockHeight > maxBodyY) {
      drawResolvedFooter(doc, resolvedFooter, letterhead, pageWidth, pageHeight, marginX);
      doc.addPage();
      cursorY = drawResolvedHeader(doc, resolvedHeader, resolvedLogo, pageWidth, marginX);
      doc.setFont('times', 'normal');
      doc.setFontSize(bodyPt);
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
        cursorY += bodyLineH;
        for (let i = 1; i < lines.length; i++) {
          doc.text(lines[i], marginX, cursorY);
          cursorY += bodyLineH;
        }
        cursorY += 4.5;
        continue;
      }
    }

    for (const line of lines) {
      doc.text(line, marginX, cursorY);
      cursorY += bodyLineH;
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
    'Área reservada para Assinatura Eletrônica Gov.br (assinador.iti.br)',
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
