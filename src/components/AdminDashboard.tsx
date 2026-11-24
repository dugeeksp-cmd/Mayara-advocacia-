import { useEffect, useState } from 'react';
import { FileText, Link2, PenTool } from 'lucide-react';
import type {
  DocumentTemplate,
  LetterheadSettings,
  ServiceLink,
  SignatureConfigSettings,
  SignatureServerConfig,
} from '../types/legal';
import { dataService } from '../services/dataService';
import { fetchSignatureServerConfig } from '../services/signatureApi';
import { AdminLinkGenerator } from './AdminLinkGenerator';
import { AdminLinksManager } from './AdminLinksManager';
import { AdminCmsEditor } from './AdminCmsEditor';

type AdminTab = 'generate' | 'links' | 'cms';

interface AdminDashboardProps {
  mode: 'firebase' | 'local';
  letterhead: LetterheadSettings;
  onLetterheadUpdated: (next: LetterheadSettings) => void;
}

export function AdminDashboard({
  mode,
  letterhead,
  onLetterheadUpdated,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('generate');
  const [links, setLinks] = useState<ServiceLink[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [signatureConfig, setSignatureConfig] = useState<SignatureConfigSettings | null>(null);
  const [signatureServerConfig, setSignatureServerConfig] = useState<SignatureServerConfig | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function init() {
      setLoading(true);
      await dataService.ensureSeedData();
      const [tpls, sigCfg, serverCfg] = await Promise.all([
        dataService.getTemplates(),
        dataService.getSignatureConfig(),
        fetchSignatureServerConfig().catch(() => null),
      ]);
      if (!active) return;
      setTemplates(tpls);
      setSignatureConfig(sigCfg);
      setSignatureServerConfig(serverCfg);
      setLoading(false);

      unsubscribe = dataService.subscribeToLinks((nextLinks) => {
        if (active) setLinks(nextLinks);
      });
    }

    void init();

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [mode]);

  const pendingCount = links.filter((l) => l.status !== 'concluido').length;
  const completedCount = links.filter((l) => l.status === 'concluido').length;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Header & Summary Numbers */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9A7835] mb-1">
            Painel Administrativo · {mode === 'firebase' ? 'Nuvem Firebase' : 'Sessão Local Segura'}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1D3A]">
            Gestão de Atendimentos Jurídicos
          </h1>
        </div>

        <div className="flex items-center gap-6 text-sm tabular-nums border border-slate-200 bg-white rounded-xl px-5 py-3">
          <div>
            <span className="block text-xs text-slate-500">Aguardando</span>
            <span className="text-lg font-bold text-[#0B1D3A]">{pendingCount}</span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="block text-xs text-slate-500">Assinados</span>
            <span className="text-lg font-bold text-emerald-700">{completedCount}</span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="block text-xs text-slate-500">Modelos</span>
            <span className="text-lg font-bold text-[#0B1D3A]">{templates.length}</span>
          </div>
        </div>
      </div>

      {/* 3-Tab Navigation */}
      <div
        role="tablist"
        aria-label="Seções administrativas"
        className="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'generate'}
          onClick={() => setActiveTab('generate')}
          className={`inline-flex items-center gap-2 min-h-[48px] px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'generate'
              ? 'border-[#B8934A] text-[#0B1D3A]'
              : 'border-transparent text-slate-600 hover:text-[#0B1D3A]'
          }`}
        >
          <Link2 className="w-4 h-4" aria-hidden="true" />
          Gerar Link
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'links'}
          onClick={() => setActiveTab('links')}
          className={`inline-flex items-center gap-2 min-h-[48px] px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'links'
              ? 'border-[#B8934A] text-[#0B1D3A]'
              : 'border-transparent text-slate-600 hover:text-[#0B1D3A]'
          }`}
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          Documentos Recebidos ({links.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'cms'}
          onClick={() => setActiveTab('cms')}
          className={`inline-flex items-center gap-2 min-h-[48px] px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'cms'
              ? 'border-[#B8934A] text-[#0B1D3A]'
              : 'border-transparent text-slate-600 hover:text-[#0B1D3A]'
          }`}
        >
          <PenTool className="w-4 h-4" aria-hidden="true" />
          Modelos e Timbrado
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
          Carregando painel administrativo...
        </div>
      ) : (
        <>
          {activeTab === 'generate' && (
            <AdminLinkGenerator
              templates={templates}
              onLinkCreated={() => {
                // Live snapshot updates `links` automatically
              }}
            />
          )}

          {activeTab === 'links' && (
            <AdminLinksManager
              links={links}
              onDeleteLink={async (link) => {
                await dataService.deleteServiceLink(link);
              }}
            />
          )}

          {activeTab === 'cms' && signatureConfig && (
            <AdminCmsEditor
              templates={templates}
              letterhead={letterhead}
              signatureConfig={signatureConfig}
              signatureServerConfig={signatureServerConfig}
              onSaveTemplate={async (tpl) => {
                const saved = await dataService.saveTemplate(tpl);
                setTemplates((prev) => {
                  const idx = prev.findIndex((item) => item.id === saved.id);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = saved;
                    return next;
                  }
                  return [...prev, saved];
                });
              }}
              onDeleteTemplate={async (id) => {
                await dataService.deleteTemplate(id);
                setTemplates((prev) => prev.filter((t) => t.id !== id));
              }}
              onSaveLetterhead={async (settings) => {
                const saved = await dataService.saveLetterhead(settings);
                onLetterheadUpdated(saved);
              }}
              onSaveSignatureConfig={async (cfg) => {
                const saved = await dataService.saveSignatureConfig(cfg);
                setSignatureConfig(saved);
              }}
            />
          )}
        </>
      )}
    </main>
  );
}
