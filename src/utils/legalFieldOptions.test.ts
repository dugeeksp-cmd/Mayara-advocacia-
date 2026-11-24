import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTemplateValuesFromClient,
  buildUnifiedClientEntries,
  extractModelSpecificFields,
  filterProfessions,
  findClientByCpf,
  isBrazilianNationality,
  MARITAL_STATUS_OPTIONS,
  matchLinksForClient,
  normalizeCpfDigits,
  PROFESSIONS_LIST,
} from './legalFieldOptions.ts';
import type { ClientRecord, DocumentTemplate, ServiceLink } from '../types/legal';

test('MARITAL_STATUS_OPTIONS includes all 6 required options', () => {
  const labels = MARITAL_STATUS_OPTIONS.map((o) => o.label);
  assert.deepEqual(labels, [
    'Solteiro(a)',
    'Casado(a)',
    'União Estável',
    'Divorciado(a)',
    'Separado(a) Judicialmente',
    'Viúvo(a)',
  ]);
});

test('filterProfessions filters accent-insensitively and prioritizes prefix matches', () => {
  assert.equal(filterProfessions('').length, PROFESSIONS_LIST.length);
  const medResults = filterProfessions('med');
  assert.ok(medResults.includes('Médico(a)'));
  assert.equal(medResults[0], 'Médico(a)');

  const tecResults = filterProfessions('tecnico');
  assert.ok(tecResults.includes('Técnico(a) de Enfermagem'));
  assert.ok(tecResults.includes('Técnico(a) de Informática'));

  const advResults = filterProfessions('adv');
  assert.equal(advResults[0], 'Advogado(a)');
});

test('isBrazilianNationality recognizes standard Brazilian values', () => {
  assert.equal(isBrazilianNationality('brasileiro(a)'), true);
  assert.equal(isBrazilianNationality('Brasileira'), true);
  assert.equal(isBrazilianNationality('Portuguesa'), false);
});

test('buildTemplateValuesFromClient maps all standard tags accurately', () => {
  const map = buildTemplateValuesFromClient({
    fullName: 'Ana Paula Souza',
    cpf: '123.456.789-00',
    rg: '12.345.678-9',
    email: 'ana@exemplo.com',
    whatsapp: '(22) 99800-1122',
    address: 'Rua A, 10, Saquarema/RJ',
    nationality: 'brasileiro(a)',
    maritalStatus: 'casado(a)',
    profession: 'administrador(a)',
  });
  assert.equal(map.NOME_COMPLETO, 'Ana Paula Souza');
  assert.equal(map.CPF, '123.456.789-00');
  assert.equal(map.ESTADO_CIVIL, 'casado(a)');
  assert.equal(map.PROFISSAO, 'administrador(a)');
});

test('matchLinksForClient matches by clientId or normalized whatsapp + name', () => {
  const client = {
    id: 'cli_1',
    fullName: 'João Silva',
    whatsapp: '(22) 99812-3456',
  };
  const links = [
    { clientId: 'cli_1', clientName: 'João Silva', whatsapp: '(22) 99812-3456', tokenId: 't1' },
    { clientId: null, clientName: 'Joao Silva', whatsapp: '22998123456', tokenId: 't2' },
    { clientId: 'cli_2', clientName: 'Maria Souza', whatsapp: '(22) 99999-0000', tokenId: 't3' },
  ];
  const matched = matchLinksForClient(client, links);
  assert.deepEqual(
    matched.map((m) => m.tokenId),
    ['t1', 't2']
  );
});

test('normalizeCpfDigits and findClientByCpf locate registered clients regardless of formatting', () => {
  assert.equal(normalizeCpfDigits('529.982.247-25'), '52998224725');
  const clients = [
    { id: 'c1', cpf: '529.982.247-25', fullName: 'Carlos Eduardo' },
    { id: 'c2', cpf: '111.222.333-44', fullName: 'Helena Dias' },
  ];
  const found = findClientByCpf(clients, '52998224725');
  assert.equal(found?.id, 'c1');
  assert.equal(findClientByCpf(clients, '12345'), null);
});

test('extractModelSpecificFields excludes standard client fields and keeps contract-specific ones', () => {
  const tpl: DocumentTemplate = {
    id: 'contrato',
    title: 'Contrato',
    category: 'Honorários',
    isDefault: false,
    content: 'Contratante {{NOME_COMPLETO}}, CPF {{CPF}}, objeto [CAMPO: Objeto da Ação] e valor {{VALOR_HONORARIOS}}.',
    customFields: [
      {
        key: 'VALOR_HONORARIOS',
        tag: '{{VALOR_HONORARIOS}}',
        label: 'Valor dos Honorários',
        fieldType: 'number',
      },
    ],
    ownerUid: 'admin',
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
  };
  const specific = extractModelSpecificFields(tpl);
  assert.deepEqual(
    specific.map((f) => f.key),
    ['CAMPO_OBJETO_DA_ACAO', 'VALOR_HONORARIOS']
  );
});

test('buildUnifiedClientEntries groups clients and remaining link-only atendimentos cleanly', () => {
  const clients: ClientRecord[] = [
    {
      id: 'cli_1',
      fullName: 'Mariana Costa',
      cpf: '529.982.247-25',
      rg: '12.345.678-9',
      email: 'mariana@exemplo.com',
      whatsapp: '(22) 99999-1111',
      address: 'Rua 1, Saquarema/RJ',
      nationality: 'brasileiro(a)',
      maritalStatus: 'solteiro(a)',
      profession: 'Advogado(a)',
      createdAt: '2026-11-24T10:00:00.000Z',
      updatedAt: '2026-11-24T10:00:00.000Z',
      updatedBy: 'admin',
    },
  ];
  const links: ServiceLink[] = [
    {
      tokenId: 'tok_1',
      clientId: 'cli_1',
      clientName: 'Mariana Costa',
      whatsapp: '(22) 99999-1111',
      pin: '1111',
      templateId: 'procuracao-ad-judicia',
      templateTitle: 'Procuração Ad Judicia',
      status: 'concluido',
      signatureMethod: 'govbr',
      ownerUid: 'admin',
      createdAt: '2026-11-24T11:00:00.000Z',
    },
    {
      tokenId: 'tok_2',
      clientName: 'Visitante Avulso',
      whatsapp: '(22) 98888-2222',
      pin: '2222',
      templateId: 'procuracao-ad-judicia',
      templateTitle: 'Procuração Ad Judicia',
      status: 'pendente',
      signatureMethod: 'none',
      ownerUid: 'admin',
      createdAt: '2026-11-24T12:00:00.000Z',
    },
  ];

  const entries = buildUnifiedClientEntries(clients, links);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].key, 'link:visitante avulso|22988882222');
  assert.equal(entries[1].key, 'client:cli_1');
  assert.equal(entries[1].linkedDocs.length, 1);
});

