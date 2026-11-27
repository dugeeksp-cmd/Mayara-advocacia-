import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  FileSignature,
  Search,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import type { ServiceLinkStatus } from '../types/legal';
import type { UnifiedClientEntry } from '../utils/legalFieldOptions';
import { formatDateTimeBR } from '../utils/masksAndFormatters';
import { buildClientTokenUrl } from '../utils/portalUrl';

interface AdminClientsViewProps {
  unifiedEntries: UnifiedClientEntry[];
  feedback: string | null;
  onOpenSummary: (entryKey: string) => void;
  onOpenNewClient: () => void;
}

export function AdminClientsView({
  unifiedEntries,
  feedback,
  onOpenSummary,
  onOpenNewClient,
}: AdminClientsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ServiceLinkStatus>('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const filteredClients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return unifiedEntries.filter((entry) => {
      if (statusFilter !== 'all' && entry.overallStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        entry.displayName.toLowerCase().includes(q) ||
        entry.whatsapp.toLowerCase().includes(q) ||
        entry.cpf.toLowerCase().includes(q) ||
        entry.linkedDocs.some((d) => d.templateTitle.toLowerCase().includes(q))
      );
    });
  }, [unifiedEntries, searchTerm, statusFilter]);

  async function handleCopyLink(tokenId: string) {
    const url = buildClientTokenUrl(tokenId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(tokenId);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
      {feedback && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#0B1D3A]">
            Clientes e Atendimentos
          </h2>
          <p className="text-sm text-slate-600">
            Clique em um cliente para ver o resumo completo, baixar ou adicionar documentos, ou
            cadastre um novo cliente manualmente.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Buscar cliente por nome, CPF ou WhatsApp"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar nome, CPF ou WhatsApp..."
              className="w-full min-h-[48px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm text-[#0F172A] bg-white"
            />
          </div>

          <button
            type="button"
            onClick={onOpenNewClient}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <UserPlus className="w-4 h-4 text-[#CFAF6E]" aria-hidden="true" />
            + Cadastrar Cliente
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        role="tablist"
        aria-label="Filtrar clientes por status"
        className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl"
      >
        {(
          [
            { id: 'all', label: 'Todos' },
            { id: 'pendente', label: 'Aguardando preenchimento' },
            { id: 'assinando', label: 'Preenchido / Aguardando assinatura' },
            { id: 'concluido', label: 'Concluído' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={statusFilter === tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
              statusFilter === tab.id
                ? 'bg-white text-[#0B1D3A] font-semibold shadow-sm'
                : 'text-slate-600 hover:text-[#0B1D3A]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredClients.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl px-4">
          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" aria-hidden="true" />
          <p className="text-base font-semibold text-[#0B1D3A] mb-1">
            Nenhum cliente encontrado
          </p>
          <p className="text-sm text-slate-500">
            Ajuste os filtros de busca ou clique em &ldquo;+ Cadastrar Cliente&rdquo;.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 pr-4">Cliente</th>
                <th className="py-3 px-4">WhatsApp / Cadastro</th>
                <th className="py-3 px-4">Documentos</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 pl-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredClients.map((entry) => {
                const latestDoc = entry.linkedDocs[0];
                return (
                  <tr
                    key={entry.key}
                    onClick={() => onOpenSummary(entry.key)}
                    className="hover:bg-[#F7F1E3]/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 pr-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSummary(entry.key);
                        }}
                        className="text-left group"
                      >
                        <p className="font-semibold text-[#0B1D3A] group-hover:text-[#9A7835] inline-flex items-center gap-1 transition-colors">
                          {entry.displayName}
                          <ChevronRight className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {entry.cpf ? `CPF: ${entry.cpf} · ` : ''}
                          {formatDateTimeBR(entry.createdAt)}
                        </p>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 tabular-nums">
                      <p className="text-slate-800">{entry.whatsapp}</p>
                      <p className="text-xs text-slate-500">
                        {entry.clientRecord
                          ? 'Ficha completa salva'
                          : latestDoc
                            ? `PIN: ${latestDoc.pin}`
                            : '—'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <p className="font-medium text-[#0B1D3A]">
                        {latestDoc ? latestDoc.templateTitle : 'Sem documento vinculado'}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {entry.linkedDocs.length}{' '}
                        {entry.linkedDocs.length === 1 ? 'documento' : 'documentos'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      {entry.overallStatus === 'concluido' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                          Concluído
                        </span>
                      ) : entry.overallStatus === 'assinando' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A7835]">
                          <FileSignature className="w-4 h-4 shrink-0" aria-hidden="true" />
                          Aguardando assinatura
                        </span>
                      ) : entry.overallStatus === 'cadastrado' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1D3A]">
                          <User className="w-4 h-4 shrink-0" aria-hidden="true" />
                          Cadastro ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                          <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                          Aguardando preenchimento
                        </span>
                      )}
                    </td>
                    <td
                      className="py-3.5 pl-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenSummary(entry.key)}
                          className="inline-flex items-center justify-center min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132B52] whitespace-nowrap"
                        >
                          Ver Resumo
                        </button>
                        {latestDoc && latestDoc.status !== 'concluido' && (
                          <button
                            type="button"
                            onClick={() => void handleCopyLink(latestDoc.tokenId)}
                            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-[#0B1D3A] hover:bg-slate-50 whitespace-nowrap"
                          >
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            {copiedToken === latestDoc.tokenId ? 'Copiado' : 'Link'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
