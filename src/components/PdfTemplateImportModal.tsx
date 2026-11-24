import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  FileText,
  FileUp,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  PanelBottom,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { FooterProfile, HeaderProfile, LogoAsset } from '../types/legal';
import type { SaveFooterInput, SaveHeaderInput, SaveLogoInput } from '../services/dataService';
import { sanitizeFilenamePart } from '../utils/masksAndFormatters';
import {
  extractPdfDocumentClientSide,
  type PdfImportOptions,
  type PdfImportResult,
} from '../utils/pdfImporter';

interface PdfTemplateImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenExtractedTemplate: (data: {
    title: string;
    content: string;
    headerId?: string | null;
    footerId?: string | null;
    logoId?: string | null;
    notice?: string;
  }) => void;
  onSaveExtractedHeader: (input: SaveHeaderInput) => Promise<HeaderProfile>;
  onSaveExtractedFooter: (input: SaveFooterInput) => Promise<FooterProfile>;
  onSaveExtractedLogo: (input: SaveLogoInput) => Promise<LogoAsset>;
}

export function PdfTemplateImportModal({
  isOpen,
  onClose,
  onOpenExtractedTemplate,
  onSaveExtractedHeader,
  onSaveExtractedFooter,
  onSaveExtractedLogo,
}: PdfTemplateImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [options, setOptions] = useState<PdfImportOptions>({
    extractText: true,
    extractHeader: false,
    extractFooter: false,
    extractLogo: false,
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PdfImportResult | null>(null);

  const [applyHeaderChecked, setApplyHeaderChecked] = useState(true);
  const [applyFooterChecked, setApplyFooterChecked] = useState(true);
  const [applyLogoChecked, setApplyLogoChecked] = useState(true);
  const [applyingLetterhead, setApplyingLetterhead] = useState(false);
  const [savedIds, setSavedIds] = useState<{
    headerId?: string;
    footerId?: string;
    logoId?: string;
  }>({});

  if (!isOpen) return null;

  function resetAndClose() {
    setSelectedFile(null);
    setIsDragging(false);
    setOptions({
      extractText: true,
      extractHeader: false,
      extractFooter: false,
      extractLogo: false,
    });
    setProcessing(false);
    setError(null);
    setResult(null);
    setSavedIds({});
    onClose();
  }

  function handleFileSelected(file: File | null | undefined) {
    if (!file) return;
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setError('Selecione apenas arquivos no formato PDF (.pdf).');
      return;
    }
    setError(null);
    setResult(null);
    setSavedIds({});
    setSelectedFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFileSelected(file);
  }

  async function handleProcessPdf() {
    if (!selectedFile) {
      setError('Selecione um arquivo PDF antes de processar.');
      return;
    }
    if (
      !options.extractText &&
      !options.extractHeader &&
      !options.extractFooter &&
      !options.extractLogo
    ) {
      setError('Marque pelo menos uma opção do que deseja extrair do PDF.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const extracted = await extractPdfDocumentClientSide(selectedFile, options);

      if (
        options.extractText &&
        !extracted.bodyText &&
        !extracted.headerData &&
        !extracted.footerData &&
        !extracted.logoDataUrl
      ) {
        setError(
          'Não foi possível detectar texto selecionável neste PDF (ele pode ser uma imagem digitalizada sem camada de texto).'
        );
        setProcessing(false);
        return;
      }

      const requestedExtras =
        options.extractHeader || options.extractFooter || options.extractLogo;
      const foundExtras = Boolean(
        extracted.headerData || extracted.footerData || extracted.logoDataUrl
      );

      if (requestedExtras && foundExtras) {
        setApplyHeaderChecked(Boolean(extracted.headerData));
        setApplyFooterChecked(Boolean(extracted.footerData));
        setApplyLogoChecked(Boolean(extracted.logoDataUrl));
        setResult(extracted);
      } else {
        const notice = requestedExtras
          ? 'Texto importado para edição. Nenhum cabeçalho, rodapé ou logotipo foi detectado nas regiões selecionadas.'
          : 'Texto do PDF importado com sucesso. Ajuste os parágrafos e insira as variáveis clicando nas tags abaixo.';
        onOpenExtractedTemplate({
          title: extracted.suggestedTitle,
          content: extracted.bodyText,
          notice,
        });
        resetAndClose();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `Erro ao ler o PDF: ${err.message}`
          : 'Erro inesperado ao processar o arquivo PDF.'
      );
    } finally {
      setProcessing(false);
    }
  }

  async function saveExtractedPart(part: 'header' | 'footer' | 'logo', extracted: PdfImportResult) {
    const slug = sanitizeFilenamePart(extracted.suggestedTitle).toLowerCase().slice(0, 18);
    const stamp = Date.now().toString(36);

    if (part === 'header' && extracted.headerData) {
      const saved = await onSaveExtractedHeader({
        id: `header_pdf_${slug}_${stamp}`,
        name: `Importado · ${extracted.suggestedTitle.slice(0, 28)}`,
        officeTitle:
          extracted.headerData.officeTitle ||
          'MAYARA MARTINS — ADVOCACIA E CONSULTORIA JURÍDICA',
        oabNumber: extracted.headerData.oabNumber || 'OAB/RJ 229.359',
        subtitle: extracted.headerData.subtitle || '',
        alignment: 'center',
        fontFamily: 'playfair',
        textSize: 'medium',
        textColor: '#0B1D3A',
        isDefault: false,
      });
      setSavedIds((prev) => ({ ...prev, headerId: saved.id }));
      return saved.id;
    }

    if (part === 'footer' && extracted.footerData) {
      const saved = await onSaveExtractedFooter({
        id: `footer_pdf_${slug}_${stamp}`,
        name: `Importado · ${extracted.suggestedTitle.slice(0, 28)}`,
        addressFooter:
          extracted.footerData.addressFooter ||
          extracted.footerData.rawText ||
          'Saquarema/RJ',
        phone: extracted.footerData.phone || '(22) 99805-0980',
        email: extracted.footerData.email || 'maycmartinsadv@hotmail.com',
        instagram: extracted.footerData.instagram || '',
        website: extracted.footerData.website || '',
        alignment: 'center',
        fontFamily: 'inter',
        textSize: 'medium',
        textColor: '#475569',
        isDefault: false,
      });
      setSavedIds((prev) => ({ ...prev, footerId: saved.id }));
      return saved.id;
    }

    if (part === 'logo' && extracted.logoDataUrl) {
      const saved = await onSaveExtractedLogo({
        id: `logo_pdf_${slug}_${stamp}`,
        name: `Logo · ${extracted.suggestedTitle.slice(0, 28)}`,
        formatLabel: 'Importado de PDF',
        dataUrl: extracted.logoDataUrl,
        isDefault: false,
      });
      setSavedIds((prev) => ({ ...prev, logoId: saved.id }));
      return saved.id;
    }

    return undefined;
  }

  async function handleApplySingle(part: 'header' | 'footer' | 'logo') {
    if (!result) return;
    setApplyingLetterhead(true);
    try {
      await saveExtractedPart(part, result);
    } finally {
      setApplyingLetterhead(false);
    }
  }

  async function handleApplySelectedAndFinish() {
    if (!result) return;
    setApplyingLetterhead(true);
    try {
      let headerId = savedIds.headerId;
      let footerId = savedIds.footerId;
      let logoId = savedIds.logoId;

      if (applyHeaderChecked && result.headerData && !headerId) {
        headerId = await saveExtractedPart('header', result);
      }
      if (applyFooterChecked && result.footerData && !footerId) {
        footerId = await saveExtractedPart('footer', result);
      }
      if (applyLogoChecked && result.logoDataUrl && !logoId) {
        logoId = await saveExtractedPart('logo', result);
      }

      const appliedCount = [headerId, footerId, logoId].filter(Boolean).length;
      onOpenExtractedTemplate({
        title: result.suggestedTitle,
        content: result.bodyText,
        headerId,
        footerId,
        logoId,
        notice:
          appliedCount > 0
            ? 'Modelo importado e perfis extraídos vinculados automaticamente ao timbrado deste documento.'
            : 'Modelo importado para o editor com sucesso.',
      });
      resetAndClose();
    } finally {
      setApplyingLetterhead(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1D3A]/55 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-import-modal-title"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xl my-auto">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3
              id="pdf-import-modal-title"
              className="font-display text-xl font-bold text-[#0B1D3A]"
            >
              {result ? 'Prévia do Timbrado Extraído' : 'Importar Modelo a partir de PDF'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {result
                ? 'Salve os elementos detectados como novos perfis e vincule-os automaticamente a este modelo.'
                : 'Envie um documento PDF existente para extrair texto limpo e elementos do papel timbrado diretamente no navegador.'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar modal de importação de PDF"
            onClick={resetAndClose}
            className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!result ? (
          <div className="space-y-5">
            <label
              htmlFor="pdf-template-file-input"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`block rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-[#B8934A] bg-[#F7F1E3]/40'
                  : selectedFile
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-slate-300 bg-[#F7F8FA] hover:border-[#0B1D3A]'
              }`}
            >
              <input
                id="pdf-template-file-input"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
                className="sr-only"
              />
              <div className="w-12 h-12 rounded-xl bg-[#0B1D3A] text-[#CFAF6E] flex items-center justify-center mx-auto mb-3">
                <FileUp className="w-5 h-5" aria-hidden="true" />
              </div>
              {selectedFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#0B1D3A]">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {(selectedFile.size / 1024).toFixed(1)} KB · Clique para trocar o arquivo
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#0B1D3A]">
                    Arraste seu arquivo PDF aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-slate-500">
                    Compatível com petições, procurações, declarações e contratos em PDF
                  </p>
                </div>
              )}
            </label>

            <div className="bg-[#F7F8FA] border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-[#0B1D3A]">
                Selecione o que deseja extrair do PDF:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={options.extractText}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, extractText: e.target.checked }))
                    }
                    className="w-4 h-4 mt-0.5 accent-[#0B1D3A]"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-[#0B1D3A]">
                      Extrair texto do documento
                    </span>
                    <span className="block text-xs text-slate-500">
                      Corpo principal sem cabeçalho/rodapé
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={options.extractHeader}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, extractHeader: e.target.checked }))
                    }
                    className="w-4 h-4 mt-0.5 accent-[#0B1D3A]"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-[#0B1D3A]">
                      Extrair cabeçalho
                    </span>
                    <span className="block text-xs text-slate-500">
                      Topo da página (12%–15% superiores)
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={options.extractFooter}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, extractFooter: e.target.checked }))
                    }
                    className="w-4 h-4 mt-0.5 accent-[#0B1D3A]"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-[#0B1D3A]">
                      Extrair rodapé
                    </span>
                    <span className="block text-xs text-slate-500">
                      Base da página (10%–12% inferiores)
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={options.extractLogo}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, extractLogo: e.target.checked }))
                    }
                    className="w-4 h-4 mt-0.5 accent-[#0B1D3A]"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-[#0B1D3A]">
                      Extrair logotipo / imagem do timbrado
                    </span>
                    <span className="block text-xs text-slate-500">
                      Imagem da 1ª página em PNG
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
              <ShieldCheck className="w-4 h-4 text-[#0B1D3A] shrink-0" aria-hidden="true" />
              <span>
                Processamento local (Zero-Retention): o PDF é lido apenas na memória do navegador e
                nunca é enviado a servidores externos.
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={resetAndClose}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={processing || !selectedFile}
                onClick={() => void handleProcessPdf()}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Processando PDF...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" aria-hidden="true" />
                    Processar e Gerar Modelo
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                Documento lido: <strong>{result.suggestedTitle}</strong> ({result.pageCount}{' '}
                {result.pageCount === 1 ? 'página' : 'páginas'}).
              </span>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {result.headerData && (
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B1D3A] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyHeaderChecked}
                        onChange={(e) => setApplyHeaderChecked(e.target.checked)}
                        className="w-4 h-4 accent-[#0B1D3A]"
                      />
                      <LayoutTemplate className="w-4 h-4 text-[#9A7835]" aria-hidden="true" />
                      Cabeçalho detectado
                    </label>
                    <button
                      type="button"
                      disabled={applyingLetterhead || Boolean(savedIds.headerId)}
                      onClick={() => void handleApplySingle('header')}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[#0B1D3A] hover:bg-slate-50 disabled:opacity-60"
                    >
                      {savedIds.headerId ? 'Salvo como Perfil' : 'Salvar Perfil'}
                    </button>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
                    {result.headerData.officeTitle && (
                      <p className="font-semibold text-[#0B1D3A]">
                        {result.headerData.officeTitle}
                      </p>
                    )}
                    {result.headerData.oabNumber && (
                      <p className="text-[#9A7835] font-medium">{result.headerData.oabNumber}</p>
                    )}
                    {result.headerData.subtitle && <p>{result.headerData.subtitle}</p>}
                  </div>
                </div>
              )}

              {result.footerData && (
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B1D3A] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyFooterChecked}
                        onChange={(e) => setApplyFooterChecked(e.target.checked)}
                        className="w-4 h-4 accent-[#0B1D3A]"
                      />
                      <PanelBottom className="w-4 h-4 text-[#9A7835]" aria-hidden="true" />
                      Rodapé detectado
                    </label>
                    <button
                      type="button"
                      disabled={applyingLetterhead || Boolean(savedIds.footerId)}
                      onClick={() => void handleApplySingle('footer')}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[#0B1D3A] hover:bg-slate-50 disabled:opacity-60"
                    >
                      {savedIds.footerId ? 'Salvo como Perfil' : 'Salvar Perfil'}
                    </button>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
                    {result.footerData.addressFooter && (
                      <p>{result.footerData.addressFooter}</p>
                    )}
                    <p className="text-slate-500">
                      {[
                        result.footerData.phone,
                        result.footerData.email,
                        result.footerData.instagram,
                        result.footerData.website,
                      ]
                        .filter(Boolean)
                        .join(' · ') || result.footerData.rawText}
                    </p>
                  </div>
                </div>
              )}

              {result.logoDataUrl && (
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B1D3A] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyLogoChecked}
                        onChange={(e) => setApplyLogoChecked(e.target.checked)}
                        className="w-4 h-4 accent-[#0B1D3A]"
                      />
                      <ImageIcon className="w-4 h-4 text-[#9A7835]" aria-hidden="true" />
                      Logotipo extraído
                    </label>
                    <button
                      type="button"
                      disabled={applyingLetterhead || Boolean(savedIds.logoId)}
                      onClick={() => void handleApplySingle('logo')}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[#0B1D3A] hover:bg-slate-50 disabled:opacity-60"
                    >
                      {savedIds.logoId ? 'Salvo na Galeria' : 'Salvar Logotipo'}
                    </button>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-center">
                    <img
                      src={result.logoDataUrl}
                      alt="Prévia do logotipo extraído do PDF"
                      className="max-h-20 w-auto object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onOpenExtractedTemplate({
                    title: result.suggestedTitle,
                    content: result.bodyText,
                    notice: 'Modelo importado para o editor com sucesso.',
                  });
                  resetAndClose();
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Abrir só o Texto no Editor
              </button>
              <button
                type="button"
                disabled={applyingLetterhead}
                onClick={() => void handleApplySelectedAndFinish()}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
              >
                <Check className="w-4 h-4" aria-hidden="true" />
                {applyingLetterhead
                  ? 'Salvando...'
                  : 'Salvar Selecionados e Editar Modelo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
