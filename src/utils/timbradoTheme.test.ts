import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BODY_FONT_MAX_PX,
  BODY_FONT_MIN_PX,
  bodyPxToPdfPt,
  clampPx,
  DEFAULT_BODY_FONT_PX,
  DEFAULT_FOOTERS,
  DEFAULT_HEADERS,
  DEFAULT_LOGO_SIZE_PX,
  deriveLetterheadFromProfiles,
  FOOTER_FONT_MAX_PX,
  FOOTER_FONT_MIN_PX,
  footerPxToPdfPt,
  getFontOption,
  getSizeOption,
  HEADER_FONT_MAX_PX,
  HEADER_FONT_MIN_PX,
  headerPxToPdfPt,
  hexToRgb,
  LOGO_SIZE_MAX_PX,
  LOGO_SIZE_MIN_PX,
  logoPxToPdfTargetWidthMm,
  normalizeHexColor,
  pxToLegacyTextSize,
  resolveFooterFontSizePx,
  resolveHeaderFontSizePx,
  resolveHeaderLogoSizePx,
  resolveHeaderSubFontSizePx,
  resolveTemplateBodyFontSizePx,
  resolveTemplateTimbrado,
} from './timbradoTheme.ts';
import { DEFAULT_LETTERHEAD } from './templateEngine.ts';
import type { LogoAsset } from '../types/legal.ts';

test('hexToRgb parses 6-digit and 3-digit hex colors with safe fallback', () => {
  assert.deepEqual(hexToRgb('#0B1D3A'), [11, 29, 58]);
  assert.deepEqual(hexToRgb('#fff'), [255, 255, 255]);
  assert.deepEqual(hexToRgb('invalid'), [11, 29, 58]);
  assert.equal(normalizeHexColor('#a1b2c3'), '#A1B2C3');
});

test('getFontOption and getSizeOption return deterministic PDF and CSS mappings', () => {
  assert.equal(getFontOption('montserrat').pdfFamily, 'helvetica');
  assert.equal(getFontOption('lora').pdfFamily, 'times');
  assert.equal(getSizeOption('large').headerTitlePdfPt, 14.5);
  assert.equal(getSizeOption('small').footerPdfPt, 7);
});

test('pixel clamping and legacy textSize fallbacks work deterministically', () => {
  assert.equal(clampPx(5, HEADER_FONT_MIN_PX, HEADER_FONT_MAX_PX, 14), 8);
  assert.equal(clampPx(99, HEADER_FONT_MIN_PX, HEADER_FONT_MAX_PX, 14), 36);
  assert.equal(clampPx(18.6, BODY_FONT_MIN_PX, BODY_FONT_MAX_PX, 14), 19);
  assert.equal(clampPx(Number.NaN, 10, 20, DEFAULT_BODY_FONT_PX), 14);

  assert.equal(resolveHeaderFontSizePx({ textSize: 'small' }), 12);
  assert.equal(resolveHeaderFontSizePx({ textSize: 'large' }), 17);
  assert.equal(resolveHeaderFontSizePx({ fontSizePx: 22, textSize: 'small' }), 22);
  assert.equal(resolveHeaderSubFontSizePx(20), 16);

  assert.equal(resolveHeaderLogoSizePx(null), DEFAULT_LOGO_SIZE_PX);
  assert.equal(resolveHeaderLogoSizePx({ logoSizePx: 25 }), LOGO_SIZE_MIN_PX);
  assert.equal(resolveHeaderLogoSizePx({ logoSizePx: 500 }), LOGO_SIZE_MAX_PX);
  assert.equal(resolveHeaderLogoSizePx({ logoSizePx: 185 }), 185);

  assert.equal(resolveFooterFontSizePx({ textSize: 'small' }), 10);
  assert.equal(resolveFooterFontSizePx({ fontSizePx: 42 }), FOOTER_FONT_MAX_PX);
  assert.equal(resolveFooterFontSizePx({ fontSizePx: 2 }), FOOTER_FONT_MIN_PX);

  assert.equal(resolveTemplateBodyFontSizePx(undefined), DEFAULT_BODY_FONT_PX);
  assert.equal(resolveTemplateBodyFontSizePx({ bodyFontSizePx: 18 }), 18);
  assert.equal(pxToLegacyTextSize(11), 'small');
  assert.equal(pxToLegacyTextSize(14), 'medium');
  assert.equal(pxToLegacyTextSize(19), 'large');
});

test('pixel-to-PDF conversion helpers produce proportional point and millimeter dimensions', () => {
  const hdrPts = headerPxToPdfPt(20);
  assert.ok(hdrPts.titlePt > hdrPts.subPt);
  assert.ok(footerPxToPdfPt(16) > footerPxToPdfPt(10));
  assert.ok(bodyPxToPdfPt(18) > bodyPxToPdfPt(12));
  assert.ok(logoPxToPdfTargetWidthMm(200) > logoPxToPdfTargetWidthMm(80));
  assert.ok(logoPxToPdfTargetWidthMm(350, 70) <= 70);
});

test('resolveTemplateTimbrado honors explicit null ("Sem cabeçalho/rodapé/logotipo")', () => {
  const logos: LogoAsset[] = [
    {
      id: 'logo_1',
      name: 'Logo Horizontal',
      dataUrl: 'data:image/png;base64,AAAA',
      isDefault: true,
      createdAt: '2026-11-24T00:00:00.000Z',
      updatedAt: '2026-11-24T00:00:00.000Z',
      updatedBy: 'admin',
    },
  ];

  const resolved = resolveTemplateTimbrado({
    template: { headerId: null, footerId: null, logoId: null },
    headers: DEFAULT_HEADERS,
    footers: DEFAULT_FOOTERS,
    logos,
    fallbackLetterhead: DEFAULT_LETTERHEAD,
  });

  assert.equal(resolved.header, null);
  assert.equal(resolved.footer, null);
  assert.equal(resolved.logo, null);
});

test('resolveTemplateTimbrado selects bound profiles or falls back to defaults', () => {
  const logos: LogoAsset[] = [
    {
      id: 'logo_1',
      name: 'Logo Principal',
      dataUrl: 'data:image/png;base64,AAAA',
      isDefault: true,
      createdAt: '2026-11-24T00:00:00.000Z',
      updatedAt: '2026-11-24T00:00:00.000Z',
      updatedBy: 'admin',
    },
    {
      id: 'logo_2',
      name: 'Selo Quadrado',
      dataUrl: 'data:image/png;base64,BBBB',
      isDefault: false,
      createdAt: '2026-11-24T00:00:00.000Z',
      updatedAt: '2026-11-24T00:00:00.000Z',
      updatedBy: 'admin',
    },
  ];

  const customResolved = resolveTemplateTimbrado({
    template: { headerId: 'header_minimalista', footerId: 'footer_principal', logoId: 'logo_2' },
    headers: DEFAULT_HEADERS,
    footers: DEFAULT_FOOTERS,
    logos,
    fallbackLetterhead: DEFAULT_LETTERHEAD,
  });

  assert.equal(customResolved.header?.id, 'header_minimalista');
  assert.equal(customResolved.footer?.id, 'footer_principal');
  assert.equal(customResolved.logo?.id, 'logo_2');

  const defaultResolved = resolveTemplateTimbrado({
    template: {},
    headers: DEFAULT_HEADERS,
    footers: DEFAULT_FOOTERS,
    logos,
    fallbackLetterhead: DEFAULT_LETTERHEAD,
  });

  assert.equal(defaultResolved.header?.id, 'header_principal');
  assert.equal(defaultResolved.logo?.id, 'logo_1');
});

test('deriveLetterheadFromProfiles reflects default profiles', () => {
  const derived = deriveLetterheadFromProfiles({
    headers: DEFAULT_HEADERS,
    footers: DEFAULT_FOOTERS,
    logos: [],
    fallback: DEFAULT_LETTERHEAD,
  });
  assert.equal(derived.officeTitle, DEFAULT_HEADERS[0].officeTitle);
  assert.equal(derived.addressFooter, DEFAULT_FOOTERS[0].addressFooter);
});
