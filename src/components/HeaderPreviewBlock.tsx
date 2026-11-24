import type {
  HeaderAlignment,
  HeaderProfile,
  LogoAsset,
} from '../types/legal';
import { resolveHeaderLayout } from '../utils/headerLayout';
import {
  getFontOption,
  getSizeOption,
  normalizeHexColor,
} from '../utils/timbradoTheme';

interface HeaderPreviewBlockProps {
  header: Pick<
    HeaderProfile,
    | 'officeTitle'
    | 'oabNumber'
    | 'subtitle'
    | 'alignment'
    | 'logoPosition'
    | 'textPosition'
    | 'fontFamily'
    | 'textSize'
    | 'textColor'
  >;
  logo?: LogoAsset | null;
  showLogoPlaceholderIfEmpty?: boolean;
  paddingClass?: string;
  showSkeletonBody?: boolean;
}

function textAlignClass(align: HeaderAlignment): string {
  if (align === 'left') return 'text-left';
  if (align === 'right') return 'text-right';
  return 'text-center';
}

function logoJustifyClass(pos: 'left' | 'center' | 'right'): string {
  if (pos === 'left') return 'justify-start';
  if (pos === 'right') return 'justify-end';
  return 'justify-center';
}

export function HeaderPreviewBlock({
  header,
  logo,
  showLogoPlaceholderIfEmpty = false,
  paddingClass = 'p-6',
  showSkeletonBody = false,
}: HeaderPreviewBlockProps) {
  const fontOpt = getFontOption(header.fontFamily);
  const sizeOpt = getSizeOption(header.textSize);
  const colorHex = normalizeHexColor(header.textColor, '#0B1D3A');
  const layout = resolveHeaderLayout(header);

  const hasImage = Boolean(logo?.dataUrl);
  const renderLogo = hasImage || showLogoPlaceholderIfEmpty;

  const logoElement = hasImage && logo?.dataUrl ? (
    <img
      src={logo.dataUrl}
      alt={logo.name || 'Logotipo'}
      className="h-12 w-auto max-w-[120px] object-contain shrink-0"
    />
  ) : showLogoPlaceholderIfEmpty ? (
    <div
      className="h-12 w-12 rounded-lg border border-dashed border-[#B8934A] bg-[#F7F1E3]/60 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-[#9A7835] shrink-0"
      aria-label="Posição da logomarca"
    >
      Logo
    </div>
  ) : null;

  const effectiveBesideAlign: HeaderAlignment =
    layout.logoPosition === 'center' && layout.textAlignment === 'center'
      ? 'left'
      : layout.textAlignment;

  const textBlock = (alignOverride?: HeaderAlignment) => {
    const activeAlign = alignOverride || layout.textAlignment;
    return (
      <div className={`min-w-0 ${textAlignClass(activeAlign)}`}>
        <p
          className="font-bold uppercase leading-snug"
          style={{
            fontSize: `${sizeOpt.headerTitleCssPx}px`,
            color: colorHex,
          }}
        >
          {header.officeTitle || 'TÍTULO DO ESCRITÓRIO'}
        </p>
        <p
          className="font-semibold text-[#9A7835] mt-1"
          style={{ fontSize: `${sizeOpt.headerSubCssPx}px` }}
        >
          {header.oabNumber}
          {header.subtitle ? ` | ${header.subtitle}` : ''}
        </p>
      </div>
    );
  };

  return (
    <div className={paddingClass} style={{ fontFamily: fontOpt.cssFamily }}>
      {layout.textPosition === 'beside' && renderLogo ? (
        layout.logoPosition === 'center' ? (
          <div className="flex flex-row items-center justify-center gap-4">
            {logoElement}
            <div className="max-w-[72%]">{textBlock(effectiveBesideAlign)}</div>
          </div>
        ) : layout.logoPosition === 'right' ? (
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="flex-1 min-w-0">{textBlock(effectiveBesideAlign)}</div>
            {logoElement}
          </div>
        ) : (
          <div className="flex flex-row items-center justify-between gap-4">
            {logoElement}
            <div className="flex-1 min-w-0">{textBlock(effectiveBesideAlign)}</div>
          </div>
        )
      ) : layout.textPosition === 'above' ? (
        <div className="space-y-3">
          {textBlock()}
          {renderLogo && (
            <div className={`flex ${logoJustifyClass(layout.logoPosition)}`}>{logoElement}</div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {renderLogo && (
            <div className={`flex ${logoJustifyClass(layout.logoPosition)}`}>{logoElement}</div>
          )}
          {textBlock()}
        </div>
      )}

      <div className="h-0.5 bg-[#B8934A] mt-4" />

      {showSkeletonBody && (
        <div className="mt-5 space-y-2 opacity-30">
          <div className="h-2 bg-slate-300 rounded w-3/4 mx-auto" />
          <div className="h-2 bg-slate-200 rounded w-full" />
          <div className="h-2 bg-slate-200 rounded w-5/6" />
        </div>
      )}
    </div>
  );
}
