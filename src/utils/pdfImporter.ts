import * as pdfjsLib from 'pdfjs-dist';
import {
  classifyVerticalRegion,
  deriveTemplateTitleFromFilename,
  parseExtractedFooterLines,
  parseExtractedHeaderLines,
  reconstructParagraphsFromTokens,
  reconstructVisualLines,
  type ParsedFooterData,
  type ParsedHeaderData,
  type PdfTextToken,
} from './pdfImportParser';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface PdfImportOptions {
  extractText: boolean;
  extractHeader: boolean;
  extractFooter: boolean;
  extractLogo: boolean;
}

export interface PdfImportResult {
  suggestedTitle: string;
  bodyText: string;
  pageCount: number;
  headerData: ParsedHeaderData | null;
  footerData: ParsedFooterData | null;
  logoDataUrl: string | null;
}

type Matrix2D = [number, number, number, number, number, number];

function multiplyMatrix(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function scaleCanvasToPngDataUrl(
  sourceCanvas: HTMLCanvasElement,
  maxDim: number = 360
): string {
  const scale = Math.min(1, maxDim / Math.max(sourceCanvas.width, sourceCanvas.height));
  const width = Math.max(1, Math.round(sourceCanvas.width * scale));
  const height = Math.max(1, Math.round(sourceCanvas.height * scale));
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  if (!ctx) return sourceCanvas.toDataURL('image/png');
  ctx.drawImage(sourceCanvas, 0, 0, width, height);
  return out.toDataURL('image/png');
}

function rawPdfImageToDataUrl(imgObj: unknown): string | null {
  if (!imgObj || typeof imgObj !== 'object') return null;
  const record = imgObj as {
    width?: number;
    height?: number;
    kind?: number;
    bitmap?: ImageBitmap;
    data?: Uint8ClampedArray | Uint8Array;
  };

  if (record.bitmap && record.bitmap.width > 1 && record.bitmap.height > 1) {
    const canvas = document.createElement('canvas');
    canvas.width = record.bitmap.width;
    canvas.height = record.bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(record.bitmap, 0, 0);
    return scaleCanvasToPngDataUrl(canvas, 360);
  }

  const width = record.width ?? 0;
  const height = record.height ?? 0;
  const raw = record.data;
  if (!raw || width <= 1 || height <= 1) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const rgba = new Uint8ClampedArray(width * height * 4);
  if (raw.length === width * height * 4) {
    rgba.set(raw);
  } else if (raw.length === width * height * 3) {
    for (let i = 0, j = 0; i < raw.length; i += 3, j += 4) {
      rgba[j] = raw[i];
      rgba[j + 1] = raw[i + 1];
      rgba[j + 2] = raw[i + 2];
      rgba[j + 3] = 255;
    }
  } else if (raw.length === width * height) {
    for (let i = 0, j = 0; i < raw.length; i += 1, j += 4) {
      const v = raw[i];
      rgba[j] = v;
      rgba[j + 1] = v;
      rgba[j + 2] = v;
      rgba[j + 3] = 255;
    }
  } else {
    return null;
  }

  const imageData = new ImageData(rgba, width, height);
  ctx.putImageData(imageData, 0, 0);
  return scaleCanvasToPngDataUrl(canvas, 360);
}

function cropBoundingBoxFromCanvas(
  renderedCanvas: HTMLCanvasElement,
  viewport: pdfjsLib.PageViewport,
  pdfMinX: number,
  pdfMinY: number,
  pdfMaxX: number,
  pdfMaxY: number
): string | null {
  const [x1, y1] = viewport.convertToViewportPoint(pdfMinX, pdfMaxY);
  const [x2, y2] = viewport.convertToViewportPoint(pdfMaxX, pdfMinY);

  const left = Math.max(0, Math.floor(Math.min(x1, x2)));
  const top = Math.max(0, Math.floor(Math.min(y1, y2)));
  const right = Math.min(renderedCanvas.width, Math.ceil(Math.max(x1, x2)));
  const bottom = Math.min(renderedCanvas.height, Math.ceil(Math.max(y1, y2)));
  const w = right - left;
  const h = bottom - top;

  if (w < 16 || h < 16) return null;
  // Ignore full-page background scans
  if (w > renderedCanvas.width * 0.85 && h > renderedCanvas.height * 0.85) {
    return null;
  }

  const crop = document.createElement('canvas');
  crop.width = w;
  crop.height = h;
  const ctx = crop.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(renderedCanvas, left, top, w, h, 0, 0, w, h);
  return scaleCanvasToPngDataUrl(crop, 360);
}

async function resolvePdfObject(
  store: { has: (id: string) => boolean; get: (id: string, cb?: (val: unknown) => void, errCb?: (err: unknown) => void) => unknown },
  objId: string,
  timeoutMs: number = 1500
): Promise<unknown> {
  if (store.has(objId)) {
    try {
      return store.get(objId);
    } catch {
      // fall through to callback
    }
  }
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    try {
      store.get(
        objId,
        (val: unknown) => {
          if (!settled) {
            settled = true;
            window.clearTimeout(timer);
            resolve(val);
          }
        },
        () => {
          if (!settled) {
            settled = true;
            window.clearTimeout(timer);
            resolve(null);
          }
        }
      );
    } catch {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

async function extractLogoFromFirstPage(
  page: pdfjsLib.PDFPageProxy
): Promise<string | null> {
  const baseViewport = page.getViewport({ scale: 1 });
  const opList = await page.getOperatorList();
  const ctmStack: Matrix2D[] = [];
  let ctm: Matrix2D = [1, 0, 0, 1, 0, 0];

  interface PendingImageOp {
    centerYRatio: number;
    objId: string | null;
    inlineData: unknown;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }

  const pendingOps: PendingImageOp[] = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (fn === pdfjsLib.OPS.save) {
      ctmStack.push([...ctm]);
    } else if (fn === pdfjsLib.OPS.restore) {
      ctm = ctmStack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (fn === pdfjsLib.OPS.transform && Array.isArray(args) && args.length >= 6) {
      ctm = multiplyMatrix(ctm, args as Matrix2D);
    } else if (
      fn === pdfjsLib.OPS.paintImageXObject ||
      fn === pdfjsLib.OPS.paintImageMaskXObject
    ) {
      const objId = typeof args?.[0] === 'string' ? args[0] : null;
      if (!objId) continue;

      const corners = [
        [ctm[4], ctm[5]],
        [ctm[0] + ctm[4], ctm[1] + ctm[5]],
        [ctm[2] + ctm[4], ctm[3] + ctm[5]],
        [ctm[0] + ctm[2] + ctm[4], ctm[1] + ctm[3] + ctm[5]],
      ];
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const boxW = maxX - minX;
      const boxH = maxY - minY;
      if (boxW < 10 || boxH < 10) continue;
      if (boxW > baseViewport.width * 0.85 && boxH > baseViewport.height * 0.85) continue;

      const centerY = (minY + maxY) / 2;
      const centerYRatio = centerY / Math.max(1, baseViewport.height);
      pendingOps.push({ centerYRatio, objId, inlineData: null, minX, minY, maxX, maxY });
    } else if (fn === pdfjsLib.OPS.paintInlineImageXObject && args?.[0]) {
      const centerYRatio = ctm[5] / Math.max(1, baseViewport.height);
      pendingOps.push({
        centerYRatio,
        objId: null,
        inlineData: args[0],
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
      });
    }
  }

  if (pendingOps.length === 0) {
    return null;
  }

  // Prefer images positioned in the upper area (letterhead), sorted highest first
  pendingOps.sort((a, b) => b.centerYRatio - a.centerYRatio);
  const orderedOps = [
    ...pendingOps.filter((op) => op.centerYRatio >= 0.65),
    ...pendingOps.filter((op) => op.centerYRatio < 0.65),
  ];

  // Try direct extraction via PDFObjects first (fast, no full-page render needed)
  for (const op of orderedOps) {
    if (op.inlineData) {
      const inlineUrl = rawPdfImageToDataUrl(op.inlineData);
      if (inlineUrl) return inlineUrl;
    } else if (op.objId) {
      const store = op.objId.startsWith('g_') ? page.commonObjs : page.objs;
      const imgObj = await resolvePdfObject(store, op.objId, 1500);
      const directUrl = rawPdfImageToDataUrl(imgObj);
      if (directUrl) return directUrl;
    }
  }

  // Lazy fallback: render page 1 once at scale 1.5 and crop the image bounding box
  const renderViewport = page.getViewport({ scale: 1.5 });
  const renderCanvas = document.createElement('canvas');
  renderCanvas.width = Math.ceil(renderViewport.width);
  renderCanvas.height = Math.ceil(renderViewport.height);
  await page.render({
    canvas: renderCanvas,
    viewport: renderViewport,
  }).promise;

  for (const op of orderedOps) {
    if (op.maxX > op.minX && op.maxY > op.minY) {
      const cropped = cropBoundingBoxFromCanvas(
        renderCanvas,
        renderViewport,
        op.minX,
        op.minY,
        op.maxX,
        op.maxY
      );
      if (cropped) return cropped;
    }
  }

  return null;
}

/**
 * Extracts text regions (header, body, footer) and optional logo strictly in browser RAM
 * using pdfjs-dist (Zero-Retention LGPD compliant).
 */
export async function extractPdfDocumentClientSide(
  file: File,
  options: PdfImportOptions
): Promise<PdfImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  try {
    const bodyParagraphsPerPage: string[] = [];
    const headerTokensFirstPage: PdfTextToken[] = [];
    let footerTokens: PdfTextToken[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();

      const pageBodyTokens: PdfTextToken[] = [];
      const pageFooterTokens: PdfTextToken[] = [];

      for (const item of textContent.items) {
        if (!('str' in item) || !item.str) continue;
        const transform = item.transform;
        const x = typeof transform?.[4] === 'number' ? transform[4] : 0;
        const y = typeof transform?.[5] === 'number' ? transform[5] : 0;
        const height =
          typeof item.height === 'number' && item.height > 0
            ? item.height
            : Math.abs(transform?.[3] ?? 10) || 10;
        const width = typeof item.width === 'number' ? item.width : 0;

        const token: PdfTextToken = {
          str: item.str,
          x,
          y,
          width,
          height,
          hasEOL: 'hasEOL' in item ? Boolean(item.hasEOL) : false,
        };

        const region = classifyVerticalRegion(y, viewport.height);
        if (region === 'header') {
          if (pageNumber === 1 && options.extractHeader) {
            headerTokensFirstPage.push(token);
          }
        } else if (region === 'footer') {
          if (options.extractFooter && footerTokens.length === 0) {
            pageFooterTokens.push(token);
          }
        } else if (options.extractText) {
          pageBodyTokens.push(token);
        }
      }

      if (footerTokens.length === 0 && pageFooterTokens.length > 0) {
        footerTokens = pageFooterTokens;
      }

      if (options.extractText && pageBodyTokens.length > 0) {
        const reconstructed = reconstructParagraphsFromTokens(pageBodyTokens);
        if (reconstructed) {
          bodyParagraphsPerPage.push(reconstructed);
        }
      }
    }

    let logoDataUrl: string | null = null;
    if (options.extractLogo && pdf.numPages >= 1) {
      const firstPage = await pdf.getPage(1);
      logoDataUrl = await extractLogoFromFirstPage(firstPage);
    }

    const headerData = options.extractHeader
      ? parseExtractedHeaderLines(reconstructVisualLines(headerTokensFirstPage))
      : null;

    const footerData = options.extractFooter
      ? parseExtractedFooterLines(reconstructVisualLines(footerTokens))
      : null;

    return {
      suggestedTitle: deriveTemplateTitleFromFilename(file.name),
      bodyText: bodyParagraphsPerPage.join('\n\n').trim(),
      pageCount: pdf.numPages,
      headerData,
      footerData,
      logoDataUrl,
    };
  } finally {
    await pdf.cleanup(false);
    await loadingTask.destroy();
  }
}
