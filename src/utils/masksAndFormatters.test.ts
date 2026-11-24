import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractLast4Digits,
  formatCEP,
  formatCPF,
  formatDateExtenso,
  formatPhoneBR,
  generateSecureToken,
  generateWhatsAppUrl,
  isValidCPF,
  isValidEmail,
  sanitizeFilenamePart,
} from './masksAndFormatters';

test('formatPhoneBR formats 11-digit mobile numbers correctly', () => {
  assert.equal(formatPhoneBR('22998050980'), '(22) 99805-0980');
  assert.equal(formatPhoneBR('(22) 9980-5098'), '(22) 9980-5098');
});

test('extractLast4Digits extracts the last 4 digits as PIN', () => {
  assert.equal(extractLast4Digits('(22) 99805-0980'), '0980');
  assert.equal(extractLast4Digits('123'), '');
});

test('formatCPF and isValidCPF validate Brazilian CPF check digits', () => {
  assert.equal(formatCPF('52998224725'), '529.982.247-25');
  assert.equal(isValidCPF('529.982.247-25'), true);
  assert.equal(isValidCPF('111.111.111-11'), false);
  assert.equal(isValidCPF('529.982.247-20'), false);
});

test('formatCEP and isValidEmail behave deterministically', () => {
  assert.equal(formatCEP('28994675'), '28994-675');
  assert.equal(isValidEmail('maycmartinsadv@hotmail.com'), true);
  assert.equal(isValidEmail('invalid-email'), false);
});

test('formatDateExtenso formats Portuguese legal date', () => {
  const d = new Date(2026, 10, 24); // Nov 24, 2026
  assert.equal(formatDateExtenso(d), '24 de novembro de 2026');
});

test('generateSecureToken generates >= 15 char URL-safe token with mm_ prefix', () => {
  const token = generateSecureToken(16);
  assert.ok(token.startsWith('mm_'));
  assert.equal(token.length, 19);
  assert.match(token, /^[a-zA-Z0-9_]+$/);
});

test('generateWhatsAppUrl builds wa.me link with 55 prefix, URL, and PIN instructions', () => {
  const url = generateWhatsAppUrl(
    '(22) 99805-0980',
    'João Silva',
    'https://portal.example.com/?token=mm_abc123',
    '0980',
    'Procuração Ad Judicia'
  );
  assert.ok(url.startsWith('https://wa.me/5522998050980?text='));
  const decoded = decodeURIComponent(url.split('text=')[1]);
  assert.ok(decoded.includes('Olá, João!'));
  assert.ok(decoded.includes('mm_abc123'));
  assert.ok(decoded.includes('0980'));
});

test('sanitizeFilenamePart removes accents and spaces safely', () => {
  assert.equal(sanitizeFilenamePart('Procuração Ad Judicia'), 'Procuracao_Ad_Judicia');
});
