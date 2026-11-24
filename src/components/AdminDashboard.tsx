import { useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import type {
  ClientRecord,
  DocumentTemplate,
  FooterProfile,
  HeaderProfile,
  LetterheadSettings,
  LogoAsset,
  ServiceLink,
  ServiceLinkStatus,
  SignatureConfigSettings,
} from '../types/legal';
import {
  dataService,
  subscribeToSyncState,
  type CloudSyncState,
} from '../services/dataService';
import {
  buildTemplateValuesFromClient,
  buildUnifiedClientEntries,
  type UnifiedClientEntry,
} from '../utils/legalFieldOptions';
import { interpolateTemplate } from '../utils/templateEngine';
import {
  DEFAULT_FOOTERS,
  DEFAULT_HEADERS,
  DEFAULT_LOGOS,
  deriveLetterheadFromProfiles,
  resolveTemplateTimbrado,
} from '../utils/timbradoTheme';
import { generateLegalDocumentPdf, triggerBlobDownload } from '../utils/pdfGenerator';
import { AdminSidebarDrawer, type AdminSection } from './AdminSidebarDrawer';
import { AdminExecutiveOverview } from './AdminExecutiveOverview';
import { AdminLinkGenerator } from './AdminLinkGenerator';
import { AdminLinksManager } from './AdminLinksManager';
import { AdminClientsView } from './AdminClientsView';
import { AdminCmsEditor } from './AdminCmsEditor';
import { AdminSignatureSettings } from './AdminSignatureSettings';
import { AdminClientSummaryModal } from './AdminClientSummaryModal';
import { AdminClientManualModal } from './AdminClientManualModal';

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
  const [linksInitialFilter, setLinksInitialFilter] = useState<'all' | ServiceLinkStatus>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [links, setLinks] = useState<ServiceLink[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [headers, setHeaders] = useState<HeaderProfile[]>(DEFAULT_HEADERS);
  const [footers, setFooters] = useState<FooterProfile[]>(DEFAULT_FOOTERS);
  const [logos, setLogos] = useState<LogoAsset[]>(DEFAULT_LOGOS);
  const [syncState, setSyncState] = useState<CloudSyncState>('cloud');

  const [signatureConfig, setSignatureConfig] = useState<SignatureConfigSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Shared Unified Client Summary & Manual Registration Modal state (accessible from Clientes and Documentos Recebidos)
  const [summaryKey, setSummaryKey] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [prefillName, setPrefillName] = useState('');
  const [prefillWhatsapp, setPrefillWhatsapp] = useState('');
  const [defaultGeneratePdf, setDefaultGeneratePdf] = useState<boolean | undefined>(undefined);
  const [clientFeedback, setClientFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const unsubs: Array<() => void> = [];

    async function init() {
      setLoading(true);
      await dataService.ensureSeedData();
      const [hdrs, ftrs, lgs, tpls, sigCfg] = await Promise.all([
        dataService.getHeaders(),
        dataService.getFooters(),
        dataService.getLogos(),
        dataService.getTemplates(),
        dataService.getSignatureConfig(),
      ]);
      if (!active) return;

      setHeaders(hdrs);
      setFooters(ftrs);
      setLogos(lgs);
      setTemplates(tpls);
      setSignatureConfig(sigCfg);
      setLoading(false);

      unsubs.push(
        subscribeToSyncState((state) => {
          if (active) setSyncState(state);
        }),
        dataService.subscribeToLinks((nextLinks) => {
          if (active) setLinks(nextLinks);
        }),
        dataService.subscribeToClients((nextClients) => {
          if (active) setClients(nextClients);
        }),
        dataService.subscribeToTemplates((nextTemplates) => {
          if (active) setTemplates(nextTemplates);
        }),
        dataService.subscribeToHeaders((nextHeaders) => {
          if (active) setHeaders(nextHeaders);
        }),
        dataService.subscribeToFooters((nextFooters) => {
          if (active) setFooters(nextFooters);
        }),
        dataService.subscribeToLogos((nextLogos) => {
          if (active) setLogos(nextLogos);
        })
      );
    }

    void init();

    return () => {
      active = false;
      for (const unsub of unsubs) unsub();
    };
  }, [mode]);

  // Keep global letterhead synced whenever default Header/Footer/Logo changes
  useEffect(() => {
    const derived = deriveLetterheadFromProfiles({
      headers,
      footers,
      logos,
      fallback: letterhead,
    });
    if (
      derived.officeTitle !== letterhead.officeTitle ||
      derived.oabNumber !== letterhead.oabNumber ||
      derived.subtitle !== letterhead.subtitle ||
      derived.headerAlignment !== letterhead.headerAlignment ||
      derived.addressFooter !== letterhead.addressFooter ||
      derived.phone !== letterhead.phone ||
      derived.email !== letterhead.email ||
      derived.instagram !== letterhead.instagram ||
      derived.website !== letterhead.website ||
      derived.logoDataUrl !== letterhead.logoDataUrl
    ) {
      onLetterheadUpdated(derived);
    }
  }, [headers, footers, logos]);

  const unifiedEntries = useMemo(
    () => buildUnifiedClientEntries(clients, links),
    [clients, links]
  );

  const selectedSummaryEntry = useMemo(
    () => unifiedEntries.find((e) => e.key === summaryKey) || null,
    [unifiedEntries, summaryKey]
  );

  function handleOpenNewManualClientModal() {
    setEditingClient(null);
    setPrefillName('');
    setPrefillWhatsapp('');
    setDefaultGeneratePdf(true);
    setManualModalOpen(true);
  }

  function handleEditOrCompleteClient(entry: UnifiedClientEntry, generatePdfAfter = false) {
    setSummaryKey(null);
    setEditingClient(entry.clientRecord);
    setPrefillName(entry.displayName);
    setPrefillWhatsapp(entry.whatsapp);
    setDefaultGeneratePdf(generatePdfAfter);
    setManualModalOpen(true);
  }

  function handleOpenClientSummaryByLink(link: ServiceLink) {
    const match = unifiedEntries.find((entry) =>
      entry.linkedDocs.some((doc) => doc.tokenId === link.tokenId)
    );
    if (match) {
      setSummaryKey(match.key);
      return;
    }
    const bucketKey = `link:${link.clientName.trim().toLowerCase()}|${link.whatsapp.replace(/\D/g, '').slice(-11)}`;
    setSummaryKey(bucketKey);
  }

  async function handleQuickDownloadReviewPdf(link: ServiceLink) {
    if (link.signedPdfUrl && !link.signedPdfUrl.startsWith('https://storage.local/')) {
      const anchor = document.createElement('a');
      anchor.href = link.signedPdfUrl;
      anchor.download = link.signedPdfName || `Documento_${link.clientName}.pdf`;
      if (!link.signedPdfUrl.startsWith('data:')) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      return;
    }

    const match = unifiedEntries.find((entry) =>
      entry.linkedDocs.some((docItem) => docItem.tokenId === link.tokenId)
    );
    const client = match?.clientRecord;
    const tpl =
      templates.find((t) => t.id === link.templateId) ||
      templates.find((t) => t.title === link.templateTitle) ||
      templates[0];

    if (client && tpl) {
      const tagValues = buildTemplateValuesFromClient(client);
      const renderedText = interpolateTemplate(
        tpl.content,
        tagValues,
        new Date(link.createdAt || Date.now()),
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
      return;
    }

    handleOpenClientSummaryByLink(link);
  }

  function handleNavigateSection(section: AdminSection, linkFilter?: 'all' | ServiceLinkStatus) {
    if (section === 'links') {
      setLinksInitialFilter(linkFilter ?? 'all');
    }
    setActiveSection(section);
  }

  const pendingCount = links.filter((l) => l.status !== 'concluido').length;
  const completedCount = links.filter((l) => l.status === 'concluido').length;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <AdminSidebarDrawer
        isOpen={drawerOpen}
        activeSection={activeSection}
        documentsCount={links.length}
        clientsCount={unifiedEntries.length}
        onClose={() => setDrawerOpen(false)}
        onSelectSection={(sec) => handleNavigateSection(sec, 'all')}
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
              Painel Administrativo ·{' '}
              {syncState === 'cloud'
                ? 'Nuvem Firebase · Tempo Real'
                : 'Cache Local (Offline)'}
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
            <div className="space-y-6">
              <AdminExecutiveOverview
                unifiedEntries={unifiedEntries}
                links={links}
                templates={templates}
                onNavigateSection={handleNavigateSection}
                onOpenClientSummary={handleOpenClientSummaryByLink}
                onDownloadReviewPdf={handleQuickDownloadReviewPdf}
              />

              <AdminLinkGenerator
                templates={templates}
                onLinkCreated={() => {
                  // Live snapshot updates `links` automatically
                }}
              />
            </div>
          )}

          {activeSection === 'links' && (
            <AdminLinksManager
              links={links}
              initialFilter={linksInitialFilter}
              onDeleteLink={async (link) => {
                await dataService.deleteServiceLink(link);
              }}
              onOpenClientSummary={handleOpenClientSummaryByLink}
            />
          )}

          {activeSection === 'clients' && (
            <AdminClientsView
              unifiedEntries={unifiedEntries}
              feedback={clientFeedback}
              onOpenSummary={(key) => setSummaryKey(key)}
              onOpenNewClient={handleOpenNewManualClientModal}
            />
          )}

          {activeSection === 'cms' && (
            <AdminCmsEditor
              templates={templates}
              headers={headers}
              footers={footers}
              logos={logos}
              letterhead={letterhead}
              onSaveTemplate={async (tpl) => dataService.saveTemplate(tpl)}
              onDeleteTemplate={async (id) => dataService.deleteTemplate(id)}
              onSaveHeader={async (input) => dataService.saveHeader(input)}
              onDeleteHeader={async (id) => dataService.deleteHeader(id)}
              onSaveFooter={async (input) => dataService.saveFooter(input)}
              onDeleteFooter={async (id) => dataService.deleteFooter(id)}
              onSaveLogo={async (input) => dataService.saveLogo(input)}
              onDeleteLogo={async (id) => dataService.deleteLogo(id)}
              onSaveLetterhead={async (settings) => {
                const saved = await dataService.saveLetterhead(settings);
                onLetterheadUpdated(saved);
              }}
              onBatchApplyAsset={async (params) => {
                await dataService.applyAssetToTemplates(params);
              }}
            />
          )}

          {activeSection === 'signature' && signatureConfig && (
            <AdminSignatureSettings
              signatureConfig={signatureConfig}
              onSaveSignatureConfig={async (cfg) => {
                const saved = await dataService.saveSignatureConfig(cfg);
                setSignatureConfig(saved);
              }}
            />
          )}
        </>
      )}

      {/* Unified Client Summary & Document History Modal (shared by Clientes & Documentos Recebidos) */}
      <AdminClientSummaryModal
        entry={selectedSummaryEntry}
        templates={templates}
        headers={headers}
        footers={footers}
        logos={logos}
        letterhead={letterhead}
        onClose={() => setSummaryKey(null)}
        onEditOrCompleteClient={handleEditOrCompleteClient}
        onCreateAtendimentoForClient={async (input) => {
          await dataService.createServiceLink(input);
        }}
      />

      {/* Unified Manual Client Registration / Edit Modal with CPF Primary Lookup */}
      <AdminClientManualModal
        isOpen={manualModalOpen}
        editingClient={editingClient}
        existingClients={clients}
        prefillName={prefillName}
        prefillWhatsapp={prefillWhatsapp}
        defaultGeneratePdf={defaultGeneratePdf}
        templates={templates}
        headers={headers}
        footers={footers}
        logos={logos}
        letterhead={letterhead}
        onClose={() => setManualModalOpen(false)}
        onSaveClient={async (input) => dataService.saveClient(input)}
        onCreateAtendimentoForClient={async (input) => {
          await dataService.createServiceLink(input);
        }}
        onSuccessFeedback={(msg) => setClientFeedback(msg)}
      />
    </main>
  );
}
