import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TEMPLATES,
  PROCURACAO_TEXT,
  buildSampleTemplateValues,
  extractTemplateFields,
  generateTagFromFieldName,
  insertTextAtCursor,
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

test('generateTagFromFieldName strips accents and uppercases into {{TAG}}', () => {
  assert.deepEqual(generateTagFromFieldName('Número do Processo'), {
    key: 'NUMERO_DO_PROCESSO',
    tag: '{{NUMERO_DO_PROCESSO}}',
  });
  assert.deepEqual(generateTagFromFieldName('Valor dos Honorários (R$)'), {
    key: 'VALOR_DOS_HONORARIOS_R',
    tag: '{{VALOR_DOS_HONORARIOS_R}}',
  });
});

test('insertTextAtCursor inserts variable exactly at cursor position and updates caret', () => {
  const initial = 'Eu, , brasileiro(a)';
  const { nextText, nextCursor } = insertTextAtCursor(initial, '{{NOME_COMPLETO}}', 4, 4);
  assert.equal(nextText, 'Eu, {{NOME_COMPLETO}}, brasileiro(a)');
  assert.equal(nextCursor, 4 + '{{NOME_COMPLETO}}'.length);
});

test('extractTemplateFields enriches saved customFields with configured type and mask', () => {
  const fields = extractTemplateFields('Processo {{NUMERO_DO_PROCESSO}} de {{VENCIMENTO}}', [
    {
      key: 'NUMERO_DO_PROCESSO',
      tag: '{{NUMERO_DO_PROCESSO}}',
      label: 'Número do Processo',
      fieldType: 'text',
    },
    {
      key: 'VENCIMENTO',
      tag: '{{VENCIMENTO}}',
      label: 'Data de Vencimento',
      fieldType: 'date',
    },
  ]);
  assert.equal(fields.length, 2);
  assert.equal(fields[1].type, 'date');
  assert.equal(fields[1].label, 'Data de Vencimento');
});

test('buildSampleTemplateValues populates standard and custom placeholders for test PDF preview', () => {
  const content =
    'Outorgante {{NOME_COMPLETO}}, CPF {{CPF}}, valor {{VALOR_CAUSA}}, objeto [CAMPO: Objeto].';
  const customFields = [
    {
      key: 'VALOR_CAUSA',
      tag: '{{VALOR_CAUSA}}',
      label: 'Valor da Causa',
      fieldType: 'number' as const,
    },
  ];
  const samples = buildSampleTemplateValues(content, customFields);
  const rendered = interpolateTemplate(content, samples, new Date(2026, 10, 24), customFields);
  assert.ok(!rendered.includes('{{'));
  assert.ok(!rendered.includes('[CAMPO:'));
  assert.ok(rendered.includes('1.500,00'));
  assert.ok(rendered.includes('[Exemplo: Objeto]'));
});
