import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyVerticalRegion,
  deriveTemplateTitleFromFilename,
  parseExtractedFooterLines,
  parseExtractedHeaderLines,
  reconstructParagraphsFromTokens,
} from './pdfImportParser';

test('deriveTemplateTitleFromFilename strips .pdf case-insensitively', () => {
  assert.equal(deriveTemplateTitleFromFilename('Procuracao Ad Judicia.PDF'), 'Procuracao Ad Judicia');
  assert.equal(deriveTemplateTitleFromFilename('contrato_honorarios.pdf'), 'contrato_honorarios');
  assert.equal(deriveTemplateTitleFromFilename('  .pdf  '), 'Modelo Importado de PDF');
});

test('classifyVerticalRegion separates top 14% header, bottom 11% footer, and middle body', () => {
  const pageHeight = 842; // A4 height in pt
  assert.equal(classifyVerticalRegion(780, pageHeight), 'header'); // ~92.6% from bottom (top 7.4%)
  assert.equal(classifyVerticalRegion(730, pageHeight), 'header'); // ~86.7% from bottom (top 13.3%)
  assert.equal(classifyVerticalRegion(520, pageHeight), 'body');
  assert.equal(classifyVerticalRegion(80, pageHeight), 'footer'); // ~9.5% from bottom
  assert.equal(classifyVerticalRegion(40, pageHeight), 'footer'); // ~4.7% from bottom
});

test('reconstructParagraphsFromTokens preserves paragraphs and merges wrapped lines', () => {
  const tokens = [
    { str: 'OUTORGANTE:', x: 50, y: 650, width: 80, height: 11 },
    { str: 'João da Silva,', x: 138, y: 650, width: 70, height: 11 },
    { str: 'brasileiro, solteiro.', x: 50, y: 634, width: 100, height: 11 },
    { str: 'PODERES:', x: 50, y: 590, width: 60, height: 11 },
    { str: 'Concede poderes Ad Judicia.', x: 118, y: 590, width: 140, height: 11 },
  ];

  const output = reconstructParagraphsFromTokens(tokens);
  assert.equal(
    output,
    'OUTORGANTE: João da Silva, brasileiro, solteiro.\n\nPODERES: Concede poderes Ad Judicia.'
  );
});

test('parseExtractedHeaderLines extracts office title, OAB, and subtitle', () => {
  const parsed = parseExtractedHeaderLines([
    'MAYARA MARTINS — ADVOCACIA E CONSULTORIA JURÍDICA',
    'OAB/RJ 229.359 | Subseção Saquarema',
  ]);
  assert.ok(parsed);
  assert.equal(parsed.officeTitle, 'MAYARA MARTINS — ADVOCACIA E CONSULTORIA JURÍDICA');
  assert.equal(parsed.oabNumber, 'OAB/RJ 229.359');
  assert.equal(parsed.subtitle, 'Subseção Saquarema');
});

test('parseExtractedFooterLines ignores page numbers and extracts contact fields', () => {
  const parsed = parseExtractedFooterLines([
    'Rua Alfredo Menezes nº 720 - Loja 21 - Bacaxá, Saquarema/RJ - CEP 28994-675',
    'Tel: (22) 99805-0980 | maycmartinsadv@hotmail.com | @mayaramartins_adv | www.mayaramartins.adv.br',
    'Página 1 de 2',
  ]);
  assert.ok(parsed);
  assert.match(parsed.addressFooter || '', /Rua Alfredo Menezes/);
  assert.equal(parsed.phone, '(22) 99805-0980');
  assert.equal(parsed.email, 'maycmartinsadv@hotmail.com');
  assert.equal(parsed.instagram, '@mayaramartins_adv');
  assert.equal(parsed.website, 'www.mayaramartins.adv.br');
});
