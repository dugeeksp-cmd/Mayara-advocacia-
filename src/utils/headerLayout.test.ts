import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocumentTemplate } from '../types/legal';
import {
  applyBatchAssetToTemplateList,
  computeBesidePdfGeometry,
  getRecommendedTextAlignment,
  resolveHeaderLayout,
} from './headerLayout';

test('resolveHeaderLayout defaults legacy headers cleanly to below and matches alignment', () => {
  const resolved = resolveHeaderLayout({ alignment: 'left' });
  assert.deepEqual(resolved, {
    logoPosition: 'left',
    textPosition: 'below',
    textAlignment: 'left',
  });

  const explicit = resolveHeaderLayout({
    alignment: 'right',
    logoPosition: 'left',
    textPosition: 'beside',
  });
  assert.deepEqual(explicit, {
    logoPosition: 'left',
    textPosition: 'beside',
    textAlignment: 'right',
  });
});

test('getRecommendedTextAlignment pairs left/right beside layouts naturally', () => {
  assert.equal(getRecommendedTextAlignment('left', 'beside', 'center'), 'right');
  assert.equal(getRecommendedTextAlignment('right', 'beside', 'center'), 'left');
  assert.equal(getRecommendedTextAlignment('center', 'beside', 'center'), 'left');
  assert.equal(getRecommendedTextAlignment('left', 'below', 'center'), 'center');
});

test('computeBesidePdfGeometry places logo left and text right, centered vertically', () => {
  const geo = computeBesidePdfGeometry({
    pageWidth: 210,
    marginX: 22,
    topY: 10,
    logoW: 16,
    logoH: 16,
    logoPosition: 'left',
    textAlignment: 'right',
    textBlockHeight: 12,
    measuredTextWidth: 90,
  });

  assert.equal(geo.logoX, 22);
  assert.equal(geo.logoY, 10); // rowHeight is 16 -> (16-16)/2 = 0
  assert.equal(geo.firstTextTopY, 12); // (16-12)/2 = 2 -> 10 + 2
  assert.equal(geo.textColStartX, 22 + 16 + 6);
  assert.equal(geo.textAnchorX, 210 - 22); // flush right
  assert.equal(geo.textAlign, 'right');
  assert.ok(geo.dividerY > 26);
});

test('computeBesidePdfGeometry places text left and logo right when logoPosition is right', () => {
  const geo = computeBesidePdfGeometry({
    pageWidth: 210,
    marginX: 22,
    topY: 10,
    logoW: 16,
    logoH: 16,
    logoPosition: 'right',
    textAlignment: 'left',
    textBlockHeight: 20,
    measuredTextWidth: 80,
  });

  assert.equal(geo.logoX, 210 - 22 - 16);
  assert.equal(geo.logoY, 12); // (20-16)/2 = 2 -> 10 + 2
  assert.equal(geo.firstTextTopY, 10);
  assert.equal(geo.textColStartX, 22);
  assert.equal(geo.textAnchorX, 22);
  assert.equal(geo.textAlign, 'left');
});

test('computeBesidePdfGeometry centers logo+text pair horizontally when logoPosition is center', () => {
  const geo = computeBesidePdfGeometry({
    pageWidth: 210,
    marginX: 22,
    topY: 10,
    logoW: 16,
    logoH: 16,
    logoPosition: 'center',
    textAlignment: 'center',
    textBlockHeight: 16,
    measuredTextWidth: 80,
    gap: 6,
  });

  // totalGroupW = 16 + 6 + 80 = 102; start = (210 - 102)/2 = 54
  assert.equal(geo.logoX, 54);
  assert.equal(geo.textColStartX, 54 + 16 + 6);
  assert.equal(geo.textAlign, 'left');
});

test('applyBatchAssetToTemplateList updates only selected templates for target asset type', () => {
  const baseTemplates: DocumentTemplate[] = [
    {
      id: 'tpl_1',
      title: 'Procuração',
      category: 'Mandato',
      content: 'Texto 1...',
      isDefault: true,
      headerId: 'h_old',
      footerId: 'f_old',
      logoId: 'l_old',
      ownerUid: 'admin',
      createdAt: '2026-11-24T00:00:00.000Z',
      updatedAt: '2026-11-24T00:00:00.000Z',
    },
    {
      id: 'tpl_2',
      title: 'Contrato',
      category: 'Honorários',
      content: 'Texto 2...',
      isDefault: false,
      headerId: 'h_old',
      footerId: 'f_old',
      logoId: 'l_old',
      ownerUid: 'admin',
      createdAt: '2026-11-24T00:00:00.000Z',
      updatedAt: '2026-11-24T00:00:00.000Z',
    },
  ];

  const afterLogo = applyBatchAssetToTemplateList(
    baseTemplates,
    'logo',
    'logo_new',
    ['tpl_2'],
    '2026-11-24T12:00:00.000Z'
  );
  assert.equal(afterLogo[0].logoId, 'l_old');
  assert.equal(afterLogo[1].logoId, 'logo_new');
  assert.equal(afterLogo[1].headerId, 'h_old');
  assert.equal(afterLogo[1].footerId, 'f_old');

  const afterHeaderAll = applyBatchAssetToTemplateList(
    afterLogo,
    'header',
    'header_new',
    ['tpl_1', 'tpl_2'],
    '2026-11-24T12:05:00.000Z'
  );
  assert.equal(afterHeaderAll[0].headerId, 'header_new');
  assert.equal(afterHeaderAll[1].headerId, 'header_new');
});
