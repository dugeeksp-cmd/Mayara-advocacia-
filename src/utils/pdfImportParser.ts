export type PdfVerticalRegion = 'header' | 'body' | 'footer';

export interface PdfTextToken {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL?: boolean;
}

export interface ParsedHeaderData {
  rawText: string;
  officeTitle?: string;
  oabNumber?: string;
  subtitle?: string;
}

export interface ParsedFooterData {
  rawText: string;
  addressFooter?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  website?: string;
}

/**
 * Derives a suggested template title from a PDF filename by stripping ".pdf".
 */
export function deriveTemplateTitleFromFilename(filename: string): string {
  const cleaned = filename.trim().replace(/\.pdf$/i, '').trim();
  return cleaned || 'Modelo Importado de PDF';
}

/**
 * Classifies a PDF text item into header (top ~14%), footer (bottom ~11%), or body.
 * PDF user-space coordinates have y=0 at the bottom of the page and y=pageHeight at the top.
 */
export function classifyVerticalRegion(y: number, pageHeight: number): PdfVerticalRegion {
  if (!Number.isFinite(pageHeight) || pageHeight <= 0) {
    return 'body';
  }
  const normalizedY = y / pageHeight;
  if (normalizedY >= 0.86) {
    return 'header';
  }
  if (normalizedY <= 0.11) {
    return 'footer';
  }
  return 'body';
}

interface GroupedLine {
  y: number;
  height: number;
  tokens: PdfTextToken[];
}

function joinLineTokens(tokens: PdfTextToken[]): string {
  const sorted = [...tokens].sort((a, b) => a.x - b.x);
  let line = '';
  let prevRight: number | null = null;

  for (const token of sorted) {
    const raw = token.str;
    if (!raw) continue;

    if (prevRight === null) {
      line = raw;
      prevRight = token.x + Math.max(0, token.width);
      continue;
    }

    const gap = token.x - prevRight;
    const needsSpace =
      gap > Math.max(1.5, token.height * 0.18) &&
      !line.endsWith(' ') &&
      !raw.startsWith(' ') &&
      !/^[,.;:!?)\]]/.test(raw);

    line += needsSpace ? ` ${raw}` : raw;
    prevRight = Math.max(prevRight, token.x + Math.max(0, token.width));
  }

  return line.replace(/\s+/g, ' ').trim();
}

/**
 * Groups positioned PDF text tokens into ordered visual lines.
 */
export function reconstructVisualLines(tokens: PdfTextToken[]): string[] {
  const nonEmpty = tokens.filter((t) => t.str && t.str.trim().length > 0);
  if (nonEmpty.length === 0) return [];

  const sortedByY = [...nonEmpty].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: GroupedLine[] = [];

  for (const token of sortedByY) {
    const tolerance = Math.max(3, (token.height || 10) * 0.45);
    const existing = lines.find((line) => Math.abs(line.y - token.y) <= tolerance);
    if (existing) {
      existing.tokens.push(token);
      existing.height = Math.max(existing.height, token.height || 10);
    } else {
      lines.push({
        y: token.y,
        height: token.height || 10,
        tokens: [token],
      });
    }
  }

  lines.sort((a, b) => b.y - a.y);

  return lines
    .map((line) => joinLineTokens(line.tokens))
    .filter((text) => text.length > 0);
}

/**
 * Reconstructs clean paragraphs from positioned PDF body tokens,
 * preserving paragraph breaks while unwrapping soft line wraps.
 */
export function reconstructParagraphsFromTokens(tokens: PdfTextToken[]): string {
  const nonEmpty = tokens.filter((t) => t.str && t.str.trim().length > 0);
  if (nonEmpty.length === 0) return '';

  const sortedByY = [...nonEmpty].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: GroupedLine[] = [];

  for (const token of sortedByY) {
    const tolerance = Math.max(3, (token.height || 10) * 0.45);
    const existing = lines.find((line) => Math.abs(line.y - token.y) <= tolerance);
    if (existing) {
      existing.tokens.push(token);
      existing.height = Math.max(existing.height, token.height || 10);
    } else {
      lines.push({
        y: token.y,
        height: token.height || 10,
        tokens: [token],
      });
    }
  }

  lines.sort((a, b) => b.y - a.y);

  const rendered = lines
    .map((line) => ({
      y: line.y,
      height: line.height,
      text: joinLineTokens(line.tokens),
    }))
    .filter((l) => l.text.length > 0);

  if (rendered.length === 0) return '';

  const lineGaps: number[] = [];
  for (let i = 1; i < rendered.length; i++) {
    const diff = rendered[i - 1].y - rendered[i].y;
    if (diff > 1) lineGaps.push(diff);
  }
  const sortedGaps = [...lineGaps].sort((a, b) => a - b);
  const medianGap =
    sortedGaps.length > 0
      ? sortedGaps[Math.floor(sortedGaps.length / 2)]
      : (rendered[0].height || 11) * 1.35;

  const paragraphs: string[] = [];
  let currentPara = rendered[0].text;

  for (let i = 1; i < rendered.length; i++) {
    const prev = rendered[i - 1];
    const curr = rendered[i];
    const gap = prev.y - curr.y;

    const isLargeVerticalBreak = gap > Math.max(medianGap * 1.4, (prev.height || 11) * 2.1);
    const prevLooksCompleteLine =
      /[.:;!?]$/.test(prev.text) &&
      prev.text.length < 68 &&
      /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9]/.test(curr.text);
    const currLooksHeadingOrClause =
      /^(OUTORGANTE|OUTORGADA|CONTRATANTE|CONTRATADA|PODERES|CL[ÁA]USULA|OBJETO|DO\s|DA\s|DOS\s|DAS\s|\d+[ªº.)\-]\s|I{1,3}V?\s*[-–])/i.test(
        curr.text
      );

    if (isLargeVerticalBreak || currLooksHeadingOrClause) {
      paragraphs.push(currentPara.trim());
      currentPara = curr.text;
    } else if (prevLooksCompleteLine) {
      paragraphs.push(currentPara.trim());
      currentPara = curr.text;
    } else {
      currentPara = `${currentPara} ${curr.text}`;
    }
  }

  if (currentPara.trim()) {
    paragraphs.push(currentPara.trim());
  }

  return paragraphs.join('\n\n').trim();
}

/**
 * Extracts structured office header metadata from header region lines.
 */
export function parseExtractedHeaderLines(lines: string[]): ParsedHeaderData | null {
  const cleaned = lines.map((l) => l.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;

  const rawText = cleaned.join('\n');
  let oabNumber: string | undefined;
  let officeTitle: string | undefined;
  const subtitleParts: string[] = [];

  for (const line of cleaned) {
    const oabMatch = line.match(/OAB\s*\/?\s*[A-Z]{2}\s*n?\.?[º°]?\s*[\d.\-]+/i);
    if (oabMatch && !oabNumber) {
      oabNumber = oabMatch[0].replace(/\s+/g, ' ').trim();
      const remainder = line
        .replace(oabMatch[0], '')
        .replace(/^[\s|·\-–]+|[\s|·\-–]+$/g, '')
        .trim();
      if (remainder) {
        subtitleParts.push(remainder);
      }
      continue;
    }

    if (!officeTitle) {
      officeTitle = line;
    } else {
      subtitleParts.push(line);
    }
  }

  return {
    rawText,
    officeTitle,
    oabNumber,
    subtitle: subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined,
  };
}

/**
 * Extracts structured office footer metadata from footer region lines,
 * filtering out standalone page numbers like "Página 1 de 2" or "1/2".
 */
export function parseExtractedFooterLines(lines: string[]): ParsedFooterData | null {
  const cleaned = lines
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^(p[áa]gina\s*\d+(\s*(de|\/)\s*\d+)?|\d+\s*\/\s*\d+|\d+)$/i.test(l));

  if (cleaned.length === 0) return null;

  const rawText = cleaned.join('\n');
  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = rawText.match(/(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/);
  const instaMatch = rawText.match(/(?:^|\s)(@[a-zA-Z0-9._]{2,})/);
  const websiteMatch = rawText.match(/(?:https?:\/\/|www\.)[^\s|]+/i);

  const addressLine = cleaned.find((line) =>
    /\b(rua|av\.?|avenida|travessa|pra[çc]a|estrada|rodovia|cep|loja|sala|bairro|centro|rj|sp|mg)\b/i.test(
      line
    )
  );

  let cleanedAddress = addressLine;
  if (cleanedAddress) {
    cleanedAddress = cleanedAddress
      .split('|')
      .map((part) => part.trim())
      .filter(
        (part) =>
          part.length > 0 &&
          (!emailMatch || !part.includes(emailMatch[0])) &&
          (!websiteMatch || !part.includes(websiteMatch[0]))
      )
      .join(' - ');
  }

  return {
    rawText,
    addressFooter: cleanedAddress || undefined,
    phone: phoneMatch ? phoneMatch[0].trim() : undefined,
    email: emailMatch ? emailMatch[0].trim() : undefined,
    instagram: instaMatch ? instaMatch[1].trim() : undefined,
    website: websiteMatch ? websiteMatch[0].trim() : undefined,
  };
}
