import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import type {
  DocumentTemplate,
  LetterheadSettings,
  ServiceLink,
  SignatureConfigSettings,
  SignatureServerConfig,
} from '../types/legal';
import { dataService } from '../services/dataService';
import { fetchSignatureServerConfig } from '../services/signatureApi';
import { AdminSidebarDrawer, type AdminSection } from './AdminSidebarDrawer';
import { AdminLinkGenerator } from './AdminLinkGenerator';
import { AdminLinksManager } from './AdminLinksManager';
import { AdminClientsView } from './AdminClientsView';
import { AdminCmsEditor } from './AdminCmsEditor';
import { AdminSignatureSettings } from './AdminSignatureSettings';

interface AdminDashboardProps {
  mode: 'firebase' | 'local';
  letterhead: LetterheadSettings;
  onLetterheadUpdated: (next: LetterheadSettings) => void;
}

const SECTION_LABELS: Record<AdminSection, string> = {
  generate: 'Gerar Link',
  links: 'Documentos Recebidos',
  clients: 'Clientes',
  cms: 'Modelo e Timbrado',
  signature: 'Assinatura Eletrônica',
};

export function AdminDashboard({
  mode,
  letterhead,
  onLetterheadUpdated,
}: AdminDashboardProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>('generate');
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      <AdminSidebarDrawer
        isOpen={drawerOpen}
        activeSection={activeSection}
        documentsCount={links.length}
        clientsCount={links.length}
        onClose={() => setDrawerOpen(false)}
        onSelectSection={setActiveSection}
      />

      {/* Top-left Hamburger Menu + Section Header + Summary Numbers */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 pb-5 border-b border-slate-200">
        <div className="flex items-start sm:items-center gap-3.5">
          <button
            type="button"
            aria-label="Abrir menu administrativo"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="min-h-[48px] min-w-[48px] px-3 rounded-xl border border-slate-300 bg-white text-[#0B1D3A] hover:bg-slate-50 inline-flex items-center justify-center gap-2 shrink-0 transition-colors"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
            <span className="hidden sm:inline text-sm font-semibold">Menu</span>
          </button>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9A7835] mb-0.5">
              Painel Administrativo · {mode === 'firebase' ? 'Nuvem Firebase' : 'Sessão Local Segura'}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1D3A]">
              {SECTION_LABELS[activeSection]}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm tabular-nums border border-slate-200 bg-white rounded-xl px-5 py-3 self-start md:self-auto">
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

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
          Carregando painel administrativo...
        </div>
      ) : (
        <>
          {activeSection === 'generate' && (
            <AdminLinkGenerator
              templates={templates}
              onLinkCreated={() => {
                // Live snapshot updates `links` automatically
              }}
            />
          )}

          {activeSection === 'links' && (
            <AdminLinksManager
              links={links}
              onDeleteLink={async (link) => {
                await dataService.deleteServiceLink(link);
              }}
            />
          )}

          {activeSection === 'clients' && <AdminClientsView links={links} />}

          {activeSection === 'cms' && (
            <AdminCmsEditor
              templates={templates}
              letterhead={letterhead}
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
            />
          )}

          {activeSection === 'signature' && signatureConfig && (
            <AdminSignatureSettings
              signatureConfig={signatureConfig}
              signatureServerConfig={signatureServerConfig}
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
