import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileSignature,
  Search,
  Trash2,
} from 'lucide-react';
import type { ServiceLink, ServiceLinkStatus } from '../types/legal';
import { formatDateTimeBR } from '../utils/masksAndFormatters';
import { buildClientTokenUrl } from '../utils/portalUrl';

interface AdminLinksManagerProps {
  links: ServiceLink[];
  initialFilter?: 'all' | ServiceLinkStatus;
  onDeleteLink: (link: ServiceLink) => Promise<void>;
  onOpenClientSummary: (link: ServiceLink) => void;
}

const METHOD_LABELS: Record<ServiceLink['signatureMethod'], string> = {
  none: 'Não iniciada',
  govbr: 'Gov.br',
};

export function AdminLinksManager({
  links,
  initialFilter = 'all',
  onDeleteLink,
  onOpenClientSummary,
}: AdminLinksManagerProps) {
  const [filter, setFilter] = useState<'all' | ServiceLinkStatus>(initialFilter);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const filteredLinks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return links.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (!q) return true;
      return (
        item.clientName.toLowerCase().includes(q) ||
        item.templateTitle.toLowerCase().includes(q) ||
        item.tokenId.toLowerCase().includes(q)
      );
    });
  }, [links, filter, searchTerm]);

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

  async function handleConfirmDelete(link: ServiceLink) {
    setDeletingId(link.tokenId);
    try {
      await onDeleteLink(link);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#0B1D3A]">
            Gestão de Documentos e Links
          </h2>
          <p className="text-sm text-slate-600">
            Acompanhamento em tempo real de links emitidos e PDFs assinados recebidos. Clique no
            nome do cliente para abrir o resumo completo e adicionar documentos.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Buscar por cliente ou documento"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar cliente ou documento..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm text-[#0F172A] bg-white"
          />
        </div>
      </div>

      {/* Segmented Filter Controls */}
      <div
        role="tablist"
        aria-label="Filtrar por status"
        className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl mb-6"
      >
        {(
          [
            { id: 'all', label: 'Todos' },
            { id: 'pendente', label: 'Aguardando Preenchimento' },
            { id: 'assinando', label: 'Em Assinatura' },
            { id: 'concluido', label: 'Assinados e Enviados' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
              filter === tab.id
                ? 'bg-white text-[#0B1D3A] font-semibold shadow-sm'
                : 'text-slate-600 hover:text-[#0B1D3A]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filteredLinks.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl px-4">
          <p className="text-base font-semibold text-[#0B1D3A] mb-1">
            Nenhum atendimento encontrado
          </p>
          <p className="text-sm text-slate-500">
            Gere um novo link na aba &ldquo;Gerar Link&rdquo; ou ajuste os filtros acima.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {filteredLinks.map((link) => {
            const isCompleted = link.status === 'concluido';
            const isSigning = link.status === 'assinando';

            return (
              <div
                key={link.tokenId}
                className="py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <button
                      type="button"
                      onClick={() => onOpenClientSummary(link)}
                      className="text-left text-base font-semibold text-[#0B1D3A] hover:text-[#9A7835] hover:underline truncate transition-colors"
                    >
                      {link.clientName}
                    </button>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-sm text-slate-700">{link.templateTitle}</span>
                  </div>

                  {/* Unboxed Typographic Metadata */}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 tabular-nums">
                    <span>Emitido em {formatDateTimeBR(link.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      PIN: <strong className="font-mono text-slate-700">{link.pin}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Assinatura: {METHOD_LABELS[link.signatureMethod]}</span>
                    {isCompleted && link.completedAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Concluído em {formatDateTimeBR(link.completedAt)}</span>
                      </>
                    )}
                  </div>

                  {/* Status Line (Icon + Explicit Text, zero pill clutter) */}
                  <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        Assinado e Enviado
                      </span>
                    ) : isSigning ? (
                      <span className="inline-flex items-center gap-1.5 text-[#9A7835]">
                        <FileSignature className="w-4 h-4" aria-hidden="true" />
                        Assinando via {METHOD_LABELS[link.signatureMethod]}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-amber-700">
                        <Clock className="w-4 h-4" aria-hidden="true" />
                        Aguardando Preenchimento
                      </span>
                    )}
                  </div>
                </div>

                {/* Row Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {isCompleted && link.signedPdfUrl ? (
                    <a
                      href={link.signedPdfUrl}
                      download={link.signedPdfName || `Documento_${link.clientName}.pdf`}
                      target={link.signedPdfUrl.startsWith('data:') ? undefined : '_blank'}
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132B52] transition-colors whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" aria-hidden="true" />
                      Baixar PDF Assinado
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCopyLink(link.tokenId)}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-[#0B1D3A] hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      <Copy className="w-4 h-4" aria-hidden="true" />
                      {copiedId === link.tokenId ? 'Link Copiado' : 'Copiar Link'}
                    </button>
                  )}

                  {confirmDeleteId === link.tokenId ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={deletingId === link.tokenId}
                        onClick={() => handleConfirmDelete(link)}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-red-700 text-white text-xs sm:text-sm font-semibold hover:bg-red-800 disabled:opacity-60 whitespace-nowrap"
                      >
                        {deletingId === link.tokenId ? 'Excluindo...' : 'Confirmar Exclusão'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Excluir atendimento de ${link.clientName}`}
                      onClick={() => setConfirmDeleteId(link.tokenId)}
                      className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-red-700 hover:border-red-200 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
