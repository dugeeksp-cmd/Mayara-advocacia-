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
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { PdfTemplateImportModal } from './PdfTemplateImportModal';
import type {
  CustomFieldType,
  CustomTemplateField,
  DocumentTemplate,
  FooterProfile,
  HeaderAlignment,
  HeaderProfile,
  LetterheadSettings,
  LogoAsset,
  TimbradoFontFamily,
  TimbradoTextSize,
} from '../types/legal';
import type {
  SaveFooterInput,
  SaveHeaderInput,
  SaveLogoInput,
  SaveTemplateInput,
} from '../services/dataService';
import { sanitizeFilenamePart } from '../utils/masksAndFormatters';
import {
  AVAILABLE_TAGS_FOR_EDITOR,
  extractTemplateFields,
  generateTagFromFieldName,
  insertTextAtCursor,
} from '../utils/templateEngine';
import {
  getFontOption,
  getSizeOption,
  normalizeHexColor,
  TIMBRADO_COLOR_SWATCHES,
  TIMBRADO_FONT_OPTIONS,
  TIMBRADO_SIZE_OPTIONS,
} from '../utils/timbradoTheme';

type CmsView = 'hub' | 'header' | 'footer' | 'images' | 'templates';

interface AdminCmsEditorProps {
  templates: DocumentTemplate[];
  headers: HeaderProfile[];
  footers: FooterProfile[];
  logos: LogoAsset[];
  letterhead: LetterheadSettings;
  onSaveTemplate: (tpl: SaveTemplateInput) => Promise<DocumentTemplate>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onSaveHeader: (input: SaveHeaderInput) => Promise<HeaderProfile>;
  onDeleteHeader: (id: string) => Promise<void>;
  onSaveFooter: (input: SaveFooterInput) => Promise<FooterProfile>;
  onDeleteFooter: (id: string) => Promise<void>;
  onSaveLogo: (input: SaveLogoInput) => Promise<LogoAsset>;
  onDeleteLogo: (id: string) => Promise<void>;
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

const DEFAULT_SELECT_VAL = '__default__';
const NONE_SELECT_VAL = '__none__';

function toSelectValue(id: string | null | undefined): string {
  if (id === null) return NONE_SELECT_VAL;
  if (typeof id === 'string' && id.length > 0) return id;
  return DEFAULT_SELECT_VAL;
}

function fromSelectValue(val: string): string | null | undefined {
  if (val === NONE_SELECT_VAL) return null;
  if (val === DEFAULT_SELECT_VAL) return undefined;
  return val;
}

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
  headers,
  footers,
  logos,
  letterhead,
  onSaveTemplate,
  onDeleteTemplate,
  onSaveHeader,
  onDeleteHeader,
  onSaveFooter,
  onDeleteFooter,
  onSaveLogo,
  onDeleteLogo,
  onSaveLetterhead,
}: AdminCmsEditorProps) {
  const [cmsView, setCmsView] = useState<CmsView>('hub');
  const [feedback, setFeedback] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Header Profile Editor State
  // -------------------------------------------------------------------------
  const initialHeader = headers.find((h) => h.isDefault) || headers[0];
  const [headerFormId, setHeaderFormId] = useState<string>(initialHeader?.id || '');
  const [isNewHeader, setIsNewHeader] = useState(false);
  const [headerForm, setHeaderForm] = useState({
    name: initialHeader?.name || 'Cabeçalho Principal',
    officeTitle: initialHeader?.officeTitle || letterhead.officeTitle,
    oabNumber: initialHeader?.oabNumber || letterhead.oabNumber,
    subtitle: initialHeader?.subtitle || letterhead.subtitle || '',
    alignment: (initialHeader?.alignment || 'center') as HeaderAlignment,
    fontFamily: (initialHeader?.fontFamily || 'playfair') as TimbradoFontFamily,
    textSize: (initialHeader?.textSize || 'medium') as TimbradoTextSize,
    textColor: initialHeader?.textColor || '#0B1D3A',
    isDefault: initialHeader?.isDefault ?? true,
  });
  const [savingHeader, setSavingHeader] = useState(false);

  // -------------------------------------------------------------------------
  // Footer Profile Editor State
  // -------------------------------------------------------------------------
  const initialFooter = footers.find((f) => f.isDefault) || footers[0];
  const [footerFormId, setFooterFormId] = useState<string>(initialFooter?.id || '');
  const [isNewFooter, setIsNewFooter] = useState(false);
  const [footerForm, setFooterForm] = useState({
    name: initialFooter?.name || 'Rodapé Principal',
    addressFooter: initialFooter?.addressFooter || letterhead.addressFooter,
    phone: initialFooter?.phone || letterhead.phone,
    email: initialFooter?.email || letterhead.email,
    instagram: initialFooter?.instagram || letterhead.instagram || '',
    website: initialFooter?.website || letterhead.website || '',
    alignment: (initialFooter?.alignment || 'center') as HeaderAlignment,
    fontFamily: (initialFooter?.fontFamily || 'inter') as TimbradoFontFamily,
    textSize: (initialFooter?.textSize || 'medium') as TimbradoTextSize,
    textColor: initialFooter?.textColor || '#475569',
    isDefault: initialFooter?.isDefault ?? true,
  });
  const [savingFooter, setSavingFooter] = useState(false);

  // -------------------------------------------------------------------------
  // Logo Upload State
  // -------------------------------------------------------------------------
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoFormat, setNewLogoFormat] = useState('Horizontal');
  const [newLogoDefault, setNewLogoDefault] = useState(logos.length === 0);
  const [savingLogo, setSavingLogo] = useState(false);

  // -------------------------------------------------------------------------
  // Templates List vs Editor State
  // -------------------------------------------------------------------------
  const [editorMode, setEditorMode] = useState<'list' | 'edit'>('list');
  const [selectedId, setSelectedId] = useState<string>('');
  const [isNewMode, setIsNewMode] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [customFields, setCustomFields] = useState<CustomTemplateField[]>([]);
  const [tplHeaderSelect, setTplHeaderSelect] = useState<string>(DEFAULT_SELECT_VAL);
  const [tplFooterSelect, setTplFooterSelect] = useState<string>(DEFAULT_SELECT_VAL);
  const [tplLogoSelect, setTplLogoSelect] = useState<string>(DEFAULT_SELECT_VAL);
  const [savingTpl, setSavingTpl] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Custom Field Modal State
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [fieldNameInput, setFieldNameInput] = useState('');
  const [fieldTypeInput, setFieldTypeInput] = useState<CustomFieldType>('text');

  // PDF Import Modal State
  const [pdfImportModalOpen, setPdfImportModalOpen] = useState(false);

  const defaultLogo = useMemo(
    () => logos.find((l) => l.isDefault) || logos[0] || null,
    [logos]
  );

  const detectedFields = useMemo(
    () => extractTemplateFields(content, customFields),
    [content, customFields]
  );

  const clickableTags = useMemo(() => {
    const customTags = customFields.map((cf) => cf.tag);
    return Array.from(new Set([...AVAILABLE_TAGS_FOR_EDITOR, ...customTags]));
  }, [customFields]);

  // -------------------------------------------------------------------------
  // Header Handlers
  // -------------------------------------------------------------------------
  function selectHeaderToEdit(h: HeaderProfile) {
    setIsNewHeader(false);
    setHeaderFormId(h.id);
    setHeaderForm({
      name: h.name,
      officeTitle: h.officeTitle,
      oabNumber: h.oabNumber,
      subtitle: h.subtitle || '',
      alignment: h.alignment,
      fontFamily: h.fontFamily,
      textSize: h.textSize,
      textColor: h.textColor,
      isDefault: h.isDefault,
    });
    setFeedback(null);
  }

  function startNewHeader() {
    setIsNewHeader(true);
    setHeaderFormId('');
    setHeaderForm({
      name: '',
      officeTitle: 'MAYARA MARTINS — ADVOCACIA E CONSULTORIA JURÍDICA',
      oabNumber: 'OAB/RJ 229.359',
      subtitle: '',
      alignment: 'center',
      fontFamily: 'playfair',
      textSize: 'medium',
      textColor: '#0B1D3A',
      isDefault: headers.length === 0,
    });
    setFeedback(null);
  }

  async function handleSaveHeaderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!headerForm.name.trim() || !headerForm.officeTitle.trim()) return;
    setSavingHeader(true);
    setFeedback(null);
    try {
      const id =
        !isNewHeader && headerFormId
          ? headerFormId
          : `header_${sanitizeFilenamePart(headerForm.name).toLowerCase()}_${Date.now().toString(36)}`;
      const saved = await onSaveHeader({
        id,
        name: headerForm.name.trim(),
        officeTitle: headerForm.officeTitle.trim(),
        oabNumber: headerForm.oabNumber.trim(),
        subtitle: headerForm.subtitle.trim(),
        alignment: headerForm.alignment,
        fontFamily: headerForm.fontFamily,
        textSize: headerForm.textSize,
        textColor: normalizeHexColor(headerForm.textColor, '#0B1D3A'),
        isDefault: headerForm.isDefault,
      });
      setIsNewHeader(false);
      setHeaderFormId(saved.id);
      setFeedback(`Cabeçalho "${saved.name}" salvo e sincronizado na nuvem.`);
    } finally {
      setSavingHeader(false);
    }
  }

  // -------------------------------------------------------------------------
  // Footer Handlers
  // -------------------------------------------------------------------------
  function selectFooterToEdit(f: FooterProfile) {
    setIsNewFooter(false);
    setFooterFormId(f.id);
    setFooterForm({
      name: f.name,
      addressFooter: f.addressFooter,
      phone: f.phone,
      email: f.email,
      instagram: f.instagram || '',
      website: f.website || '',
      alignment: f.alignment,
      fontFamily: f.fontFamily,
      textSize: f.textSize,
      textColor: f.textColor,
      isDefault: f.isDefault,
    });
    setFeedback(null);
  }

  function startNewFooter() {
    setIsNewFooter(true);
    setFooterFormId('');
    setFooterForm({
      name: '',
      addressFooter: letterhead.addressFooter,
      phone: letterhead.phone,
      email: letterhead.email,
      instagram: letterhead.instagram || '',
      website: letterhead.website || '',
      alignment: 'center',
      fontFamily: 'inter',
      textSize: 'medium',
      textColor: '#475569',
      isDefault: footers.length === 0,
    });
    setFeedback(null);
  }

  async function handleSaveFooterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!footerForm.name.trim() || !footerForm.addressFooter.trim()) return;
    setSavingFooter(true);
    setFeedback(null);
    try {
      const id =
        !isNewFooter && footerFormId
          ? footerFormId
          : `footer_${sanitizeFilenamePart(footerForm.name).toLowerCase()}_${Date.now().toString(36)}`;
      const saved = await onSaveFooter({
        id,
        name: footerForm.name.trim(),
        addressFooter: footerForm.addressFooter.trim(),
        phone: footerForm.phone.trim(),
        email: footerForm.email.trim(),
        instagram: footerForm.instagram.trim(),
        website: footerForm.website.trim(),
        alignment: footerForm.alignment,
        fontFamily: footerForm.fontFamily,
        textSize: footerForm.textSize,
        textColor: normalizeHexColor(footerForm.textColor, '#475569'),
        isDefault: footerForm.isDefault,
      });
      setIsNewFooter(false);
      setFooterFormId(saved.id);
      setFeedback(`Rodapé "${saved.name}" salvo e sincronizado na nuvem.`);
    } finally {
      setSavingFooter(false);
    }
  }

  // -------------------------------------------------------------------------
  // Logo / Image Handlers
  // -------------------------------------------------------------------------
  async function handleLogoFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSavingLogo(true);
    setFeedback(null);
    try {
      const dataUrl = await compressImageToDataUrl(file, 360);
      const baseName =
        newLogoName.trim() || file.name.replace(/\.[^.]+$/, '') || 'Logotipo Escritório';
      const id = `logo_${sanitizeFilenamePart(baseName).toLowerCase()}_${Date.now().toString(36)}`;
      const saved = await onSaveLogo({
        id,
        name: baseName,
        formatLabel: newLogoFormat.trim() || 'Padrão',
        dataUrl,
        isDefault: newLogoDefault || logos.length === 0,
      });
      setNewLogoName('');
      setNewLogoDefault(false);
      setFeedback(`Logotipo "${saved.name}" cadastrado e sincronizado na nuvem.`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao processar imagem.');
    } finally {
      setSavingLogo(false);
    }
  }

  async function handleSealUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 360);
      await onSaveLetterhead({ ...letterhead, sealDataUrl: compressed });
      setFeedback('Selo / carimbo complementar atualizado.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao processar imagem.');
    }
  }

  // -------------------------------------------------------------------------
  // Template Handlers
  // -------------------------------------------------------------------------
  function openTemplateForEdit(tpl: DocumentTemplate) {
    setIsNewMode(false);
    setSelectedId(tpl.id);
    setTitle(tpl.title);
    setCategory(tpl.category);
    setContent(tpl.content);
    setIsDefault(tpl.isDefault);
    setCustomFields(tpl.customFields ?? []);
    setTplHeaderSelect(toSelectValue(tpl.headerId));
    setTplFooterSelect(toSelectValue(tpl.footerId));
    setTplLogoSelect(toSelectValue(tpl.logoId));
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
    setTplHeaderSelect(DEFAULT_SELECT_VAL);
    setTplFooterSelect(DEFAULT_SELECT_VAL);
    setTplLogoSelect(DEFAULT_SELECT_VAL);
    setEditorMode('edit');
    setFeedback(null);
  }

  function handleOpenExtractedTemplate(data: {
    title: string;
    content: string;
    headerId?: string | null;
    footerId?: string | null;
    logoId?: string | null;
    notice?: string;
  }) {
    setIsNewMode(true);
    setSelectedId('');
    setTitle(data.title);
    setCategory('Documento Importado');
    setContent(data.content);
    setIsDefault(false);
    setCustomFields([]);
    setTplHeaderSelect(toSelectValue(data.headerId));
    setTplFooterSelect(toSelectValue(data.footerId));
    setTplLogoSelect(toSelectValue(data.logoId));
    setEditorMode('edit');
    setFeedback(data.notice ?? null);
  }

  function duplicateTemplate(tpl: DocumentTemplate) {
    setIsNewMode(true);
    setSelectedId('');
    setTitle(`${tpl.title} (Cópia)`);
    setCategory(tpl.category);
    setContent(tpl.content);
    setIsDefault(false);
    setCustomFields(tpl.customFields ?? []);
    setTplHeaderSelect(toSelectValue(tpl.headerId));
    setTplFooterSelect(toSelectValue(tpl.footerId));
    setTplLogoSelect(toSelectValue(tpl.logoId));
    setEditorMode('edit');
    setFeedback(null);
  }

  function handleInsertTagAtCursor(tag: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) =>
        prev.endsWith(' ') || prev.endsWith('\n') ? `${prev}${tag}` : `${prev} ${tag}`
      );
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
        headerId: fromSelectValue(tplHeaderSelect),
        footerId: fromSelectValue(tplFooterSelect),
        logoId: fromSelectValue(tplLogoSelect),
      });
      setIsNewMode(false);
      setSelectedId(id);
      setEditorMode('list');
      setFeedback('Modelo de documento salvo e sincronizado na nuvem.');
    } finally {
      setSavingTpl(false);
    }
  }

  // Live Preview Computed Styles
  const headerFontOpt = getFontOption(headerForm.fontFamily);
  const headerSizeOpt = getSizeOption(headerForm.textSize);
  const headerColorHex = normalizeHexColor(headerForm.textColor, '#0B1D3A');

  const footerFontOpt = getFontOption(footerForm.fontFamily);
  const footerSizeOpt = getSizeOption(footerForm.textSize);
  const footerColorHex = normalizeHexColor(footerForm.textColor, '#475569');

  function describeBinding(tpl: DocumentTemplate): string {
    const h =
      tpl.headerId === null
        ? 'Sem cabeçalho'
        : tpl.headerId
          ? headers.find((x) => x.id === tpl.headerId)?.name || 'Cabeçalho personalizado'
          : 'Cabeçalho padrão';
    const f =
      tpl.footerId === null
        ? 'Sem rodapé'
        : tpl.footerId
          ? footers.find((x) => x.id === tpl.footerId)?.name || 'Rodapé personalizado'
          : 'Rodapé padrão';
    return `${h} · ${f}`;
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

      {/* HUB VIEW */}
      {cmsView === 'hub' && (
        <section className="space-y-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#0B1D3A]">
              Modelo e Timbrado
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Gerencie múltiplos perfis de cabeçalho, rodapé, logotipos e vincule-os livremente a
              cada modelo jurídico.
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
                  Múltiplos cabeçalhos com fonte, tamanho, cor e alinhamento personalizados (
                  {headers.length} {headers.length === 1 ? 'perfil' : 'perfis'}).
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
                  Múltiplos rodapés com endereço, contatos, tipografia e cores (
                  {footers.length} {footers.length === 1 ? 'perfil' : 'perfis'}).
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
                  Galeria de logotipos nomeados e selos institucionais para uso nos documentos (
                  {logos.length} {logos.length === 1 ? 'logo' : 'logos'}).
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
                  Crie ou importe modelos de PDF e escolha cabeçalho, rodapé e logo por documento (
                  {templates.length} modelos).
                </p>
              </div>
            </button>
          </div>
        </section>
      )}

      {/* SUB-VIEW: MULTIPLE HEADERS EDITOR */}
      {cmsView === 'header' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCmsView('hub')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B1D3A] hover:text-[#9A7835] min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Voltar para Modelo e Timbrado
            </button>

            <button
              type="button"
              onClick={startNewHeader}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Novo Cabeçalho
            </button>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-[#0B1D3A]">
              Perfis de Cabeçalho do PDF
            </h2>
            <p className="text-sm text-slate-600">
              Cadastre diferentes cabeçalhos com fonte, cor, tamanho e alinhamento próprios.
            </p>
          </div>

          {/* Saved Headers Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {headers.map((h) => {
              const active = !isNewHeader && headerFormId === h.id;
              return (
                <div
                  key={h.id}
                  className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-2.5 ${
                    active
                      ? 'border-[#0B1D3A] bg-[#F7F1E3]/35'
                      : 'border-slate-200 bg-[#F7F8FA]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#0B1D3A] truncate">{h.name}</span>
                      {h.isDefault && (
                        <span className="text-[11px] font-semibold text-[#9A7835] inline-flex items-center gap-1 shrink-0">
                          <Star className="w-3 h-3 fill-[#9A7835]" aria-hidden="true" />
                          Padrão
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 truncate mt-0.5">{h.officeTitle}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {getFontOption(h.fontFamily).label} · {getSizeOption(h.textSize).label}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => selectHeaderToEdit(h)}
                      className="min-h-[36px] flex-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-[#0B1D3A] hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    {!h.isDefault && (
                      <button
                        type="button"
                        onClick={() => void onSaveHeader({ ...h, isDefault: true })}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-[#9A7835] hover:bg-slate-50"
                      >
                        Padrão
                      </button>
                    )}
                    {headers.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Excluir cabeçalho ${h.name}`}
                        onClick={() => {
                          void onDeleteHeader(h.id);
                          const remaining = headers.find((x) => x.id !== h.id);
                          if (remaining) selectHeaderToEdit(remaining);
                        }}
                        className="min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-red-700 hover:border-red-200 inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            <form onSubmit={handleSaveHeaderSubmit} className="lg:col-span-6 space-y-4">
              <div>
                <label htmlFor="hdr-name" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                  Nome do Perfil do Cabeçalho
                </label>
                <input
                  id="hdr-name"
                  type="text"
                  value={headerForm.name}
                  onChange={(e) => setHeaderForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex.: Cabeçalho Principal, Minimalista..."
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="hdr-title" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                  Título Institucional / Escritório
                </label>
                <input
                  id="hdr-title"
                  type="text"
                  value={headerForm.officeTitle}
                  onChange={(e) => setHeaderForm((p) => ({ ...p, officeTitle: e.target.value }))}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="hdr-oab" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Inscrição OAB
                  </label>
                  <input
                    id="hdr-oab"
                    type="text"
                    value={headerForm.oabNumber}
                    onChange={(e) => setHeaderForm((p) => ({ ...p, oabNumber: e.target.value }))}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="hdr-subtitle" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Subtítulo (opcional)
                  </label>
                  <input
                    id="hdr-subtitle"
                    type="text"
                    value={headerForm.subtitle}
                    onChange={(e) => setHeaderForm((p) => ({ ...p, subtitle: e.target.value }))}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="hdr-font" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Fonte
                  </label>
                  <select
                    id="hdr-font"
                    value={headerForm.fontFamily}
                    onChange={(e) =>
                      setHeaderForm((p) => ({
                        ...p,
                        fontFamily: e.target.value as TimbradoFontFamily,
                      }))
                    }
                    className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    {TIMBRADO_FONT_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label} ({opt.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="hdr-size" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Tamanho do Texto
                  </label>
                  <select
                    id="hdr-size"
                    value={headerForm.textSize}
                    onChange={(e) =>
                      setHeaderForm((p) => ({
                        ...p,
                        textSize: e.target.value as TimbradoTextSize,
                      }))
                    }
                    className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    {TIMBRADO_SIZE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <span className="block text-sm font-semibold text-[#0B1D3A] mb-2">
                  Cor do Texto
                </span>
                <div className="flex flex-wrap items-center gap-2.5">
                  {TIMBRADO_COLOR_SWATCHES.map((sw) => {
                    const selected = headerColorHex === sw.hex;
                    return (
                      <button
                        key={sw.hex}
                        type="button"
                        onClick={() => setHeaderForm((p) => ({ ...p, textColor: sw.hex }))}
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 ${
                          selected
                            ? 'border-[#0B1D3A] bg-slate-100 text-[#0B1D3A]'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-black/15"
                          style={{ backgroundColor: sw.hex }}
                        />
                        {sw.label}
                      </button>
                    );
                  })}
                  <label className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="color"
                      aria-label="Cor personalizada do cabeçalho"
                      value={headerColorHex}
                      onChange={(e) => setHeaderForm((p) => ({ ...p, textColor: e.target.value }))}
                      className="w-5 h-5 border-0 bg-transparent p-0 cursor-pointer"
                    />
                    <span className="font-mono">{headerColorHex}</span>
                  </label>
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
                        onClick={() => setHeaderForm((p) => ({ ...p, alignment: opt.id }))}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                          headerForm.alignment === opt.id
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

              <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={headerForm.isDefault}
                  onChange={(e) => setHeaderForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  className="w-4 h-4 accent-[#0B1D3A]"
                />
                Definir como cabeçalho padrão dos documentos
              </label>

              <div>
                <button
                  type="submit"
                  disabled={savingHeader}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  {savingHeader
                    ? 'Salvando...'
                    : isNewHeader
                      ? 'Criar Cabeçalho'
                      : 'Salvar Alterações do Cabeçalho'}
                </button>
              </div>
            </form>

            {/* Live Header Preview */}
            <div className="lg:col-span-6 bg-[#F7F8FA] border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Pré-visualização em Tempo Real no A4
                </p>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                  <div className="h-2 bg-[#0B1D3A]" />
                  <div
                    className={`p-6 ${
                      headerForm.alignment === 'left'
                        ? 'text-left'
                        : headerForm.alignment === 'right'
                          ? 'text-right'
                          : 'text-center'
                    }`}
                    style={{ fontFamily: headerFontOpt.cssFamily }}
                  >
                    {defaultLogo?.dataUrl && (
                      <img
                        src={defaultLogo.dataUrl}
                        alt="Logo padrão"
                        className={`h-12 w-auto object-contain mb-3 ${
                          headerForm.alignment === 'center'
                            ? 'mx-auto'
                            : headerForm.alignment === 'right'
                              ? 'ml-auto'
                              : ''
                        }`}
                      />
                    )}
                    <p
                      className="font-bold uppercase leading-snug"
                      style={{
                        fontSize: `${headerSizeOpt.headerTitleCssPx}px`,
                        color: headerColorHex,
                      }}
                    >
                      {headerForm.officeTitle || 'TÍTULO DO ESCRITÓRIO'}
                    </p>
                    <p
                      className="font-semibold text-[#9A7835] mt-1"
                      style={{ fontSize: `${headerSizeOpt.headerSubCssPx}px` }}
                    >
                      {headerForm.oabNumber}
                      {headerForm.subtitle ? ` | ${headerForm.subtitle}` : ''}
                    </p>
                    <div className="h-0.5 bg-[#B8934A] mt-4" />
                    <div className="mt-5 space-y-2 opacity-30">
                      <div className="h-2 bg-slate-300 rounded w-3/4 mx-auto" />
                      <div className="h-2 bg-slate-200 rounded w-full" />
                      <div className="h-2 bg-slate-200 rounded w-5/6" />
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-4">
                Fonte aplicada no PDF: <strong>{headerFontOpt.label}</strong> · Tamanho{' '}
                <strong>{headerSizeOpt.label}</strong> · Cor{' '}
                <span className="font-mono">{headerColorHex}</span>.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* SUB-VIEW: MULTIPLE FOOTERS EDITOR */}
      {cmsView === 'footer' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCmsView('hub')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B1D3A] hover:text-[#9A7835] min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Voltar para Modelo e Timbrado
            </button>

            <button
              type="button"
              onClick={startNewFooter}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Novo Rodapé
            </button>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-[#0B1D3A]">
              Perfis de Rodapé do PDF
            </h2>
            <p className="text-sm text-slate-600">
              Configure múltiplos rodapés com endereço, contatos, tipografia, cor e alinhamento.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {footers.map((f) => {
              const active = !isNewFooter && footerFormId === f.id;
              return (
                <div
                  key={f.id}
                  className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-2.5 ${
                    active
                      ? 'border-[#0B1D3A] bg-[#F7F1E3]/35'
                      : 'border-slate-200 bg-[#F7F8FA]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#0B1D3A] truncate">{f.name}</span>
                      {f.isDefault && (
                        <span className="text-[11px] font-semibold text-[#9A7835] inline-flex items-center gap-1 shrink-0">
                          <Star className="w-3 h-3 fill-[#9A7835]" aria-hidden="true" />
                          Padrão
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 truncate mt-0.5">{f.addressFooter}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {getFontOption(f.fontFamily).label} · {getSizeOption(f.textSize).label}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => selectFooterToEdit(f)}
                      className="min-h-[36px] flex-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-[#0B1D3A] hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    {!f.isDefault && (
                      <button
                        type="button"
                        onClick={() => void onSaveFooter({ ...f, isDefault: true })}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-[#9A7835] hover:bg-slate-50"
                      >
                        Padrão
                      </button>
                    )}
                    {footers.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Excluir rodapé ${f.name}`}
                        onClick={() => {
                          void onDeleteFooter(f.id);
                          const remaining = footers.find((x) => x.id !== f.id);
                          if (remaining) selectFooterToEdit(remaining);
                        }}
                        className="min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-red-700 hover:border-red-200 inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            <form onSubmit={handleSaveFooterSubmit} className="lg:col-span-7 space-y-4">
              <div>
                <label htmlFor="ftr-name" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                  Nome do Perfil do Rodapé
                </label>
                <input
                  id="ftr-name"
                  type="text"
                  value={footerForm.name}
                  onChange={(e) => setFooterForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex.: Rodapé Completo Saquarema..."
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="ftr-address" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                  Endereço Completo
                </label>
                <input
                  id="ftr-address"
                  type="text"
                  value={footerForm.addressFooter}
                  onChange={(e) => setFooterForm((p) => ({ ...p, addressFooter: e.target.value }))}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ftr-phone" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Telefone / WhatsApp
                  </label>
                  <input
                    id="ftr-phone"
                    type="text"
                    value={footerForm.phone}
                    onChange={(e) => setFooterForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="ftr-email" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    E-mail
                  </label>
                  <input
                    id="ftr-email"
                    type="email"
                    value={footerForm.email}
                    onChange={(e) => setFooterForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ftr-insta" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Instagram
                  </label>
                  <input
                    id="ftr-insta"
                    type="text"
                    value={footerForm.instagram}
                    onChange={(e) => setFooterForm((p) => ({ ...p, instagram: e.target.value }))}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="ftr-site" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Site (opcional)
                  </label>
                  <input
                    id="ftr-site"
                    type="text"
                    value={footerForm.website}
                    onChange={(e) => setFooterForm((p) => ({ ...p, website: e.target.value }))}
                    placeholder="https://mayaramartins.adv.br"
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ftr-font" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Fonte
                  </label>
                  <select
                    id="ftr-font"
                    value={footerForm.fontFamily}
                    onChange={(e) =>
                      setFooterForm((p) => ({
                        ...p,
                        fontFamily: e.target.value as TimbradoFontFamily,
                      }))
                    }
                    className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    {TIMBRADO_FONT_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ftr-size" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Tamanho do Texto
                  </label>
                  <select
                    id="ftr-size"
                    value={footerForm.textSize}
                    onChange={(e) =>
                      setFooterForm((p) => ({
                        ...p,
                        textSize: e.target.value as TimbradoTextSize,
                      }))
                    }
                    className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    {TIMBRADO_SIZE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <span className="block text-sm font-semibold text-[#0B1D3A] mb-2">
                  Cor do Texto
                </span>
                <div className="flex flex-wrap items-center gap-2.5">
                  {TIMBRADO_COLOR_SWATCHES.map((sw) => {
                    const selected = footerColorHex === sw.hex;
                    return (
                      <button
                        key={sw.hex}
                        type="button"
                        onClick={() => setFooterForm((p) => ({ ...p, textColor: sw.hex }))}
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 ${
                          selected
                            ? 'border-[#0B1D3A] bg-slate-100 text-[#0B1D3A]'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-black/15"
                          style={{ backgroundColor: sw.hex }}
                        />
                        {sw.label}
                      </button>
                    );
                  })}
                  <label className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="color"
                      aria-label="Cor personalizada do rodapé"
                      value={footerColorHex}
                      onChange={(e) => setFooterForm((p) => ({ ...p, textColor: e.target.value }))}
                      className="w-5 h-5 border-0 bg-transparent p-0 cursor-pointer"
                    />
                    <span className="font-mono">{footerColorHex}</span>
                  </label>
                </div>
              </div>

              <div>
                <span className="block text-sm font-semibold text-[#0B1D3A] mb-2">
                  Alinhamento do Rodapé
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
                        onClick={() => setFooterForm((p) => ({ ...p, alignment: opt.id }))}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                          footerForm.alignment === opt.id
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

              <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={footerForm.isDefault}
                  onChange={(e) => setFooterForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  className="w-4 h-4 accent-[#0B1D3A]"
                />
                Definir como rodapé padrão dos documentos
              </label>

              <div>
                <button
                  type="submit"
                  disabled={savingFooter}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  {savingFooter
                    ? 'Salvando...'
                    : isNewFooter
                      ? 'Criar Rodapé'
                      : 'Salvar Rodapé do PDF'}
                </button>
              </div>
            </form>

            <div className="lg:col-span-5 bg-[#F7F8FA] border border-slate-200 rounded-xl p-6 flex flex-col justify-end">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Pré-visualização do Rodapé A4
              </p>
              <div
                className={`bg-white border border-slate-200 rounded-lg p-5 space-y-1 ${
                  footerForm.alignment === 'left'
                    ? 'text-left'
                    : footerForm.alignment === 'right'
                      ? 'text-right'
                      : 'text-center'
                }`}
                style={{
                  fontFamily: footerFontOpt.cssFamily,
                  color: footerColorHex,
                  fontSize: `${footerSizeOpt.footerCssPx}px`,
                }}
              >
                <div className="h-px bg-slate-300 mb-3" />
                <p className="font-medium">{footerForm.addressFooter}</p>
                <p>
                  {[
                    `Tel/WhatsApp: ${footerForm.phone}`,
                    `E-mail: ${footerForm.email}`,
                    footerForm.instagram,
                    footerForm.website,
                  ]
                    .filter(Boolean)
                    .join(' | ')}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SUB-VIEW: MULTIPLE LOGOS & SEAL */}
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
              Galeria de Logotipos e Imagens
            </h2>
            <p className="text-sm text-slate-600">
              Cadastre múltiplos logotipos nomeados (horizontal, quadrado, selo) para escolher por
              modelo de documento.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Upload New Logo Card */}
            <div className="lg:col-span-5 p-5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-4">
              <h3 className="text-base font-semibold text-[#0B1D3A]">
                Adicionar Novo Logotipo
              </h3>
              <div>
                <label htmlFor="logo-name" className="block text-xs font-semibold text-[#0B1D3A] mb-1">
                  Nome Identificador
                </label>
                <input
                  id="logo-name"
                  type="text"
                  value={newLogoName}
                  onChange={(e) => setNewLogoName(e.target.value)}
                  placeholder="Ex.: Logo Principal Dourada"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                />
              </div>

              <div>
                <label htmlFor="logo-format" className="block text-xs font-semibold text-[#0B1D3A] mb-1">
                  Formato / Aplicação
                </label>
                <select
                  id="logo-format"
                  value={newLogoFormat}
                  onChange={(e) => setNewLogoFormat(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="Horizontal">Horizontal</option>
                  <option value="Quadrado">Quadrado / Monograma</option>
                  <option value="Vertical">Vertical</option>
                  <option value="Selo / Carimbo">Selo / Carimbo</option>
                </select>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newLogoDefault}
                  onChange={(e) => setNewLogoDefault(e.target.checked)}
                  className="w-4 h-4 accent-[#0B1D3A]"
                />
                Definir como logotipo padrão
              </label>

              <div>
                <label className="min-h-[48px] w-full px-4 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] cursor-pointer inline-flex items-center justify-center gap-2">
                  <ImagePlus className="w-4 h-4" aria-hidden="true" />
                  {savingLogo ? 'Enviando...' : 'Selecionar Arquivo PNG / JPG'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={savingLogo}
                    onChange={(e) => void handleLogoFileSelected(e)}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {/* Saved Logos List + Optional Seal */}
            <div className="lg:col-span-7 space-y-5">
              {logos.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-500">
                  Nenhum logotipo cadastrado na nuvem ainda. Envie seu arquivo ao lado para começar.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {logos.map((logo) => (
                    <div
                      key={logo.id}
                      className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#0B1D3A] truncate">
                            {logo.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {logo.formatLabel || 'Imagem'}
                          </p>
                        </div>
                        {logo.isDefault && (
                          <span className="text-[11px] font-semibold text-[#9A7835] inline-flex items-center gap-1 shrink-0">
                            <Star className="w-3 h-3 fill-[#9A7835]" aria-hidden="true" />
                            Padrão
                          </span>
                        )}
                      </div>

                      <div className="h-24 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-2">
                        <img
                          src={logo.dataUrl}
                          alt={logo.name}
                          className="max-h-20 w-auto object-contain"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {!logo.isDefault && (
                          <button
                            type="button"
                            onClick={() => void onSaveLogo({ ...logo, isDefault: true })}
                            className="min-h-[38px] flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[#0B1D3A] hover:bg-slate-50"
                          >
                            Definir Padrão
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`Excluir logotipo ${logo.name}`}
                          onClick={() => void onDeleteLogo(logo.id)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-red-200 bg-white text-xs font-semibold text-red-700 hover:bg-red-50 inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Optional Seal Card */}
              <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 p-1">
                    {letterhead.sealDataUrl ? (
                      <img
                        src={letterhead.sealDataUrl}
                        alt="Selo institucional"
                        className="max-h-12 w-auto object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 text-center">Sem selo</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#0B1D3A]">
                      Selo / Carimbo de Rodapé (Opcional)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Exibido discretamente junto ao rodapé nos PDFs gerados.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-[#0B1D3A] hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5">
                    <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                    Enviar Selo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => void handleSealUpload(e)}
                      className="sr-only"
                    />
                  </label>
                  {letterhead.sealDataUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        void onSaveLetterhead({ ...letterhead, sealDataUrl: null }).then(() =>
                          setFeedback('Selo removido.')
                        )
                      }
                      className="min-h-[40px] px-3 py-2 rounded-xl border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
                    >
                      Remover
                    </button>
                  )}
                </div>
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

          {editorMode === 'list' && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#0B1D3A]">
                  Modelos de Documentos
                </h2>
                <p className="text-sm text-slate-600">
                  Selecione um modelo existente para editar texto, variáveis e timbrado próprio.
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
                          {tpl.category} · {fieldCount} campos · {describeBinding(tpl)}
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

                {/* Per-Template Timbrado Selection */}
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#0B1D3A]">
                    Timbrado deste Documento (Cabeçalho, Rodapé e Logo)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="tpl-header-select" className="block text-xs font-semibold text-slate-700 mb-1">
                        Cabeçalho
                      </label>
                      <select
                        id="tpl-header-select"
                        value={tplHeaderSelect}
                        onChange={(e) => setTplHeaderSelect(e.target.value)}
                        className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm"
                      >
                        <option value={DEFAULT_SELECT_VAL}>Usar cabeçalho padrão</option>
                        <option value={NONE_SELECT_VAL}>Sem cabeçalho</option>
                        {headers.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="tpl-footer-select" className="block text-xs font-semibold text-slate-700 mb-1">
                        Rodapé
                      </label>
                      <select
                        id="tpl-footer-select"
                        value={tplFooterSelect}
                        onChange={(e) => setTplFooterSelect(e.target.value)}
                        className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm"
                      >
                        <option value={DEFAULT_SELECT_VAL}>Usar rodapé padrão</option>
                        <option value={NONE_SELECT_VAL}>Sem rodapé</option>
                        {footers.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="tpl-logo-select" className="block text-xs font-semibold text-slate-700 mb-1">
                        Logotipo
                      </label>
                      <select
                        id="tpl-logo-select"
                        value={tplLogoSelect}
                        onChange={(e) => setTplLogoSelect(e.target.value)}
                        className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm"
                      >
                        <option value={DEFAULT_SELECT_VAL}>Usar logotipo padrão</option>
                        <option value={NONE_SELECT_VAL}>Sem logotipo</option>
                        {logos.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Clickable Tag Toolbar */}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1D3A]/55"
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
        onSaveExtractedHeader={onSaveHeader}
        onSaveExtractedFooter={onSaveFooter}
        onSaveExtractedLogo={onSaveLogo}
      />
    </div>
  );
}
