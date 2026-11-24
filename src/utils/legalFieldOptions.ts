export const MARITAL_STATUS_OPTIONS = [
  { value: 'solteiro(a)', label: 'Solteiro(a)' },
  { value: 'casado(a)', label: 'Casado(a)' },
  { value: 'união estável', label: 'União Estável' },
  { value: 'divorciado(a)', label: 'Divorciado(a)' },
  { value: 'separado(a) judicialmente', label: 'Separado(a) Judicialmente' },
  { value: 'viúvo(a)', label: 'Viúvo(a)' },
] as const;

export const PROFESSIONS_LIST: readonly string[] = [
  'Administrador(a)',
  'Advogado(a)',
  'Agricultor(a)',
  'Analista de Sistemas',
  'Aposentado(a)',
  'Arquiteto(a)',
  'Autônomo(a)',
  'Auxiliar Administrativo(a)',
  'Bancário(a)',
  'Cabeleireiro(a)',
  'Comerciante',
  'Contador(a)',
  'Corretor(a) de Imóveis',
  'Cozinheiro(a)',
  'Dentista',
  'Designer',
  'Do Lar',
  'Economista',
  'Eletricista',
  'Empresário(a)',
  'Enfermeiro(a)',
  'Engenheiro(a)',
  'Estudante',
  'Farmacêutico(a)',
  'Fisioterapeuta',
  'Funcionário(a) Público(a)',
  'Jornalista',
  'Marceneiro(a)',
  'Mecânico(a)',
  'Médico(a)',
  'Motorista',
  'Nutricionista',
  'Pedreiro(a)',
  'Professor(a)',
  'Programador(a)',
  'Psicólogo(a)',
  'Representante Comercial',
  'Técnico(a) de Enfermagem',
  'Técnico(a) de Informática',
  'Vendedor(a)',
  'Vigilante',
];

function normalizeSearch(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function filterProfessions(query: string): string[] {
  const clean = normalizeSearch(query);
  if (!clean) return [...PROFESSIONS_LIST];

  const prefixMatches: string[] = [];
  const substringMatches: string[] = [];

  for (const prof of PROFESSIONS_LIST) {
    const norm = normalizeSearch(prof);
    if (norm.startsWith(clean)) {
      prefixMatches.push(prof);
    } else if (norm.includes(clean)) {
      substringMatches.push(prof);
    }
  }

  return [...prefixMatches, ...substringMatches];
}

export function isBrazilianNationality(value: string): boolean {
  const clean = normalizeSearch(value);
  return clean === 'brasileiro(a)' || clean === 'brasileiro' || clean === 'brasileira';
}

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(-11);
}

export function buildTemplateValuesFromClient(client: {
  fullName: string;
  cpf: string;
  rg: string;
  email: string;
  whatsapp: string;
  address: string;
  nationality: string;
  maritalStatus: string;
  profession: string;
}): Record<string, string> {
  return {
    NOME_COMPLETO: client.fullName.trim(),
    CPF: client.cpf.trim(),
    RG: client.rg.trim(),
    EMAIL: client.email.trim(),
    TELEFONE: client.whatsapp.trim(),
    WHATSAPP: client.whatsapp.trim(),
    ENDERECO_COMPLETO: client.address.trim(),
    NACIONALIDADE: client.nationality.trim(),
    ESTADO_CIVIL: client.maritalStatus.trim(),
    PROFISSAO: client.profession.trim(),
  };
}

export function matchLinksForClient<
  T extends { clientId?: string | null; clientName: string; whatsapp: string }
>(
  client: { id: string; fullName: string; whatsapp: string },
  links: T[]
): T[] {
  const clientDigits = normalizePhoneDigits(client.whatsapp);
  const clientNameNorm = normalizeSearch(client.fullName);

  return links.filter((link) => {
    if (link.clientId && link.clientId === client.id) return true;
    const linkDigits = normalizePhoneDigits(link.whatsapp);
    const linkNameNorm = normalizeSearch(link.clientName);
    if (clientDigits.length >= 8 && linkDigits === clientDigits) {
      return linkNameNorm === clientNameNorm || !link.clientId;
    }
    return false;
  });
}

