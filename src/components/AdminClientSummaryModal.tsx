import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  FileDown,
  FileSignature,
  FileText,
  Loader2,
  User,
  X,
} from 'lucide-react';
import type {
  ClientRecord,
  DocumentTemplate,
  FooterProfile,
  HeaderProfile,
  LetterheadSettings,
  LogoAsset,
  ServiceLink,
  ServiceLinkStatus,
} from '../types/legal';
import { formatDateTimeBR } from '../utils/masksAndFormatters';
import { buildTemplateValuesFromClient } from '../utils/legalFieldOptions';
import { interpolateTemplate } from '../utils/templateEngine';
import { resolveTemplateTimbrado } from '../utils/timbradoTheme';
import { generateLegalDocumentPdf, triggerBlobDownload } from '../utils/pdfGenerator';

export interface UnifiedClientEntry {
  key: string;
  clientRecord: ClientRecord | null;
  displayName: string;
  whatsapp: string;
  cpf: string;
  createdAt: string;
  overallStatus: ServiceLinkStatus | 'cadastrado';
  linkedDocs: ServiceLink[];
}

interface AdminClientSummaryModalProps {
  entry: UnifiedClientEntry | null;
  templates: DocumentTemplate[];
  headers: HeaderProfile[];
  footers: FooterProfile[];
  logos: LogoAsset[];
  letterhead: LetterheadSettings;
  onClose: () => void;
  onEditOrCompleteClient: (entry: UnifiedClientEntry) => void;
}

function renderStatusBadge(status: ServiceLinkStatus | 'cadastrado') {
  if (status === 'concluido') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        Concluído
      </span>
    );
  }
  if (status === 'assinando') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A7835]">
        <FileSignature className="w-4 h-4 shrink-0" aria-hidden="true" />
        Aguardando assinatura
      </span>
    );
  }
  if (status === 'pendente') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
        <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
        Aguardando preenchimento
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1D3A]">
      <User className="w-4 h-4 shrink-0" aria-hidden="true" />
      Cadastro ativo
    </span>
  );
}

export function AdminClientSummaryModal({
  entry,
  templates,
  headers,
  footers,
  logos,
  letterhead,
  onClose,
  onEditOrCompleteClient,
}: AdminClientSummaryModalProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!entry) return null;

  const client = entry.clientRecord;
  const totalDocs = entry.linkedDocs.length;
  const signedDocs = entry.linkedDocs.filter((d) => d.status === 'concluido').length;

  async function handleDownloadDocumentPdf(docLink: ServiceLink) {
    // 1. Real signed PDF URL from Firebase Storage or data URI
    if (
      docLink.signedPdfUrl &&
      !docLink.signedPdfUrl.startsWith('https://storage.local/')
    ) {
      const anchor = document.createElement('a');
      anchor.href = docLink.signedPdfUrl;
      anchor.download = docLink.signedPdfName || `Documento_${entry?.displayName}.pdf`;
      if (!docLink.signedPdfUrl.startsWith('data:')) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      return;
    }

    // 2. Regenerate formatted PDF immediately from saved ClientRecord + Template
    if (!client) return;
    const tpl =
      templates.find((t) => t.id === docLink.templateId) ||
      templates.find((t) => t.title === docLink.templateTitle) ||
      templates[0];
    if (!tpl) return;

    setDownloadingId(docLink.tokenId);
    try {
      const tagValues = buildTemplateValuesFromClient(client);
      const renderedText = interpolateTemplate(
        tpl.content,
        tagValues,
        new Date(docLink.createdAt || Date.now()),
        tpl.customFields
      );
      const { header, footer, logo } = resolveTemplateTimbrado({
        template: tpl,
        headers,
        footers,
        logos,
        fallbackLetterhead: letterhead,
      });
      const artifact = await generateLegalDocumentPdf({
        documentTitle: tpl.title,
        renderedText,
        letterhead,
        header,
        footer,
        logo,
        clientName: client.fullName,
      });
      triggerBlobDownload(artifact.blob, artifact.fileName);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleCopyLink(tokenId: string) {
    const url = `${window.location.origin}/?token=${encodeURIComponent(tokenId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(tokenId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1D3A]/55 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-summary-modal-title"
    >
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9A7835] mb-1">
              Resumo Completo do Cliente
            </p>
            <h3
              id="client-summary-modal-title"
              className="font-display text-2xl font-bold text-[#0B1D3A]"
            >
              {entry.displayName}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              Primeiro registro em {formatDateTimeBR(entry.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onEditOrCompleteClient(entry)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-[#0B1D3A] hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <Edit3 className="w-4 h-4" aria-hidden="true" />
              {client ? 'Editar Dados' : 'Completar Cadastro'}
            </button>
            <button
              type="button"
              aria-label="Fechar resumo do cliente"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* KPI Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
          <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200">
            <span className="block text-xs text-slate-500 mb-1">Documentos Vinculados</span>
            <span className="text-2xl font-bold text-[#0B1D3A] tabular-nums">{totalDocs}</span>
          </div>
          <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200">
            <span className="block text-xs text-slate-500 mb-1">Assinados / Concluídos</span>
            <span className="text-2xl font-bold text-emerald-700 tabular-nums">{signedDocs}</span>
          </div>
          <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 flex flex-col justify-between">
            <span className="block text-xs text-slate-500 mb-1">Status Atual</span>
            <div>{renderStatusBadge(entry.overallStatus)}</div>
          </div>
        </div>

        {/* Cadastral Data */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-[#0B1D3A] mb-3">Dados Cadastrais</h4>
          {client ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs sm:text-sm bg-[#F7F8FA] border border-slate-200 rounded-xl p-4">
              <div>
                <dt className="text-xs text-slate-500">Nome Completo</dt>
                <dd className="font-semibold text-[#0B1D3A] mt-0.5">{client.fullName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">CPF</dt>
                <dd className="font-semibold text-[#0B1D3A] tabular-nums mt-0.5">
                  {client.cpf || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">RG</dt>
                <dd className="font-semibold text-[#0B1D3A] tabular-nums mt-0.5">
                  {client.rg || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">WhatsApp</dt>
                <dd className="font-semibold text-[#0B1D3A] tabular-nums mt-0.5">
                  {client.whatsapp}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">E-mail</dt>
                <dd className="font-semibold text-[#0B1D3A] break-all mt-0.5">
                  {client.email || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Nacionalidade</dt>
                <dd className="font-semibold text-[#0B1D3A] mt-0.5">
                  {client.nationality || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Estado Civil</dt>
                <dd className="font-semibold text-[#0B1D3A] mt-0.5">
                  {client.maritalStatus || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Profissão</dt>
                <dd className="font-semibold text-[#0B1D3A] mt-0.5">
                  {client.profession || '—'}
                </dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs text-slate-500">Endereço Completo</dt>
                <dd className="font-semibold text-[#0B1D3A] mt-0.5">
                  {client.address || '—'}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs sm:text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  Atendimento criado via link rápido (WhatsApp: {entry.whatsapp})
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  No portal do cliente os dados não são retidos automaticamente (LGPD). Você pode
                  completar a ficha cadastral manualmente acima se desejar gerar novos PDFs direto
                  do painel.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Document History */}
        <div>
          <h4 className="text-sm font-semibold text-[#0B1D3A] mb-3">
            Histórico de Documentos ({totalDocs})
          </h4>
          {entry.linkedDocs.length === 0 ? (
            <p className="text-xs sm:text-sm text-slate-500 p-4 rounded-xl border border-dashed border-slate-200 text-center">
              Nenhum documento vinculado a este cliente ainda.
            </p>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
              {entry.linkedDocs.map((docItem) => {
                const hasDirectPdf = Boolean(
                  docItem.signedPdfUrl &&
                    !docItem.signedPdfUrl.startsWith('https://storage.local/')
                );
                const canGenerateFromClient = Boolean(client);
                const canDownload = hasDirectPdf || canGenerateFromClient;

                return (
                  <div
                    key={docItem.tokenId}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#0B1D3A] shrink-0" aria-hidden="true" />
                        <p className="text-sm font-semibold text-[#0B1D3A] truncate">
                          {docItem.templateTitle}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="tabular-nums">{formatDateTimeBR(docItem.createdAt)}</span>
                        {renderStatusBadge(docItem.status)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canDownload ? (
                        <button
                          type="button"
                          disabled={downloadingId === docItem.tokenId}
                          onClick={() => void handleDownloadDocumentPdf(docItem)}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          {downloadingId === docItem.tokenId ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                              Gerando...
                            </>
                          ) : (
                            <>
                              <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                              Baixar PDF
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleCopyLink(docItem.tokenId)}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-[#0B1D3A] hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          {copiedId === docItem.tokenId ? 'Link Copiado' : 'Copiar Link'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
