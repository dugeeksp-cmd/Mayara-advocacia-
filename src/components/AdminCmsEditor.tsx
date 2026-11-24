import React, { useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Check,
  CopyPlus,
  Edit3,
  FileText,
  FileUp,
  ImagePlus,
  LayoutTemplate,
  PanelBottom,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { PdfTemplateImportModal } from './PdfTemplateImportModal';
import type {
  CustomFieldType,
  CustomTemplateField,
  DocumentTemplate,
  HeaderAlignment,
  LetterheadSettings,
} from '../types/legal';
import { sanitizeFilenamePart } from '../utils/masksAndFormatters';
import {
  AVAILABLE_TAGS_FOR_EDITOR,
  extractTemplateFields,
  generateTagFromFieldName,
  insertTextAtCursor,
} from '../utils/templateEngine';

type CmsView = 'hub' | 'header' | 'footer' | 'images' | 'templates';

interface AdminCmsEditorProps {
  templates: DocumentTemplate[];
  letterhead: LetterheadSettings;
  onSaveTemplate: (
    tpl: Omit<DocumentTemplate, 'ownerUid' | 'createdAt' | 'updatedAt'> & { createdAt?: string }
  ) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onSaveLetterhead: (
    settings: Omit<LetterheadSettings, 'updatedAt' | 'updatedBy'>
  ) => Promise<void>;
}

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Data',
  cpf_cnpj: 'CPF / CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
};

async function compressImageToDataUrl(file: File, maxDim: number = 360): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Falha ao processar imagem.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Erro ao ler imagem.'));
    reader.readAsDataURL(file);
  });
}

export function AdminCmsEditor({
  templates,
  letterhead,
  onSaveTemplate,
  onDeleteTemplate,
  onSaveLetterhead,
}: AdminCmsEditorProps) {
  const [cmsView, setCmsView] = useState<CmsView>('hub');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Letterhead State
  const [lhForm, setLhForm] = useState<Omit<LetterheadSettings, 'updatedAt' | 'updatedBy'>>({
    officeTitle: letterhead.officeTitle,
    oabNumber: letterhead.oabNumber,
    subtitle: letterhead.subtitle || '',
    headerAlignment: letterhead.headerAlignment || 'center',
    addressFooter: letterhead.addressFooter,
    phone: letterhead.phone,
    email: letterhead.email,
    instagram: letterhead.instagram || '',
    website: letterhead.website || '',
    logoDataUrl: letterhead.logoDataUrl ?? null,
    sealDataUrl: letterhead.sealDataUrl ?? null,
  });
  const [savingLh, setSavingLh] = useState(false);

  // Templates List vs Editor State (Editor only opens when user clicks New or Edit!)
  const [editorMode, setEditorMode] = useState<'list' | 'edit'>('list');
  const [selectedId, setSelectedId] = useState<string>('');
  const [isNewMode, setIsNewMode] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [customFields, setCustomFields] = useState<CustomTemplateField[]>([]);
  const [savingTpl, setSavingTpl] = useState(false);

  // Cursor-aware textarea ref
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Add / Edit Custom Field Modal State
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [fieldNameInput, setFieldNameInput] = useState('');
  const [fieldTypeInput, setFieldTypeInput] = useState<CustomFieldType>('text');

  // PDF Import Modal State
  const [pdfImportModalOpen, setPdfImportModalOpen] = useState(false);

  const detectedFields = useMemo(
    () => extractTemplateFields(content, customFields),
    [content, customFields]
  );

  const clickableTags = useMemo(() => {
    const customTags = customFields.map((cf) => cf.tag);
    return Array.from(new Set([...AVAILABLE_TAGS_FOR_EDITOR, ...customTags]));
  }, [customFields]);

  function openTemplateForEdit(tpl: DocumentTemplate) {
    setIsNewMode(false);
    setSelectedId(tpl.id);
    setTitle(tpl.title);
    setCategory(tpl.category);
    setContent(tpl.content);
    setIsDefault(tpl.isDefault);
    setCustomFields(tpl.customFields ?? []);
    setEditorMode('edit');
    setFeedback(null);
  }

  function openNewTemplateEditor() {
    setIsNewMode(true);
    setSelectedId('');
    setTitle('');
    setCategory('Mandato / Declaração');
    setContent(
      `Eu, {{NOME_COMPLETO}}, {{NACIONALIDADE}}, {{ESTADO_CIVIL}}, {{PROFISSAO}}, inscrito(a) no CPF n.º {{CPF}}, residente e domiciliado(a) {{ENDERECO_COMPLETO}}, declaro para os devidos fins.\n\nSaquarema, {{DATA_EXTENSO}}.`
    );
    setIsDefault(false);
    setCustomFields([]);
    setEditorMode('edit');
    setFeedback(null);
  }

  function handleOpenExtractedTemplate(data: {
    title: string;
    content: string;
    notice?: string;
  }) {
    setIsNewMode(true);
    setSelectedId('');
    setTitle(data.title);
    setCategory('Documento Importado');
    setContent(data.content);
    setIsDefault(false);
    setCustomFields([]);
    setEditorMode('edit');
    setFeedback(data.notice ?? null);
  }

  async function handleApplyLetterheadUpdates(
    updates: Partial<Omit<LetterheadSettings, 'updatedAt' | 'updatedBy'>>
  ) {
    const next = { ...lhForm, ...updates };
    setLhForm(next);
    await onSaveLetterhead(next);
  }

  function duplicateTemplate(tpl: DocumentTemplate) {
    setIsNewMode(true);
    setSelectedId('');
    setTitle(`${tpl.title} (Cópia)`);
    setCategory(tpl.category);
    setContent(tpl.content);
    setIsDefault(false);
    setCustomFields(tpl.customFields ?? []);
    setEditorMode('edit');
    setFeedback(null);
  }

  function handleInsertTagAtCursor(tag: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => (prev.endsWith(' ') || prev.endsWith('\n') ? `${prev}${tag}` : `${prev} ${tag}`));
      return;
    }

    const start = textarea.selectionStart ?? content.length;
    const end = textarea.selectionEnd ?? start;
    const { nextText, nextCursor } = insertTextAtCursor(content, tag, start, end);
    setContent(nextText);

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function openAddFieldModal() {
    setEditingFieldKey(null);
    setFieldNameInput('');
    setFieldTypeInput('text');
    setFieldModalOpen(true);
  }

  function openEditFieldModal(field: { key: string; label: string; fieldType?: CustomFieldType }) {
    setEditingFieldKey(field.key);
    setFieldNameInput(field.label);
    setFieldTypeInput(field.fieldType || 'text');
    setFieldModalOpen(true);
  }

  function handleSaveCustomField(e: React.FormEvent) {
    e.preventDefault();
    const cleanLabel = fieldNameInput.trim();
    if (!cleanLabel) return;

    const { key: generatedKey, tag: generatedTag } = generateTagFromFieldName(cleanLabel);

    if (editingFieldKey) {
      const oldTag = `{{${editingFieldKey}}}`;
      const updatedField: CustomTemplateField = {
        key: generatedKey,
        tag: generatedTag,
        label: cleanLabel,
        fieldType: fieldTypeInput,
      };
      setCustomFields((prev) => {
        const exists = prev.some((f) => f.key === editingFieldKey);
        if (exists) {
          return prev.map((f) => (f.key === editingFieldKey ? updatedField : f));
        }
        return [...prev, updatedField];
      });
      if (oldTag !== generatedTag && content.includes(oldTag)) {
        setContent((prev) => prev.split(oldTag).join(generatedTag));
      }
    } else {
      const newField: CustomTemplateField = {
        key: generatedKey,
        tag: generatedTag,
        label: cleanLabel,
        fieldType: fieldTypeInput,
      };
      setCustomFields((prev) => {
        const withoutSame = prev.filter((f) => f.key !== generatedKey);
        return [...withoutSame, newField];
      });
    }

    setFieldModalOpen(false);
  }

  function handleRemoveField(key: string, rawToken: string) {
    setCustomFields((prev) => prev.filter((f) => f.key !== key));
    if (content.includes(rawToken)) {
      setContent((prev) => prev.split(rawToken).join(''));
    }
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
        customFields,
      });
      setIsNewMode(false);
      setSelectedId(id);
      setEditorMode('list');
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
      setFeedback('Configuração do papel timbrado salva e aplicada aos novos PDFs.');
    } finally {
      setSavingLh(false);
    }
  }

  async function handleImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'logoDataUrl' | 'sealDataUrl'
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 360);
      const next = { ...lhForm, [target]: compressed };
      setLhForm(next);
      await onSaveLetterhead(next);
      setFeedback(
        target === 'logoDataUrl'
          ? 'Logomarca do escritório salva no papel timbrado.'
          : 'Selo / imagem complementar salvo no papel timbrado.'
      );
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao processar imagem.');
    }
  }

  const headerAlignment = lhForm.headerAlignment || 'center';

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

      {/* HUB VIEW */}
      {cmsView === 'hub' && (
        <section className="space-y-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#0B1D3A]">
              Modelo e Timbrado
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Escolha o módulo que deseja configurar para os documentos jurídicos do escritório.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <button
              type="button"
              onClick={() => {
                setCmsView('header');
                setFeedback(null);
              }}
              className="bg-white border border-slate-200 hover:border-[#B8934A] rounded-2xl p-6 text-left transition-colors flex flex-col justify-between min-h-[164px]"
            >
              <div className="w-11 h-11 rounded-xl bg-[#0B1D3A] text-[#CFAF6E] flex items-center justify-center mb-4">
                <LayoutTemplate className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-[#0B1D3A] mb-1">
                  Criar / Editar Cabeçalho
                </h3>
                <p className="text-sm text-slate-600">
                  Nome institucional, OAB, subtítulo, alinhamento e pré-visualização do cabeçalho A4.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setCmsView('footer');
                setFeedback(null);
              }}
              className="bg-white border border-slate-200 hover:border-[#B8934A] rounded-2xl p-6 text-left transition-colors flex flex-col justify-between min-h-[164px]"
            >
              <div className="w-11 h-11 rounded-xl bg-[#F7F1E3] text-[#9A7835] flex items-center justify-center mb-4">
                <PanelBottom className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-[#0B1D3A] mb-1">
                  Criar / Editar Rodapé do PDF
                </h3>
                <p className="text-sm text-slate-600">
                  Endereço completo, telefone/WhatsApp, e-mail, Instagram e site exibidos nos PDFs.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setCmsView('images');
                setFeedback(null);
              }}
              className="bg-white border border-slate-200 hover:border-[#B8934A] rounded-2xl p-6 text-left transition-colors flex flex-col justify-between min-h-[164px]"
            >
              <div className="w-11 h-11 rounded-xl bg-[#F7F1E3] text-[#9A7835] flex items-center justify-center mb-4">
                <ImagePlus className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-[#0B1D3A] mb-1">
                  Cadastrar Imagens / Logo
                </h3>
                <p className="text-sm text-slate-600">
                  Envie e gerencie a logomarca oficial do escritório e selos para o papel timbrado.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setCmsView('templates');
                setEditorMode('list');
                setFeedback(null);
              }}
              className="bg-white border border-slate-200 hover:border-[#B8934A] rounded-2xl p-6 text-left transition-colors flex flex-col justify-between min-h-[164px]"
            >
              <div className="w-11 h-11 rounded-xl bg-[#0B1D3A] text-[#CFAF6E] flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-[#0B1D3A] mb-1">
                  Modelos de Documentos
                </h3>
                <p className="text-sm text-slate-600">
                  Crie novos documentos, edite textos jurídicos, variáveis dinâmicas e campos
                  personalizados ({templates.length} modelos).
                </p>
              </div>
            </button>
          </div>
        </section>
      )}

      {/* SUB-VIEW: HEADER EDITOR */}
      {cmsView === 'header' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setCmsView('hub')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B1D3A] hover:text-[#9A7835] min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Voltar para Modelo e Timbrado
            </button>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-[#0B1D3A]">
              Criar / Editar Cabeçalho do PDF
            </h2>
            <p className="text-sm text-slate-600">
              Configuração aplicada automaticamente no topo de todos os documentos A4 gerados.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleSaveLetterheadSubmit} className="lg:col-span-6 space-y-4">
              <div>
                <label htmlFor="lh-title" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                  Título Institucional / Escritório
                </label>
                <input
                  id="lh-title"
                  type="text"
                  value={lhForm.officeTitle}
                  onChange={(e) => setLhForm((p) => ({ ...p, officeTitle: e.target.value }))}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="lh-oab" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Inscrição OAB
                  </label>
                  <input
                    id="lh-oab"
                    type="text"
                    value={lhForm.oabNumber}
                    onChange={(e) => setLhForm((p) => ({ ...p, oabNumber: e.target.value }))}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="lh-subtitle" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Subtítulo (opcional)
                  </label>
                  <input
                    id="lh-subtitle"
                    type="text"
                    value={lhForm.subtitle || ''}
                    onChange={(e) => setLhForm((p) => ({ ...p, subtitle: e.target.value }))}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <span className="block text-sm font-semibold text-[#0B1D3A] mb-2">
                  Alinhamento do Cabeçalho
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'left', label: 'Esquerda', icon: AlignLeft },
                      { id: 'center', label: 'Centralizado', icon: AlignCenter },
                      { id: 'right', label: 'Direita', icon: AlignRight },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLhForm((p) => ({ ...p, headerAlignment: opt.id }))}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                          headerAlignment === opt.id
                            ? 'bg-[#0B1D3A] text-white border-[#0B1D3A]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" aria-hidden="true" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingLh}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                {savingLh ? 'Salvando...' : 'Salvar Cabeçalho'}
              </button>
            </form>

            {/* Live Header Preview */}
            <div className="lg:col-span-6 bg-[#F7F8FA] border border-slate-200 rounded-xl p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Pré-visualização no Documento A4
              </p>
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                <div className="h-2 bg-[#0B1D3A]" />
                <div
                  className={`p-6 ${
                    headerAlignment === 'left'
                      ? 'text-left'
                      : headerAlignment === 'right'
                        ? 'text-right'
                        : 'text-center'
                  }`}
                >
                  {lhForm.logoDataUrl && (
                    <img
                      src={lhForm.logoDataUrl}
                      alt="Logo do escritório"
                      className={`h-12 w-auto object-contain mb-3 ${
                        headerAlignment === 'center'
                          ? 'mx-auto'
                          : headerAlignment === 'right'
                            ? 'ml-auto'
                            : ''
                      }`}
                    />
                  )}
                  <p className="font-display text-sm font-bold text-[#0B1D3A] uppercase">
                    {lhForm.officeTitle}
                  </p>
                  <p className="text-xs font-semibold text-[#9A7835] mt-1">
                    {lhForm.oabNumber}
                    {lhForm.subtitle ? ` | ${lhForm.subtitle}` : ''}
                  </p>
                  <div className="h-0.5 bg-[#B8934A] mt-4" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SUB-VIEW: FOOTER EDITOR */}
      {cmsView === 'footer' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <button
            type="button"
            onClick={() => setCmsView('hub')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B1D3A] hover:text-[#9A7835] min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Voltar para Modelo e Timbrado
          </button>

          <div>
            <h2 className="font-display text-2xl font-bold text-[#0B1D3A]">
              Criar / Editar Rodapé do PDF
            </h2>
            <p className="text-sm text-slate-600">
              Informações institucionais impressas na margem inferior de cada página do PDF.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleSaveLetterheadSubmit} className="lg:col-span-7 space-y-4">
              <div>
                <label htmlFor="lh-address" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                  Endereço Completo
                </label>
                <input
                  id="lh-address"
                  type="text"
                  value={lhForm.addressFooter}
                  onChange={(e) => setLhForm((p) => ({ ...p, addressFooter: e.target.value }))}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lh-phone" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Telefone / WhatsApp
                  </label>
                  <input
                    id="lh-phone"
                    type="text"
                    value={lhForm.phone}
                    onChange={(e) => setLhForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="lh-email" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    E-mail
                  </label>
                  <input
                    id="lh-email"
                    type="email"
                    value={lhForm.email}
                    onChange={(e) => setLhForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lh-insta" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Instagram
                  </label>
                  <input
                    id="lh-insta"
                    type="text"
                    value={lhForm.instagram || ''}
                    onChange={(e) => setLhForm((p) => ({ ...p, instagram: e.target.value }))}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="lh-site" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Site (opcional)
                  </label>
                  <input
                    id="lh-site"
                    type="text"
                    value={lhForm.website || ''}
                    onChange={(e) => setLhForm((p) => ({ ...p, website: e.target.value }))}
                    placeholder="https://mayaramartins.adv.br"
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingLh}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                {savingLh ? 'Salvando...' : 'Salvar Rodapé do PDF'}
              </button>
            </form>

            <div className="lg:col-span-5 bg-[#F7F8FA] border border-slate-200 rounded-xl p-6 flex flex-col justify-end">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Pré-visualização do Rodapé A4
              </p>
              <div className="bg-white border border-slate-200 rounded-lg p-5 text-center space-y-1">
                <div className="h-px bg-slate-300 mb-3" />
                <p className="text-xs text-slate-700">{lhForm.addressFooter}</p>
                <p className="text-xs text-slate-600">
                  {[
                    `Tel/WhatsApp: ${lhForm.phone}`,
                    `E-mail: ${lhForm.email}`,
                    lhForm.instagram,
                    lhForm.website,
                  ]
                    .filter(Boolean)
                    .join(' | ')}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SUB-VIEW: IMAGES & LOGO */}
      {cmsView === 'images' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <button
            type="button"
            onClick={() => setCmsView('hub')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B1D3A] hover:text-[#9A7835] min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Voltar para Modelo e Timbrado
          </button>

          <div>
            <h2 className="font-display text-2xl font-bold text-[#0B1D3A]">
              Cadastrar Imagens / Logo
            </h2>
            <p className="text-sm text-slate-600">
              Faça upload da logomarca oficial e de um selo opcional para aparecerem no papel
              timbrado dos PDFs gerados.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Card */}
            <div className="p-5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-4">
              <h3 className="text-base font-semibold text-[#0B1D3A]">
                Logomarca do Escritório (Cabeçalho)
              </h3>
              <div className="h-36 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-4">
                {lhForm.logoDataUrl ? (
                  <img
                    src={lhForm.logoDataUrl}
                    alt="Logomarca cadastrada"
                    className="max-h-28 w-auto object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400">Nenhuma logomarca cadastrada</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132B52] cursor-pointer inline-flex items-center gap-2">
                  <ImagePlus className="w-4 h-4" aria-hidden="true" />
                  Selecionar Logomarca
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void handleImageUpload(e, 'logoDataUrl')}
                    className="sr-only"
                  />
                </label>
                {lhForm.logoDataUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      const next = { ...lhForm, logoDataUrl: null };
                      setLhForm(next);
                      await onSaveLetterhead(next);
                      setFeedback('Logomarca removida do papel timbrado.');
                    }}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-red-200 text-red-700 text-xs sm:text-sm font-semibold hover:bg-red-50"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>

            {/* Seal Card */}
            <div className="p-5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-4">
              <h3 className="text-base font-semibold text-[#0B1D3A]">
                Selo / Carimbo Institucional (Rodapé)
              </h3>
              <div className="h-36 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-4">
                {lhForm.sealDataUrl ? (
                  <img
                    src={lhForm.sealDataUrl}
                    alt="Selo institucional cadastrado"
                    className="max-h-28 w-auto object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400">Nenhum selo cadastrado</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132B52] cursor-pointer inline-flex items-center gap-2">
                  <ImagePlus className="w-4 h-4" aria-hidden="true" />
                  Selecionar Selo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void handleImageUpload(e, 'sealDataUrl')}
                    className="sr-only"
                  />
                </label>
                {lhForm.sealDataUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      const next = { ...lhForm, sealDataUrl: null };
                      setLhForm(next);
                      await onSaveLetterhead(next);
                      setFeedback('Selo removido do papel timbrado.');
                    }}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-red-200 text-red-700 text-xs sm:text-sm font-semibold hover:bg-red-50"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SUB-VIEW: DOCUMENT TEMPLATES */}
      {cmsView === 'templates' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                if (editorMode === 'edit') {
                  setEditorMode('list');
                } else {
                  setCmsView('hub');
                }
              }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B1D3A] hover:text-[#9A7835] min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              {editorMode === 'edit' ? 'Voltar para Lista de Modelos' : 'Voltar para Modelo e Timbrado'}
            </button>

            {editorMode === 'list' && (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setPdfImportModalOpen(true)}
                  className="min-h-[48px] px-4 py-2.5 rounded-xl border border-[#B8934A] bg-[#F7F1E3]/60 text-[#0B1D3A] text-sm font-semibold hover:bg-[#F7F1E3] inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <FileUp className="w-4 h-4 text-[#9A7835]" aria-hidden="true" />
                  Importar de PDF
                </button>
                <button
                  type="button"
                  onClick={openNewTemplateEditor}
                  className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Novo Modelo de Documento
                </button>
              </div>
            )}
          </div>

          {/* LIST VIEW */}
          {editorMode === 'list' && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#0B1D3A]">
                  Modelos de Documentos
                </h2>
                <p className="text-sm text-slate-600">
                  Selecione um modelo existente para editar texto e campos, ou crie um novo modelo.
                </p>
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                {templates.map((tpl) => {
                  const fieldCount = extractTemplateFields(tpl.content, tpl.customFields).length;
                  return (
                    <div
                      key={tpl.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/70"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-[#0B1D3A]">{tpl.title}</h3>
                          {tpl.isDefault && (
                            <span className="text-xs font-semibold text-[#9A7835]">
                              · Modelo Padrão
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5 tabular-nums">
                          {tpl.category} · {fieldCount} campos detectados
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openTemplateForEdit(tpl)}
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132B52] inline-flex items-center gap-1.5"
                        >
                          <Edit3 className="w-4 h-4" aria-hidden="true" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateTemplate(tpl)}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-[#0B1D3A] text-xs sm:text-sm font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5"
                        >
                          <CopyPlus className="w-4 h-4" aria-hidden="true" />
                          Duplicar
                        </button>
                        {templates.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Excluir modelo ${tpl.title}`}
                            onClick={() => void onDeleteTemplate(tpl.id)}
                            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-red-700 hover:border-red-200 hover:bg-red-50 inline-flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* EDITOR VIEW (Only opens when user clicks Novo Modelo or Editar) */}
          {editorMode === 'edit' && (
            <form onSubmit={handleSaveTemplateSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-4">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B1D3A]">
                  {isNewMode ? 'Novo Modelo de Documento' : `Editando: ${title}`}
                </h2>

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

                {/* Clickable Tag Toolbar (inserts at exact textarea cursor position!) */}
                <div>
                  <span className="block text-xs font-semibold text-slate-600 mb-2">
                    Clique em uma variável para inserir na posição do cursor:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {clickableTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleInsertTagAtCursor(tag)}
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
                    ref={textareaRef}
                    rows={13}
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

                  <button
                    type="submit"
                    disabled={savingTpl}
                    className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" aria-hidden="true" />
                    {savingTpl ? 'Salvando...' : 'Salvar Modelo'}
                  </button>
                </div>
              </div>

              {/* Fields Manager Sidebar */}
              <aside className="lg:col-span-4 bg-[#F7F8FA] border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-[#0B1D3A]">
                      Campos do Formulário
                    </h3>
                    <button
                      type="button"
                      onClick={openAddFieldModal}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132B52] inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      Adicionar Campo
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Campos exibidos ao cliente na Etapa 1. Clique em editar para alterar rótulo ou
                    tipo.
                  </p>

                  {detectedFields.length === 0 ? (
                    <p className="text-xs text-slate-500">Nenhuma variável detectada.</p>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {detectedFields.map((field) => (
                        <li
                          key={field.rawToken}
                          className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-[#0B1D3A] truncate">{field.label}</p>
                            <p className="font-mono text-[11px] text-slate-500 truncate">
                              {field.rawToken}
                              {field.fieldType ? ` · ${FIELD_TYPE_LABELS[field.fieldType]}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              aria-label={`Editar campo ${field.label}`}
                              onClick={() => openEditFieldModal(field)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-[#0B1D3A] hover:bg-slate-100"
                            >
                              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Excluir campo ${field.label}`}
                              onClick={() => handleRemoveField(field.key, field.rawToken)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
            </form>
          )}
        </section>
      )}

      {/* MODAL: ADD / EDIT CUSTOM FIELD */}
      {fieldModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1D3A]/45 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-field-modal-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 id="custom-field-modal-title" className="font-display text-lg font-bold text-[#0B1D3A]">
                {editingFieldKey ? 'Editar Campo do Formulário' : 'Adicionar Campo Personalizado'}
              </h3>
              <button
                type="button"
                aria-label="Fechar modal"
                onClick={() => setFieldModalOpen(false)}
                className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomField} className="space-y-4">
              <div>
                <label htmlFor="cf-name" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                  Nome do Campo
                </label>
                <input
                  id="cf-name"
                  type="text"
                  value={fieldNameInput}
                  onChange={(e) => setFieldNameInput(e.target.value)}
                  placeholder="Ex.: Número do Processo"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  required
                />
                {fieldNameInput.trim() && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Tag gerada:{' '}
                    <span className="font-mono font-semibold text-[#0B1D3A]">
                      {generateTagFromFieldName(fieldNameInput).tag}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="cf-type" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                  Tipo do Campo
                </label>
                <select
                  id="cf-type"
                  value={fieldTypeInput}
                  onChange={(e) => setFieldTypeInput(e.target.value as CustomFieldType)}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="date">Data</option>
                  <option value="cpf_cnpj">CPF / CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFieldModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52]"
                >
                  {editingFieldKey ? 'Salvar Alterações' : 'Criar Campo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT TEMPLATE FROM PDF */}
      <PdfTemplateImportModal
        isOpen={pdfImportModalOpen}
        onClose={() => setPdfImportModalOpen(false)}
        onOpenExtractedTemplate={handleOpenExtractedTemplate}
        onApplyLetterheadUpdates={handleApplyLetterheadUpdates}
      />
    </div>
  );
}
