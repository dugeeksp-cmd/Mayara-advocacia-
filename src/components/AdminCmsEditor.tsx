import React, { useMemo, useState } from 'react';
import { Check, CopyPlus, FilePlus2, Save, Trash2 } from 'lucide-react';
import type {
  DocumentTemplate,
  LetterheadSettings,
  SignatureConfigSettings,
  SignatureServerConfig,
} from '../types/legal';
import { sanitizeFilenamePart } from '../utils/masksAndFormatters';
import {
  AVAILABLE_TAGS_FOR_EDITOR,
  extractTemplateFields,
} from '../utils/templateEngine';

interface AdminCmsEditorProps {
  templates: DocumentTemplate[];
  letterhead: LetterheadSettings;
  signatureConfig: SignatureConfigSettings;
  signatureServerConfig: SignatureServerConfig | null;
  onSaveTemplate: (
    tpl: Omit<DocumentTemplate, 'ownerUid' | 'createdAt' | 'updatedAt'> & { createdAt?: string }
  ) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onSaveLetterhead: (
    settings: Omit<LetterheadSettings, 'updatedAt' | 'updatedBy'>
  ) => Promise<void>;
  onSaveSignatureConfig: (
    config: Omit<SignatureConfigSettings, 'updatedAt' | 'updatedBy'>
  ) => Promise<void>;
}

export function AdminCmsEditor({
  templates,
  letterhead,
  signatureConfig,
  signatureServerConfig,
  onSaveTemplate,
  onDeleteTemplate,
  onSaveLetterhead,
  onSaveSignatureConfig,
}: AdminCmsEditorProps) {
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id || '');
  const currentTpl = templates.find((t) => t.id === selectedId) || templates[0];

  const [title, setTitle] = useState(currentTpl?.title || '');
  const [category, setCategory] = useState(currentTpl?.category || '');
  const [content, setContent] = useState(currentTpl?.content || '');
  const [isDefault, setIsDefault] = useState(currentTpl?.isDefault || false);
  const [isNewMode, setIsNewMode] = useState(false);

  const [lhForm, setLhForm] = useState<Omit<LetterheadSettings, 'updatedAt' | 'updatedBy'>>({
    officeTitle: letterhead.officeTitle,
    oabNumber: letterhead.oabNumber,
    subtitle: letterhead.subtitle || '',
    addressFooter: letterhead.addressFooter,
    phone: letterhead.phone,
    email: letterhead.email,
    instagram: letterhead.instagram || '',
  });

  const [sigForm, setSigForm] = useState<Omit<SignatureConfigSettings, 'updatedAt' | 'updatedBy'>>({
    defaultProvider: signatureConfig.defaultProvider,
    clicksignEnabled: signatureConfig.clicksignEnabled,
    docusignEnabled: signatureConfig.docusignEnabled,
    govbrEnabled: signatureConfig.govbrEnabled,
  });

  const [savingTpl, setSavingTpl] = useState(false);
  const [savingLh, setSavingLh] = useState(false);
  const [savingSig, setSavingSig] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const detectedFields = useMemo(() => extractTemplateFields(content), [content]);

  function selectTemplate(tpl: DocumentTemplate) {
    setIsNewMode(false);
    setSelectedId(tpl.id);
    setTitle(tpl.title);
    setCategory(tpl.category);
    setContent(tpl.content);
    setIsDefault(tpl.isDefault);
    setFeedback(null);
  }

  function handleNewTemplate() {
    setIsNewMode(true);
    setSelectedId('');
    setTitle('');
    setCategory('Contrato / Declaração');
    setContent(
      `Eu, {{NOME_COMPLETO}}, {{NACIONALIDADE}}, {{ESTADO_CIVIL}}, {{PROFISSAO}}, inscrito(a) no CPF n.º {{CPF}}, residente e domiciliado(a) {{ENDERECO_COMPLETO}}, declaro para os devidos fins [CAMPO: Finalidade da Declaração].\n\nSaquarema, {{DATA_EXTENSO}}.`
    );
    setIsDefault(false);
    setFeedback(null);
  }

  function handleDuplicateTemplate() {
    setIsNewMode(true);
    setSelectedId('');
    setTitle(`${title || 'Modelo'} (Cópia)`);
    setIsDefault(false);
    setFeedback(null);
  }

  function insertTag(tag: string) {
    setContent((prev) => (prev.endsWith(' ') || prev.endsWith('\n') ? `${prev}${tag}` : `${prev} ${tag}`));
  }

  async function handleSaveTemplateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSavingTpl(true);
    setFeedback(null);
    try {
      const id =
        !isNewMode && selectedId
          ? selectedId
          : `${sanitizeFilenamePart(title).toLowerCase()}_${Date.now().toString(36)}`;
      await onSaveTemplate({
        id,
        title: title.trim(),
        category: category.trim() || 'Geral',
        content,
        isDefault,
      });
      setIsNewMode(false);
      setSelectedId(id);
      setFeedback('Modelo de documento salvo com sucesso.');
    } finally {
      setSavingTpl(false);
    }
  }

  async function handleSaveLetterheadSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingLh(true);
    setFeedback(null);
    try {
      await onSaveLetterhead(lhForm);
      setFeedback('Papel timbrado institucional atualizado.');
    } finally {
      setSavingLh(false);
    }
  }

  async function handleSaveSignatureSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingSig(true);
    setFeedback(null);
    try {
      await onSaveSignatureConfig(sigForm);
      setFeedback('Configurações de assinatura eletrônica atualizadas.');
    } finally {
      setSavingSig(false);
    }
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2"
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Section 1: Document Templates CMS */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#0B1D3A]">
              Construtor de Documentos (CMS Jurídico)
            </h2>
            <p className="text-sm text-slate-600">
              Crie ou edite modelos usando variáveis dinâmicas para montar automaticamente o
              formulário do cliente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleNewTemplate}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132B52] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <FilePlus2 className="w-4 h-4" aria-hidden="true" />
              Novo Modelo
            </button>
            <button
              type="button"
              onClick={handleDuplicateTemplate}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-[#0B1D3A] text-xs sm:text-sm font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <CopyPlus className="w-4 h-4" aria-hidden="true" />
              Duplicar Atual
            </button>
          </div>
        </div>

        {/* Template Selector Tabs */}
        <div className="flex flex-wrap gap-2 pb-5 mb-6 border-b border-slate-200">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => selectTemplate(tpl)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors whitespace-nowrap ${
                !isNewMode && selectedId === tpl.id
                  ? 'bg-[#0B1D3A] text-white border-[#0B1D3A]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              {tpl.title}
            </button>
          ))}
        </div>

        <form onSubmit={handleSaveTemplateSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tpl-title" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                  Título do Modelo
                </label>
                <input
                  id="tpl-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Procuração Ad Judicia"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-[#0F172A]"
                  required
                />
              </div>
              <div>
                <label htmlFor="tpl-cat" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                  Categoria
                </label>
                <input
                  id="tpl-cat"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex.: Mandato Judicial"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-[#0F172A]"
                  required
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-600 mb-2">
                Inserir variável dinâmica no texto:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_TAGS_FOR_EDITOR.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertTag(tag)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-mono text-xs text-[#0B1D3A] transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="tpl-content" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                Corpo Jurídico do Documento
              </label>
              <textarea
                id="tpl-content"
                rows={12}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-300 text-sm leading-relaxed text-[#0F172A] font-sans"
                required
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 accent-[#0B1D3A]"
                />
                Definir como modelo padrão ao gerar links
              </label>

              <div className="flex items-center gap-2">
                {!isNewMode && templates.length > 1 && selectedId && (
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate(selectedId)}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    Excluir Modelo
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingTpl}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  {savingTpl ? 'Salvando...' : 'Salvar Modelo'}
                </button>
              </div>
            </div>
          </div>

          {/* Live Detected Fields Sidebar */}
          <aside className="lg:col-span-4 bg-[#F7F8FA] border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#0B1D3A] mb-1">
              Campos Detectados Automaticamente
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Estes campos serão exibidos para o cliente preencher na Camada 1:
            </p>
            {detectedFields.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhuma variável dinâmica detectada.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {detectedFields.map((field) => (
                  <li
                    key={field.rawToken}
                    className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <span className="font-medium text-[#0B1D3A]">{field.label}</span>
                    <span className="font-mono text-[11px] text-slate-500 truncate max-w-[130px]">
                      {field.rawToken}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </form>
      </section>

      {/* Section 2: Letterhead & E-Signature Provider Config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold text-[#0B1D3A] mb-1">
            Editor de Papel Timbrado
          </h2>
          <p className="text-sm text-slate-600 mb-5">
            Cabeçalho e rodapé aplicados automaticamente em todos os PDFs A4 gerados.
          </p>

          <form onSubmit={handleSaveLetterheadSubmit} className="space-y-4">
            <div>
              <label htmlFor="lh-title" className="block text-xs font-semibold text-[#0B1D3A] mb-1">
                Título Institucional (Cabeçalho)
              </label>
              <input
                id="lh-title"
                type="text"
                value={lhForm.officeTitle}
                onChange={(e) => setLhForm((prev) => ({ ...prev, officeTitle: e.target.value }))}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="lh-oab" className="block text-xs font-semibold text-[#0B1D3A] mb-1">
                  Inscrição OAB
                </label>
                <input
                  id="lh-oab"
                  type="text"
                  value={lhForm.oabNumber}
                  onChange={(e) => setLhForm((prev) => ({ ...prev, oabNumber: e.target.value }))}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="lh-phone" className="block text-xs font-semibold text-[#0B1D3A] mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  id="lh-phone"
                  type="text"
                  value={lhForm.phone}
                  onChange={(e) => setLhForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="lh-address" className="block text-xs font-semibold text-[#0B1D3A] mb-1">
                Endereço do Rodapé
              </label>
              <input
                id="lh-address"
                type="text"
                value={lhForm.addressFooter}
                onChange={(e) => setLhForm((prev) => ({ ...prev, addressFooter: e.target.value }))}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="lh-email" className="block text-xs font-semibold text-[#0B1D3A] mb-1">
                  E-mail
                </label>
                <input
                  id="lh-email"
                  type="email"
                  value={lhForm.email}
                  onChange={(e) => setLhForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="lh-insta" className="block text-xs font-semibold text-[#0B1D3A] mb-1">
                  Instagram
                </label>
                <input
                  id="lh-insta"
                  type="text"
                  value={lhForm.instagram || ''}
                  onChange={(e) => setLhForm((prev) => ({ ...prev, instagram: e.target.value }))}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingLh}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              {savingLh ? 'Salvando...' : 'Salvar Papel Timbrado'}
            </button>
          </form>
        </section>

        {/* Signature Integration Preferences */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold text-[#0B1D3A] mb-1">
            Plataformas de Assinatura Eletrônica
          </h2>
          <p className="text-sm text-slate-600 mb-5">
            Defina quais meios de assinatura estarão disponíveis para o cliente após gerar o PDF.
          </p>

          <form onSubmit={handleSaveSignatureSubmit} className="space-y-4">
            <div>
              <label htmlFor="sig-default" className="block text-xs font-semibold text-[#0B1D3A] mb-1">
                Provedor Integrado Padrão
              </label>
              <select
                id="sig-default"
                value={sigForm.defaultProvider}
                onChange={(e) =>
                  setSigForm((prev) => ({
                    ...prev,
                    defaultProvider: e.target.value as 'clicksign' | 'docusign',
                  }))
                }
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="clicksign">Clicksign (MP 2.200-2/2001)</option>
                <option value="docusign">DocuSign eSignature</option>
              </select>
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-[#0B1D3A]">Clicksign Integrado</p>
                  <p className="text-xs text-slate-500">
                    {signatureServerConfig?.clicksignConfigured
                      ? `Credencial API ativa (${signatureServerConfig.clicksignEnv})`
                      : 'Modo Homologação Criptográfico (defina CLICKSIGN_ACCESS_TOKEN no servidor para produção)'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={sigForm.clicksignEnabled}
                  onChange={(e) =>
                    setSigForm((prev) => ({ ...prev, clicksignEnabled: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#0B1D3A]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-[#0B1D3A]">DocuSign Integrado</p>
                  <p className="text-xs text-slate-500">
                    {signatureServerConfig?.docusignConfigured
                      ? 'Credencial API ativa no servidor'
                      : 'Modo Homologação Criptográfico (defina DOCUSIGN_ACCESS_TOKEN no servidor para produção)'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={sigForm.docusignEnabled}
                  onChange={(e) =>
                    setSigForm((prev) => ({ ...prev, docusignEnabled: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#0B1D3A]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-[#0B1D3A]">Gov.br (assinador.iti.br)</p>
                  <p className="text-xs text-slate-500">
                    Tutorial guiado + upload manual do PDF assinado pelo portal Gov.br
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={sigForm.govbrEnabled}
                  onChange={(e) =>
                    setSigForm((prev) => ({ ...prev, govbrEnabled: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#0B1D3A]"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={savingSig}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              {savingSig ? 'Salvando...' : 'Salvar Opções de Assinatura'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
