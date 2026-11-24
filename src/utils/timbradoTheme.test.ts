import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_FOOTERS,
  DEFAULT_HEADERS,
  deriveLetterheadFromProfiles,
  getFontOption,
  getSizeOption,
  hexToRgb,
  normalizeHexColor,
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
