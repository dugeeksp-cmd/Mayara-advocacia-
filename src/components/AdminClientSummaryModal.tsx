import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  FileDown,
  FilePlus2,
  FileSignature,
  FileText,
  Loader2,
  User,
  X,
} from 'lucide-react';
import type {
  DocumentTemplate,
  FooterProfile,
  HeaderProfile,
  LetterheadSettings,
  LogoAsset,
  ServiceLink,
  ServiceLinkStatus,
} from '../types/legal';
import {
  formatCpfOrCnpj,
  formatDateTimeBR,
  formatPhoneBR,
} from '../utils/masksAndFormatters';
import {
  buildTemplateValuesFromClient,
  extractModelSpecificFields,
  type UnifiedClientEntry,
} from '../utils/legalFieldOptions';
import { interpolateTemplate } from '../utils/templateEngine';
import { resolveTemplateTimbrado } from '../utils/timbradoTheme';
import { generateLegalDocumentPdf, triggerBlobDownload } from '../utils/pdfGenerator';
import { buildClientTokenUrl } from '../utils/portalUrl';

export type { UnifiedClientEntry };

interface AdminClientSummaryModalProps {
  entry: UnifiedClientEntry | null;
  templates: DocumentTemplate[];
  headers: HeaderProfile[];
  footers: FooterProfile[];
  logos: LogoAsset[];
  letterhead: LetterheadSettings;
  onClose: () => void;
  onEditOrCompleteClient: (entry: UnifiedClientEntry, generatePdfAfter?: boolean) => void;
  onCreateAtendimentoForClient: (input: {
    clientId: string;
    clientName: string;
    whatsapp: string;
    templateId: string;
    templateTitle: string;
  }) => Promise<void>;
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
  onCreateAtendimentoForClient,
}: AdminClientSummaryModalProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick "+ Adicionar Novo Documento / Contrato" state
  const defaultTemplate = templates.find((t) => t.isDefault) || templates[0];
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [newDocTemplateId, setNewDocTemplateId] = useState<string>(defaultTemplate?.id || '');
  const [extraFieldValues, setExtraFieldValues] = useState<Record<string, string>>({});
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [docFeedback, setDocFeedback] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  const selectedAddTemplate = useMemo(
    () => templates.find((t) => t.id === newDocTemplateId) || defaultTemplate,
    [templates, newDocTemplateId, defaultTemplate]
  );

  const modelSpecificFields = useMemo(
    () => (selectedAddTemplate ? extractModelSpecificFields(selectedAddTemplate) : []),
    [selectedAddTemplate]
  );

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
        bodyFontSizePx: tpl.bodyFontSizePx,
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
    const url = buildClientTokenUrl(tokenId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(tokenId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  function handleToggleAddDoc() {
    setDocError(null);
    setDocFeedback(null);
    if (!client) {
      onEditOrCompleteClient(entry!, true);
      return;
    }
    setNewDocTemplateId(defaultTemplate?.id || templates[0]?.id || '');
    setExtraFieldValues({});
    setAddDocOpen((prev) => !prev);
  }

  async function handleGenerateAdditionalDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!client || !selectedAddTemplate) return;
    setDocError(null);
    setDocFeedback(null);

    for (const field of modelSpecificFields) {
      if (!(extraFieldValues[field.rawToken] || '').trim()) {
        setDocError(`Informe o campo "${field.label}" antes de gerar o documento.`);
        return;
      }
    }

    setCreatingDoc(true);
    try {
      await onCreateAtendimentoForClient({
        clientId: client.id,
        clientName: client.fullName,
        whatsapp: client.whatsapp,
        templateId: selectedAddTemplate.id,
        templateTitle: selectedAddTemplate.title,
      });

      const tagValues = {
        ...buildTemplateValuesFromClient(client),
        ...extraFieldValues,
      };
      const renderedText = interpolateTemplate(
        selectedAddTemplate.content,
        tagValues,
        new Date(),
        selectedAddTemplate.customFields
      );
      const { header, footer, logo } = resolveTemplateTimbrado({
        template: selectedAddTemplate,
        headers,
        footers,
        logos,
        fallbackLetterhead: letterhead,
      });
      const artifact = await generateLegalDocumentPdf({
        documentTitle: selectedAddTemplate.title,
        renderedText,
        bodyFontSizePx: selectedAddTemplate.bodyFontSizePx,
        letterhead,
        header,
        footer,
        logo,
        clientName: client.fullName,
      });
      triggerBlobDownload(artifact.blob, artifact.fileName);

      setAddDocOpen(false);
      setExtraFieldValues({});
      setDocFeedback(
        `Documento "${selectedAddTemplate.title}" gerado e vinculado ao histórico deste CPF.`
      );
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Erro ao gerar novo documento.');
    } finally {
      setCreatingDoc(false);
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
              onClick={() => onEditOrCompleteClient(entry, false)}
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
                  completar a ficha cadastral manualmente para gerar novos PDFs direto do painel.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Document History & "+ Adicionar Novo Documento / Contrato" */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <h4 className="text-sm font-semibold text-[#0B1D3A]">
              Histórico de Documentos ({totalDocs})
            </h4>

            <button
              type="button"
              onClick={handleToggleAddDoc}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132B52] inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <FilePlus2 className="w-4 h-4 text-[#CFAF6E]" aria-hidden="true" />
              + Adicionar Novo Documento / Contrato
            </button>
          </div>

          {docFeedback && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-medium flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{docFeedback}</span>
            </div>
          )}

          {addDocOpen && client && (
            <form
              onSubmit={handleGenerateAdditionalDocument}
              className="p-4 rounded-xl bg-[#F7F1E3]/55 border border-[#B8934A]/60 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-semibold text-[#0B1D3A]">
                  Gerar Novo Documento / Contrato para {client.fullName}
                </p>
                <button
                  type="button"
                  onClick={() => setAddDocOpen(false)}
                  className="text-xs font-medium text-slate-600 hover:text-[#0B1D3A]"
                >
                  Cancelar
                </button>
              </div>

              {docError && (
                <div
                  role="alert"
                  className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-medium"
                >
                  {docError}
                </div>
              )}

              <div>
                <label
                  htmlFor="add-doc-template"
                  className="block text-xs font-semibold text-[#0B1D3A] mb-1"
                >
                  Escolha o Modelo de Documento / Contrato
                </label>
                <select
                  id="add-doc-template"
                  value={newDocTemplateId}
                  onChange={(e) => {
                    setNewDocTemplateId(e.target.value);
                    setExtraFieldValues({});
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A]"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.title} ({tpl.category})
                    </option>
                  ))}
                </select>
              </div>

              {modelSpecificFields.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <p className="text-xs font-semibold text-[#9A7835]">
                    Campos específicos deste modelo:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {modelSpecificFields.map((field) => (
                      <div key={field.rawToken} className="sm:col-span-2">
                        <label
                          htmlFor={`summary-extra-${field.key}`}
                          className="block text-xs font-semibold text-[#0B1D3A] mb-1"
                        >
                          {field.label} *
                        </label>
                        <input
                          id={`summary-extra-${field.key}`}
                          type={field.type}
                          value={extraFieldValues[field.rawToken] || ''}
                          onChange={(e) => {
                            let val = e.target.value;
                            if (field.mask === 'cpf_cnpj') val = formatCpfOrCnpj(val);
                            else if (field.mask === 'phone') val = formatPhoneBR(val);
                            setExtraFieldValues((prev) => ({
                              ...prev,
                              [field.rawToken]: val,
                            }));
                          }}
                          placeholder={field.placeholder}
                          className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A]"
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={creatingDoc}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {creatingDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      Gerando PDF...
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" aria-hidden="true" />
                      Gerar PDF e Adicionar ao Histórico
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

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
