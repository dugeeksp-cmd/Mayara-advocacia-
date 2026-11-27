import type { DocumentTemplate, ServiceLink } from '../types/legal';
import type { UnifiedClientEntry } from './legalFieldOptions';
import { onlyDigits } from './masksAndFormatters';
import { buildClientTokenUrl, DEFAULT_PRODUCTION_PORTAL_URL } from './portalUrl';

export interface AdminOverviewData {
  uniqueRegisteredClientsCount: number;
  signedDocsCount: number;
  totalDocsCount: number;
  pendingLinks: ServiceLink[];
  reviewLinks: ServiceLink[];
  activeTemplatesCount: number;
  allClear: boolean;
}

function linkTimestampDesc(a: ServiceLink, b: ServiceLink): number {
  const dateA = a.completedAt || a.createdAt || '';
  const dateB = b.completedAt || b.createdAt || '';
  return dateB.localeCompare(dateA);
}

/**
 * Pure aggregator for the Executive Overview panel on the Admin home screen.
 */
export function computeAdminOverviewData(params: {
  unifiedEntries: UnifiedClientEntry[];
  links: ServiceLink[];
  templates: DocumentTemplate[];
}): AdminOverviewData {
  const { unifiedEntries, links, templates } = params;

  const pendingLinks = links
    .filter((l) => l.status === 'pendente')
    .sort(linkTimestampDesc);

  const completedReview = links
    .filter((l) => l.status === 'concluido')
    .sort(linkTimestampDesc);

  const signingReview = links
    .filter((l) => l.status === 'assinando')
    .sort(linkTimestampDesc);

  // Prioritize recently signed/received PDFs first, followed by documents in signature
  const reviewLinks = [...completedReview, ...signingReview];

  return {
    uniqueRegisteredClientsCount: unifiedEntries.length,
    signedDocsCount: completedReview.length,
    totalDocsCount: links.length,
    pendingLinks,
    reviewLinks,
    activeTemplatesCount: templates.length,
    allClear: pendingLinks.length === 0 && reviewLinks.length === 0,
  };
}

export function buildPendingReminderWhatsAppUrl(
  link: Pick<ServiceLink, 'clientName' | 'whatsapp' | 'tokenId' | 'pin' | 'templateTitle'>,
  portalBaseUrl = DEFAULT_PRODUCTION_PORTAL_URL
): string | null {
  const digits = onlyDigits(link.whatsapp);
  if (digits.length < 10) return null;
  const normalizedPhone = digits.startsWith('55') ? digits : `55${digits}`;
  const accessUrl = buildClientTokenUrl(link.tokenId, portalBaseUrl);
  const message =
    `Olá, ${link.clientName}! Aqui é do escritório Mayara Martins — Advocacia e Consultoria Jurídica.\n\n` +
    `Notamos que o preenchimento do documento "${link.templateTitle}" ainda está pendente.\n` +
    `Para concluir em poucos minutos, acesse seu link seguro:\n${accessUrl}\n` +
    `PIN de acesso: ${link.pin}`;

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
