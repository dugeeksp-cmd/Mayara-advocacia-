import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPendingReminderWhatsAppUrl,
  computeAdminOverviewData,
} from './adminOverviewStats.ts';
import type { DocumentTemplate, ServiceLink } from '../types/legal.ts';
import type { UnifiedClientEntry } from './legalFieldOptions.ts';

function makeLink(overrides: Partial<ServiceLink>): ServiceLink {
  return {
    tokenId: 'tok_1',
    clientName: 'Cliente Teste',
    whatsapp: '(22) 99999-1234',
    pin: '1234',
    templateId: 'procuracao-ad-judicia',
    templateTitle: 'Procuração Ad Judicia',
    status: 'pendente',
    signatureMethod: 'none',
    ownerUid: 'admin',
    createdAt: '2026-11-24T10:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

test('computeAdminOverviewData returns allClear=true when no pending or review items exist', () => {
  const result = computeAdminOverviewData({
    unifiedEntries: [],
    links: [],
    templates: [],
  });
  assert.equal(result.uniqueRegisteredClientsCount, 0);
  assert.equal(result.signedDocsCount, 0);
  assert.equal(result.totalDocsCount, 0);
  assert.equal(result.pendingLinks.length, 0);
  assert.equal(result.reviewLinks.length, 0);
  assert.equal(result.activeTemplatesCount, 0);
  assert.equal(result.allClear, true);
});

test('computeAdminOverviewData prioritizes completed signed docs before signing docs and separates pending', () => {
  const links: ServiceLink[] = [
    makeLink({ tokenId: 'p1', status: 'pendente', createdAt: '2026-11-24T09:00:00.000Z' }),
    makeLink({ tokenId: 's1', status: 'assinando', createdAt: '2026-11-24T12:00:00.000Z' }),
    makeLink({
      tokenId: 'c1',
      status: 'concluido',
      createdAt: '2026-11-24T08:00:00.000Z',
      completedAt: '2026-11-24T11:00:00.000Z',
    }),
    makeLink({
      tokenId: 'c2',
      status: 'concluido',
      createdAt: '2026-11-24T07:00:00.000Z',
      completedAt: '2026-11-24T13:00:00.000Z',
    }),
  ];

  const entries = [
    { key: 'cpf:111' },
    { key: 'cpf:222' },
    { key: 'link:333' },
  ] as UnifiedClientEntry[];

  const templates = [{ id: 't1' }, { id: 't2' }] as DocumentTemplate[];

  const data = computeAdminOverviewData({
    unifiedEntries: entries,
    links,
    templates,
  });

  assert.equal(data.uniqueRegisteredClientsCount, 3);
  assert.equal(data.signedDocsCount, 2);
  assert.equal(data.totalDocsCount, 4);
  assert.equal(data.activeTemplatesCount, 2);
  assert.equal(data.allClear, false);
  assert.deepEqual(
    data.pendingLinks.map((l) => l.tokenId),
    ['p1']
  );
  assert.deepEqual(
    data.reviewLinks.map((l) => l.tokenId),
    ['c2', 'c1', 's1']
  );
});

test('buildPendingReminderWhatsAppUrl generates valid wa.me link with token and PIN preserving /portal/', () => {
  const url = buildPendingReminderWhatsAppUrl(
    makeLink({
      clientName: 'Mariana Costa',
      whatsapp: '(22) 99812-4321',
      tokenId: 'tok_abc',
      pin: '4321',
      templateTitle: 'Contrato de Honorários',
    }),
    'https://escritorio.exemplo.br/portal/'
  );
  assert.ok(url);
  assert.ok(url.startsWith('https://wa.me/5522998124321?text='));
  const decoded = decodeURIComponent(url.split('?text=')[1]);
  assert.ok(decoded.includes('Mariana Costa'));
  assert.ok(decoded.includes('https://escritorio.exemplo.br/portal/?token=tok_abc'));
  assert.ok(decoded.includes('PIN de acesso: 4321'));

  assert.equal(
    buildPendingReminderWhatsAppUrl(makeLink({ whatsapp: '123' })),
    null
  );
});
