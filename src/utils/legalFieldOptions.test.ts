import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTemplateValuesFromClient,
  filterProfessions,
  isBrazilianNationality,
  MARITAL_STATUS_OPTIONS,
  matchLinksForClient,
  PROFESSIONS_LIST,
} from './legalFieldOptions.ts';

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

