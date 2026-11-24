import { useEffect, useState } from 'react';
import { Check, Info, Layers, Loader2, X } from 'lucide-react';
import type { DocumentTemplate } from '../types/legal';
import type { BatchAssetType } from '../utils/headerLayout';

interface BatchApplyTemplatesModalProps {
  isOpen: boolean;
  assetType: BatchAssetType;
  assetId: string;
  assetName: string;
  templates: DocumentTemplate[];
  onClose: () => void;
  onApply: (templateIds: string[]) => Promise<void>;
}

const ASSET_TYPE_LABELS: Record<BatchAssetType, string> = {
  header: 'Cabeçalho',
  footer: 'Rodapé',
  logo: 'Logotipo',
};

export function BatchApplyTemplatesModal({
  isOpen,
  assetType,
  assetId,
  assetName,
  templates,
  onClose,
  onApply,
}: BatchApplyTemplatesModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [applyingMode, setApplyingMode] = useState<'selected' | 'all' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Pre-select templates not yet using this asset, or all if none are linked yet
    const alreadyLinkedIds = templates
      .filter((tpl) => {
        if (assetType === 'header') return tpl.headerId === assetId;
        if (assetType === 'footer') return tpl.footerId === assetId;
        return tpl.logoId === assetId;
      })
      .map((tpl) => tpl.id);
    setSelectedIds(alreadyLinkedIds);
    setApplyingMode(null);
  }, [isOpen, assetType, assetId, templates]);

  if (!isOpen) return null;

  const assetLabel = ASSET_TYPE_LABELS[assetType];
  const allSelected = templates.length > 0 && selectedIds.length === templates.length;

  function toggleTemplate(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(templates.map((t) => t.id));
    }
  }

  async function handleApplySelected() {
    if (selectedIds.length === 0 || applyingMode) return;
    setApplyingMode('selected');
    try {
      await onApply(selectedIds);
      onClose();
    } finally {
      setApplyingMode(null);
    }
  }

  async function handleApplyAll() {
    if (templates.length === 0 || applyingMode) return;
    setApplyingMode('all');
    try {
      await onApply(templates.map((t) => t.id));
      onClose();
    } finally {
      setApplyingMode(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:py-8 bg-[#0B1D3A]/60 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-apply-modal-title"
    >
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-6 shadow-xl my-auto space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0B1D3A] text-[#CFAF6E] flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9A7835]">
                Aplicar {assetLabel} em Modelos
              </p>
              <h3
                id="batch-apply-modal-title"
                className="font-display text-xl font-bold text-[#0B1D3A]"
              >
                {assetName}
              </h3>
            </div>
          </div>

          <button
            type="button"
            aria-label="Fechar modal de aplicação em modelos"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mandatory Zero-Retroactive-Impact Notice */}
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs sm:text-sm flex items-start gap-2.5 leading-relaxed">
          <Info className="w-4 h-4 text-[#9A7835] shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            Esta alteração atualizará apenas os modelos para futuros documentos. Contratos e PDFs já
            gerados anteriormente permanecerão intactos.
          </p>
        </div>

        {/* Templates Checklist */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Selecione os Modelos ({selectedIds.length}/{templates.length})
            </span>
            {templates.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-semibold text-[#0B1D3A] hover:text-[#9A7835] underline underline-offset-2"
              >
                {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            )}
          </div>

          {templates.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-500">
              Nenhum modelo de documento cadastrado.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-xl">
              {templates.map((tpl) => {
                const checked = selectedIds.includes(tpl.id);
                const alreadyUses =
                  (assetType === 'header' && tpl.headerId === assetId) ||
                  (assetType === 'footer' && tpl.footerId === assetId) ||
                  (assetType === 'logo' && tpl.logoId === assetId);

                return (
                  <label
                    key={tpl.id}
                    className={`flex items-center justify-between gap-3 p-3.5 cursor-pointer transition-colors ${
                      checked ? 'bg-[#F7F1E3]/45' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTemplate(tpl.id)}
                        className="w-4 h-4 accent-[#0B1D3A] shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0B1D3A] truncate">
                          {tpl.title}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{tpl.category}</p>
                      </div>
                    </div>

                    {alreadyUses && (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" aria-hidden="true" />
                        Vinculado
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={applyingMode !== null}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              disabled={selectedIds.length === 0 || applyingMode !== null}
              onClick={() => void handleApplySelected()}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#0B1D3A] bg-white text-[#0B1D3A] text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {applyingMode === 'selected' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Aplicando...
                </>
              ) : (
                `Aplicar nos Selecionados (${selectedIds.length})`
              )}
            </button>

            <button
              type="button"
              disabled={templates.length === 0 || applyingMode !== null}
              onClick={() => void handleApplyAll()}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {applyingMode === 'all' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Atualizando...
                </>
              ) : (
                'Atualizar em Todos os Modelos'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
