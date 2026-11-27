import { useMemo } from 'react';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileSignature,
  FileText,
  FolderOpen,
  MessageCircle,
  Users,
} from 'lucide-react';
import type { DocumentTemplate, ServiceLink, ServiceLinkStatus } from '../types/legal';
import type { AdminSection } from './AdminSidebarDrawer';
import type { UnifiedClientEntry } from '../utils/legalFieldOptions';
import {
  buildPendingReminderWhatsAppUrl,
  computeAdminOverviewData,
} from '../utils/adminOverviewStats';
import { formatDateTimeBR } from '../utils/masksAndFormatters';
import { resolvePortalBaseUrl } from '../utils/portalUrl';

interface AdminExecutiveOverviewProps {
  unifiedEntries: UnifiedClientEntry[];
  links: ServiceLink[];
  templates: DocumentTemplate[];
  onNavigateSection: (section: AdminSection, linkFilter?: 'all' | ServiceLinkStatus) => void;
  onOpenClientSummary: (link: ServiceLink) => void;
  onDownloadReviewPdf: (link: ServiceLink) => Promise<void>;
}

export function AdminExecutiveOverview({
  unifiedEntries,
  links,
  templates,
  onNavigateSection,
  onOpenClientSummary,
  onDownloadReviewPdf,
}: AdminExecutiveOverviewProps) {
  const overview = useMemo(
    () => computeAdminOverviewData({ unifiedEntries, links, templates }),
    [unifiedEntries, links, templates]
  );

  const visibleReviewLinks = overview.reviewLinks.slice(0, 4);
  const visiblePendingLinks = overview.pendingLinks.slice(0, 2);
  const origin = resolvePortalBaseUrl();

  return (
    <section
      aria-label="Visão Geral Executiva do Escritório"
      className="space-y-4 mb-6"
    >
      {/* 1. Central de Atenção / Notificações Prioritárias */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0B1D3A] text-[#CFAF6E] flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[#0B1D3A]">
                Central de Atenção
              </h2>
              <p className="text-xs text-slate-500">
                Notificações prioritárias de recebimento e pendências de preenchimento
              </p>
            </div>
          </div>

          {!overview.allClear && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#F7F1E3] text-[#9A7835] border border-[#B8934A]/40 tabular-nums">
              {overview.reviewLinks.length + overview.pendingLinks.length}{' '}
              {overview.reviewLinks.length + overview.pendingLinks.length === 1
                ? 'notificação'
                : 'notificações'}
            </span>
          )}
        </div>

        {overview.allClear ? (
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3 text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium">
              Tudo em dia! Nenhuma pendência aguardando revisão no momento.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Review / Recently Received Signed Documents */}
            {visibleReviewLinks.length > 0 && (
              <div className="rounded-xl border border-[#B8934A]/50 bg-[#F7F1E3]/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#0B1D3A] text-[#CFAF6E] text-[11px] font-bold uppercase tracking-wider">
                      Ação Prioritária
                    </span>
                    <h3 className="text-sm font-bold text-[#0B1D3A]">
                      Documentos Pendentes de Revisão / Recebidos Recentemente (
                      {overview.reviewLinks.length})
                    </h3>
                  </div>

                  {overview.reviewLinks.length > 4 && (
                    <button
                      type="button"
                      onClick={() => onNavigateSection('links', 'concluido')}
                      className="text-xs font-semibold text-[#0B1D3A] hover:text-[#9A7835] inline-flex items-center gap-1"
                    >
                      Ver todos
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="divide-y divide-[#B8934A]/20 bg-white rounded-xl border border-slate-200">
                  {visibleReviewLinks.map((item) => {
                    const isConcluido = item.status === 'concluido';
                    return (
                      <div
                        key={item.tokenId}
                        className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[#0B1D3A] truncate">
                              {item.clientName}
                            </span>
                            <span className="text-xs text-slate-500 truncate">
                              · {item.templateTitle}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs">
                            {isConcluido ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                PDF assinado recebido
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-[#9A7835]">
                                <FileSignature className="w-3.5 h-3.5" aria-hidden="true" />
                                Em assinatura Gov.br
                              </span>
                            )}
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500 tabular-nums">
                              {formatDateTimeBR(item.completedAt || item.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onOpenClientSummary(item)}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[#0B1D3A] hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-[#9A7835]" aria-hidden="true" />
                            Abrir Resumo
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDownloadReviewPdf(item)}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132B52] inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            Baixar PDF
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pending Client Filling Alert */}
            {overview.pendingLinks.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                    <p className="text-sm font-semibold text-amber-950">
                      {overview.pendingLinks.length}{' '}
                      {overview.pendingLinks.length === 1
                        ? 'cliente ainda não preencheu os dados'
                        : 'clientes ainda não preencheram os dados'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigateSection('links', 'pendente')}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-amber-950 hover:bg-amber-100/60 inline-flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
                  >
                    Ver Lista
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {visiblePendingLinks.map((pending) => {
                    const waUrl = buildPendingReminderWhatsAppUrl(pending, origin);
                    return (
                      <div
                        key={pending.tokenId}
                        className="bg-white/90 border border-amber-200/80 rounded-lg px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-[#0B1D3A]">
                            {pending.clientName}
                          </span>
                          <span className="text-slate-500"> · {pending.templateTitle}</span>
                        </div>
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 inline-flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
                          >
                            <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            Cobrar no WhatsApp
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Cards de Indicadores Rápidos (4 Metrics) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onNavigateSection('clients')}
          className="bg-white border border-slate-200 hover:border-[#B8934A] rounded-2xl p-4 text-left transition-colors flex flex-col justify-between gap-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Clientes Cadastrados</span>
            <Users className="w-4 h-4 text-[#9A7835] shrink-0" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold text-[#0B1D3A] tabular-nums">
            {overview.uniqueRegisteredClientsCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSection('links', 'all')}
          className="bg-white border border-slate-200 hover:border-[#B8934A] rounded-2xl p-4 text-left transition-colors flex flex-col justify-between gap-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">
              Documentos Gerados / Assinados
            </span>
            <FileCheck2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold text-[#0B1D3A] tabular-nums">
            {overview.signedDocsCount}
            <span className="text-xs font-medium text-slate-500 ml-1.5">
              / {overview.totalDocsCount} total
            </span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSection('links', 'pendente')}
          className="bg-white border border-slate-200 hover:border-[#B8934A] rounded-2xl p-4 text-left transition-colors flex flex-col justify-between gap-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Aguardando Cliente</span>
            <Clock className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold text-amber-700 tabular-nums">
            {overview.pendingLinks.length}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSection('cms')}
          className="bg-white border border-slate-200 hover:border-[#B8934A] rounded-2xl p-4 text-left transition-colors flex flex-col justify-between gap-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Modelos Ativos</span>
            <FileText className="w-4 h-4 text-[#0B1D3A] shrink-0" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold text-[#0B1D3A] tabular-nums">
            {overview.activeTemplatesCount}
          </p>
        </button>
      </div>
    </section>
  );
}
