import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  FileSignature,
  Search,
  Users,
} from 'lucide-react';
import type { ServiceLink, ServiceLinkStatus } from '../types/legal';
import { formatDateTimeBR } from '../utils/masksAndFormatters';

interface AdminClientsViewProps {
  links: ServiceLink[];
}

export function AdminClientsView({ links }: AdminClientsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ServiceLinkStatus>('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const filteredClients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return links.filter((link) => {
      if (statusFilter !== 'all' && link.status !== statusFilter) return false;
      if (!q) return true;
      return (
        link.clientName.toLowerCase().includes(q) ||
        link.whatsapp.toLowerCase().includes(q) ||
        link.templateTitle.toLowerCase().includes(q)
      );
    });
  }, [links, searchTerm, statusFilter]);

  async function handleCopyLink(tokenId: string) {
    const url = `${window.location.origin}/?token=${encodeURIComponent(tokenId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(tokenId);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#0B1D3A]">
            Clientes e Atendimentos
          </h2>
          <p className="text-sm text-slate-600">
            Lista de clientes vinculados aos links de atendimento (sem retenção de dados sensíveis
            LGPD).
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Buscar cliente por nome ou WhatsApp"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar nome ou WhatsApp..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm text-[#0F172A] bg-white"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        role="tablist"
        aria-label="Filtrar clientes por status"
        className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl mb-6"
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
            Ajuste os filtros de busca ou gere um novo link de atendimento.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 pr-4">Cliente</th>
                <th className="py-3 px-4">WhatsApp / PIN</th>
                <th className="py-3 px-4">Documento</th>
                <th className="py-3 px-4">Status do Atendimento</th>
                <th className="py-3 pl-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredClients.map((client) => (
                <tr key={client.tokenId} className="hover:bg-slate-50/70">
                  <td className="py-3.5 pr-4">
                    <p className="font-semibold text-[#0B1D3A]">{client.clientName}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      Cadastro em {formatDateTimeBR(client.createdAt)}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 tabular-nums">
                    <p className="text-slate-800">{client.whatsapp}</p>
                    <p className="text-xs text-slate-500 font-mono">PIN: {client.pin}</p>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">{client.templateTitle}</td>
                  <td className="py-3.5 px-4">
                    {client.status === 'concluido' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                        Concluído
                      </span>
                    ) : client.status === 'assinando' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A7835]">
                        <FileSignature className="w-4 h-4 shrink-0" aria-hidden="true" />
                        Preenchido / Aguardando assinatura
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                        <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                        Aguardando preenchimento
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 pl-4 text-right">
                    {client.status === 'concluido' && client.signedPdfUrl ? (
                      <a
                        href={client.signedPdfUrl}
                        download={client.signedPdfName || `Documento_${client.clientName}.pdf`}
                        target={client.signedPdfUrl.startsWith('data:') ? undefined : '_blank'}
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132B52] whitespace-nowrap"
                      >
                        Baixar PDF
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCopyLink(client.tokenId)}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-[#0B1D3A] hover:bg-slate-50 whitespace-nowrap"
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        {copiedToken === client.tokenId ? 'Copiado' : 'Copiar Link'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
