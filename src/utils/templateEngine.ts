import type {
  DocumentTemplate,
  FieldMaskType,
  LetterheadSettings,
  SignatureConfigSettings,
  TemplateTagField,
} from '../types/legal';
import { formatDateExtenso } from './masksAndFormatters';

export const DEFAULT_LETTERHEAD: LetterheadSettings = {
  officeTitle: 'MAYARA MARTINS — ADVOCACIA E CONSULTORIA JURÍDICA',
  oabNumber: 'OAB/RJ 229.359',
  subtitle: 'Subseção Saquarema · Seção do Estado do Rio de Janeiro',
  addressFooter: 'Rua Alfredo Menezes nº 720 - Loja 21 - Bacaxá, Saquarema/RJ - CEP 28994-675',
  phone: '(22) 99805-0980',
  email: 'maycmartinsadv@hotmail.com',
  instagram: '@mayaramartins_adv',
  updatedAt: '2026-11-24T00:00:00.000Z',
  updatedBy: 'system',
};

export const DEFAULT_SIGNATURE_CONFIG: SignatureConfigSettings = {
  defaultProvider: 'clicksign',
  clicksignEnabled: true,
  docusignEnabled: true,
  govbrEnabled: true,
  updatedAt: '2026-11-24T00:00:00.000Z',
  updatedBy: 'system',
};

export const PROCURACAO_TEXT = `OUTORGANTE: {{NOME_COMPLETO}}, {{NACIONALIDADE}}, {{ESTADO_CIVIL}}, {{PROFISSAO}}, portador(a) da carteira de identidade n.º {{RG}}, inscrito(a) no CPF n.º {{CPF}}, residente e domiciliado(a) {{ENDERECO_COMPLETO}}, com endereço eletrônico: {{EMAIL}}.

OUTORGADA: MAYARA CHAGAS MARTINS, brasileira, solteira, advogada, inscrita na Ordem dos Advogados do Brasil sob o n° 229.359, Seção do Estado Rio de Janeiro, Subseção Saquarema, com endereço profissional a Rua Alfredo Menezes - n° 720 Loja 21 Bacaxá Saquarema RJ CEP 28994-675 e endereço eletrônico maycmartinsadv@hotmail.com.

PODERES: Por este instrumento particular de procuração, concedo-lhe os poderes Ad Judicia e Extra Judicia, para o foro em geral representando o(a) Outorgante em qualquer juízo, Instância ou Tribunal, ou fora deles, em Cartórios, Repartições Públicas Municipais, Estaduais, Federais, Autarquias, Delegacias de Polícia, Conselhos Administrativos, Procon, Superintendência e demais Órgãos Públicos, podendo propor ações competentes contra quem de direito e defendê-lo nas contrárias, seguindo umas e outras até o final da decisão, interpondo e acompanhando os recursos legais necessários, conferindo, ainda, poderes especiais para confessar, desistir, negociar e transigir, renunciar, receber e dar quitação de qualquer importância em juízo ou fora dele, prestar caução, firmar compromissos ou acordos, promover quaisquer medidas preliminares, preventivas e assecuratórias do interesse do outorgante, inclusive, representar o outorgante em audiência de conciliação, nos moldes do § 1º do art.334 do CPC, conciliar, fazer justificações, notificações, preencher formulários, guias, requerer certidões, apresentar e retirar documentos, prestar depoimentos, substabelecer, enfim, praticar todos os atos necessários ao fiel cumprimento do presente mandato no presente feito.

Saquarema, {{DATA_EXTENSO}}.`;

export const DEFAULT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'procuracao-ad-judicia',
    title: 'Procuração Ad Judicia',
    category: 'Mandato Judicial',
    isDefault: true,
    ownerUid: 'system',
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
    content: PROCURACAO_TEXT,
  },
  {
    id: 'declaracao-hipossuficiencia',
    title: 'Declaração de Hipossuficiência Econômica',
    category: 'Gratuidade de Justiça',
    isDefault: false,
    ownerUid: 'system',
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
    content: `Eu, {{NOME_COMPLETO}}, {{NACIONALIDADE}}, {{ESTADO_CIVIL}}, {{PROFISSAO}}, portador(a) do RG n.º {{RG}} e inscrito(a) no CPF sob o n.º {{CPF}}, residente e domiciliado(a) {{ENDERECO_COMPLETO}}, com e-mail {{EMAIL}}, DECLARO, sob as penas da lei e nos termos do art. 5º, LXXIV, da Constituição Federal e dos arts. 98 e seguintes do Código de Processo Civil, não possuir condições financeiras de arcar com as custas processuais e honorários advocatícios sem prejuízo do meu próprio sustento e de minha família.

Por ser expressão da verdade, firmo a presente declaração para que produza seus efeitos legais junto ao processo patrocinado pela Dra. Mayara Chagas Martins (OAB/RJ 229.359).

Saquarema, {{DATA_EXTENSO}}.`,
  },
  {
    id: 'contrato-honorarios',
    title: 'Contrato de Honorários Advocatícios',
    category: 'Honorários',
    isDefault: false,
    ownerUid: 'system',
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
    content: `CONTRATANTE: {{NOME_COMPLETO}}, {{NACIONALIDADE}}, {{ESTADO_CIVIL}}, {{PROFISSAO}}, portador(a) do RG n.º {{RG}}, inscrito(a) no CPF n.º {{CPF}}, residente e domiciliado(a) {{ENDERECO_COMPLETO}}, e-mail {{EMAIL}}.

CONTRATADA: MAYARA CHAGAS MARTINS, advogada inscrita na OAB/RJ sob o n.º 229.359, com escritório profissional na Rua Alfredo Menezes, n.º 720, Loja 21, Bacaxá, Saquarema/RJ, CEP 28994-675.

CLÁUSULA 1ª — DO OBJETO: O presente contrato tem por objeto a prestação de serviços advocatícios referentes à demanda: [CAMPO: Objeto da Ação ou Demanda].

CLÁUSULA 2ª — DOS HONORÁRIOS: Pelos serviços prestados, o(a) CONTRATANTE pagará à CONTRATADA os honorários ajustados na forma de: [CAMPO: Condição e Valor dos Honorários].

CLÁUSULA 3ª — DAS DESPESAS: Eventuais custas judiciais, emolumentos e despesas processuais correrão por conta exclusiva do(a) CONTRATANTE, salvo se beneficiário da gratuidade de justiça.

CLÁUSULA 4ª — DO FORO: Fica eleito o foro da Comarca de Saquarema/RJ para dirimir quaisquer questões oriundas deste instrumento.

Saquarema, {{DATA_EXTENSO}}.`,
  },
];

interface StandardTagMeta {
  label: string;
  placeholder: string;
  type: 'text' | 'email';
  mask: FieldMaskType;
  isAddressComposite?: boolean;
}

export const STANDARD_TAG_META: Record<string, StandardTagMeta> = {
  NOME_COMPLETO: {
    label: 'Nome Completo',
    placeholder: 'Ex.: Maria Aparecida da Silva',
    type: 'text',
    mask: 'none',
  },
  NACIONALIDADE: {
    label: 'Nacionalidade',
    placeholder: 'Ex.: brasileira',
    type: 'text',
    mask: 'none',
  },
  ESTADO_CIVIL: {
    label: 'Estado Civil',
    placeholder: 'Ex.: solteira, casado(a), divorciado(a)',
    type: 'text',
    mask: 'none',
  },
  PROFISSAO: {
    label: 'Profissão',
    placeholder: 'Ex.: comerciante, aposentado(a), autônomo(a)',
    type: 'text',
    mask: 'none',
  },
  RG: {
    label: 'Carteira de Identidade (RG)',
    placeholder: '00.000.000-0',
    type: 'text',
    mask: 'rg',
  },
  CPF: {
    label: 'CPF',
    placeholder: '000.000.000-00',
    type: 'text',
    mask: 'cpf',
  },
  ENDERECO_COMPLETO: {
    label: 'Endereço Completo',
    placeholder: 'Rua, número, complemento, bairro, cidade/UF e CEP',
    type: 'text',
    mask: 'none',
    isAddressComposite: true,
  },
  EMAIL: {
    label: 'E-mail',
    placeholder: 'seuemail@exemplo.com',
    type: 'email',
    mask: 'email',
  },
  TELEFONE: {
    label: 'Telefone / WhatsApp',
    placeholder: '(22) 99999-9999',
    type: 'text',
    mask: 'phone',
  },
};

export const AVAILABLE_TAGS_FOR_EDITOR = [
  '{{NOME_COMPLETO}}',
  '{{NACIONALIDADE}}',
  '{{ESTADO_CIVIL}}',
  '{{PROFISSAO}}',
  '{{RG}}',
  '{{CPF}}',
  '{{ENDERECO_COMPLETO}}',
  '{{EMAIL}}',
  '{{DATA_EXTENSO}}',
  '[CAMPO: Nome do Campo]',
];

function humanizeTagKey(key: string): string {
  return key
    .toLowerCase()
    .split('_')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ');
}

/**
 * Extracts dynamic form fields from {{TAG}} and [CAMPO: Nome do Campo] tokens.
 * Excludes {{DATA_EXTENSO}} because it is automatically populated on generation.
 */
export function extractTemplateFields(content: string): TemplateTagField[] {
  const fields: TemplateTagField[] = [];
  const seen = new Set<string>();
  const regex = /\{\{([A-Z0-9_]+)\}\}|\[CAMPO:\s*([^\]]+)\]/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) {
      const key = match[1].trim();
      if (key === 'DATA_EXTENSO' || seen.has(key)) continue;
      seen.add(key);

      const meta = STANDARD_TAG_META[key];
      fields.push({
        key,
        rawToken: `{{${key}}}`,
        label: meta ? meta.label : humanizeTagKey(key),
        placeholder: meta ? meta.placeholder : `Informe ${humanizeTagKey(key).toLowerCase()}`,
        type: meta ? meta.type : 'text',
        mask: meta ? meta.mask : 'none',
        isAddressComposite: meta?.isAddressComposite,
      });
    } else if (match[2]) {
      const customLabel = match[2].trim();
      const key = `CAMPO_${customLabel
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase()}`;
      if (seen.has(match[0])) continue;
      seen.add(match[0]);

      fields.push({
        key,
        rawToken: match[0],
        label: customLabel,
        placeholder: `Preencha: ${customLabel}`,
        type: 'text',
        mask: 'none',
      });
    }
  }

  return fields;
}

/**
 * Replaces all {{TAG}} and [CAMPO: ...] occurrences with user-entered values
 * and auto-injects {{DATA_EXTENSO}}.
 */
export function interpolateTemplate(
  content: string,
  valuesByRawTokenOrKey: Record<string, string>,
  dateOverride?: Date
): string {
  const fields = extractTemplateFields(content);
  let output = content;

  for (const field of fields) {
    const val = (
      valuesByRawTokenOrKey[field.rawToken] ??
      valuesByRawTokenOrKey[field.key] ??
      ''
    ).trim();
    output = output.split(field.rawToken).join(val);
  }

  output = output.split('{{DATA_EXTENSO}}').join(formatDateExtenso(dateOverride));
  return output;
}
