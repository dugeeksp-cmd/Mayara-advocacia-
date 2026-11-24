import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TEMPLATES,
  PROCURACAO_TEXT,
  extractTemplateFields,
  interpolateTemplate,
} from './templateEngine';

test('extractTemplateFields detects all standard Procuracao tags except DATA_EXTENSO', () => {
  const fields = extractTemplateFields(PROCURACAO_TEXT);
  const keys = fields.map((f) => f.key);
  assert.deepEqual(keys, [
    'NOME_COMPLETO',
    'NACIONALIDADE',
    'ESTADO_CIVIL',
    'PROFISSAO',
    'RG',
    'CPF',
    'ENDERECO_COMPLETO',
    'EMAIL',
  ]);
  assert.equal(keys.includes('DATA_EXTENSO'), false);
});

test('extractTemplateFields detects custom [CAMPO: ...] tags cleanly', () => {
  const contrato = DEFAULT_TEMPLATES.find((t) => t.id === 'contrato-honorarios')!;
  const fields = extractTemplateFields(contrato.content);
  const labels = fields.map((f) => f.label);
  assert.ok(labels.includes('Objeto da Ação ou Demanda'));
  assert.ok(labels.includes('Condição e Valor dos Honorários'));
});

test('interpolateTemplate replaces all standard and custom tags plus DATA_EXTENSO', () => {
  const rendered = interpolateTemplate(
    'Eu, {{NOME_COMPLETO}}, referente a [CAMPO: Objeto da Ação], Saquarema, {{DATA_EXTENSO}}.',
    {
      '{{NOME_COMPLETO}}': 'Ana Paula Souza',
      '[CAMPO: Objeto da Ação]': 'Ação de Cobrança',
    },
    new Date(2026, 10, 24)
  );
  assert.equal(
    rendered,
    'Eu, Ana Paula Souza, referente a Ação de Cobrança, Saquarema, 24 de novembro de 2026.'
  );
});
