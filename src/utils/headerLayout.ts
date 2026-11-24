import type {
  DocumentTemplate,
  HeaderAlignment,
  HeaderLogoPosition,
  HeaderProfile,
  HeaderTextPosition,
} from '../types/legal';

export interface ResolvedHeaderLayout {
  logoPosition: HeaderLogoPosition;
  textPosition: HeaderTextPosition;
  textAlignment: HeaderAlignment;
}

export function resolveHeaderLayout(
  header?: Pick<HeaderProfile, 'alignment' | 'logoPosition' | 'textPosition'> | null
): ResolvedHeaderLayout {
  const alignment: HeaderAlignment = header?.alignment || 'center';
  const logoPosition: HeaderLogoPosition = header?.logoPosition || alignment || 'center';
  const textPosition: HeaderTextPosition = header?.textPosition || 'below';
  return {
    logoPosition,
    textPosition,
    textAlignment: alignment,
  };
}

/**
 * Returns a natural text alignment when the user switches to horizontal ("beside")
 * layout or moves the logo to the left/right while in "beside" mode.
 * Example: logo on Left -> text aligns Right; logo on Right -> text aligns Left.
 */
export function getRecommendedTextAlignment(
  logoPosition: HeaderLogoPosition,
  textPosition: HeaderTextPosition,
  currentAlignment: HeaderAlignment
): HeaderAlignment {
  if (textPosition === 'beside') {
    if (logoPosition === 'left') return 'right';
    if (logoPosition === 'right') return 'left';
    return 'left';
  }
  return currentAlignment;
}

export interface PdfBesideRowGeometry {
  logoX: number;
  logoY: number;
  logoW: number;
  logoH: number;
  textColStartX: number;
  textColWidth: number;
  textAnchorX: number;
  textAlign: HeaderAlignment;
  firstTextTopY: number;
  dividerY: number;
  nextBodyY: number;
}

/**
 * Pure geometry calculator for PDF horizontal 2-column ("beside") header layout.
 * Vertically aligns both the logo and the multi-line text block around the same center line.
 */
export function computeBesidePdfGeometry(params: {
  pageWidth: number;
  marginX: number;
  topY: number;
  logoW: number;
  logoH: number;
  logoPosition: HeaderLogoPosition;
  textAlignment: HeaderAlignment;
  textBlockHeight: number;
  measuredTextWidth: number;
  gap?: number;
}): PdfBesideRowGeometry {
  const {
    pageWidth,
    marginX,
    topY,
    logoW,
    logoH,
    logoPosition,
    textAlignment,
    textBlockHeight,
    measuredTextWidth,
    gap = 6,
  } = params;

  const contentWidth = pageWidth - marginX * 2;
  const rowHeight = Math.max(logoH, textBlockHeight);
  const logoY = topY + (rowHeight - logoH) / 2;
  const firstTextTopY = topY + (rowHeight - textBlockHeight) / 2;

  let logoX = marginX;
  let textColStartX = marginX + logoW + gap;
  let textColWidth = Math.max(40, contentWidth - logoW - gap);
  let effectiveAlign: HeaderAlignment = textAlignment;

  if (logoPosition === 'right') {
    logoX = pageWidth - marginX - logoW;
    textColStartX = marginX;
    textColWidth = Math.max(40, contentWidth - logoW - gap);
  } else if (logoPosition === 'center') {
    const clampedTextW = Math.min(
      Math.max(40, contentWidth - logoW - gap),
      Math.max(40, measuredTextWidth)
    );
    const totalGroupW = logoW + gap + clampedTextW;
    const groupStartX = (pageWidth - totalGroupW) / 2;
    logoX = groupStartX;
    textColStartX = groupStartX + logoW + gap;
    textColWidth = clampedTextW;
    if (effectiveAlign === 'center') {
      effectiveAlign = 'left';
    }
  }

  let textAnchorX = textColStartX;
  if (effectiveAlign === 'center') {
    textAnchorX = textColStartX + textColWidth / 2;
  } else if (effectiveAlign === 'right') {
    textAnchorX = textColStartX + textColWidth;
  }

  const dividerY = topY + rowHeight + 4.5;
  return {
    logoX,
    logoY,
    logoW,
    logoH,
    textColStartX,
    textColWidth,
    textAnchorX,
    textAlign: effectiveAlign,
    firstTextTopY,
    dividerY,
    nextBodyY: dividerY + 8,
  };
}

export type BatchAssetType = 'header' | 'footer' | 'logo';

/**
 * Pure helper that updates ONLY the target asset link (`headerId`, `footerId`, or `logoId`)
 * on the selected DocumentTemplate records, leaving all unselected templates untouched.
 */
export function applyBatchAssetToTemplateList(
  templates: DocumentTemplate[],
  assetType: BatchAssetType,
  assetId: string,
  targetTemplateIds: string[],
  updatedAtIso: string
): DocumentTemplate[] {
  const idSet = new Set(targetTemplateIds);
  const fieldKey: 'headerId' | 'footerId' | 'logoId' =
    assetType === 'header' ? 'headerId' : assetType === 'footer' ? 'footerId' : 'logoId';

  return templates.map((tpl) => {
    if (!idSet.has(tpl.id)) return tpl;
    return {
      ...tpl,
      [fieldKey]: assetId,
      updatedAt: updatedAtIso,
    };
  });
}
