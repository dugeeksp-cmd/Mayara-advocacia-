import { useEffect, useState } from 'react';
import { Check, ClipboardCheck, Loader2, X } from 'lucide-react';
import { dataService } from '../services/dataService';

export const CURRENT_APP_VERSION = 'v2.6.0';

interface ChangelogReleaseItem {
  id: string;
  title: string;
  description: string;
}

const RELEASE_ITEMS: ChangelogReleaseItem[] = [
  {
    id: 'batch_apply_timbrado_templates',
    title: 'Aplicação em Lote ("Aplicar em Modelos") para Logos, Cabeçalhos e Rodapés',
    description:
      'Atualize modelos selecionados ou todos de uma vez diretamente dos cards ou ao salvar cabeçalhos e rodapés, mantendo documentos anteriores intactos.',
  },
  {
    id: 'header_image_text_layout_controls',
    title: 'Controles Avançados de Layout no Cabeçalho (Imagem + Texto)',
    description:
      'Escolha a posição do logotipo (Esquerda, Centro, Direita) e do texto (Abaixo, Acima ou Ao lado em 2 colunas) com reflexo fiel na prévia A4 e no PDF.',
  },
  {
    id: 'govbr_exclusive_signature',
    title: 'Assinatura Eletrônica 100% Exclusiva via Gov.br',
    description:
      'Remoção de provedores externos pagos e fluxo otimizado para assinatura digital gratuita pelo portal oficial assinador.iti.br ou App Gov.br.',
  },
  {
    id: 'cpf_primary_autofill',
    title: 'CPF como Chave Principal e Autopreenchimento',
    description:
      'Ao digitar um CPF já cadastrado em "+ Cadastrar Cliente", os dados completos são carregados automaticamente e os novos PDFs ficam vinculados ao mesmo cadastro.',
  },
  {
    id: 'add_doc_in_summary_and_unified_links',
    title: '+ Adicionar Novo Documento no Resumo e Acesso Unificado',
    description:
      'Gere novos contratos/documentos diretamente no modal do cliente e acesse o mesmo resumo clicando no nome do cliente em "Documentos Recebidos".',
  },
  {
    id: 'exclusive_default_and_test_pdf_preview',
    title: 'Modelo Padrão Único e Pré-visualização de PDF de Teste',
    description:
      'Apenas um modelo permanece como padrão ativo por vez, com botão "Visualizar PDF de Teste" no editor antes de salvar.',
  },
  {
    id: 'sync_cloud_firestore',
    title: 'Sincronização em Tempo Real no Firebase Firestore',
    description:
      'Cabeçalhos, rodapés, logotipos, modelos, clientes e links sincronizados automaticamente entre celular e computador.',
  },
  {
    id: 'multi_timbrado_profiles',
    title: 'Múltiplos Perfis de Cabeçalho, Rodapé e Logotipos',
    description:
      'Criação e edição de vários perfis nomeados com fonte, tamanho, cor personalizada e prévia A4 em tempo real.',
  },
  {
    id: 'pdf_import_client_side',
    title: 'Importação de Modelos a partir de PDF (Client-Side)',
    description:
      'Extração inteligente de corpo do texto, cabeçalho, rodapé e logotipo diretamente no navegador sem envio a terceiros.',
  },
];

interface VersionChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VersionChangelogModal({ isOpen, onClose }: VersionChangelogModalProps) {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    void dataService.getChangelogChecklist(CURRENT_APP_VERSION).then((state) => {
      if (!active) return;
      setCheckedIds(state.checkedIds);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  async function toggleItem(id: string) {
    const next = checkedIds.includes(id)
      ? checkedIds.filter((item) => item !== id)
      : [...checkedIds, id];
    setCheckedIds(next);
    setSaving(true);
    try {
      await dataService.saveChangelogChecklist(CURRENT_APP_VERSION, next);
    } finally {
      setSaving(false);
    }
  }

  const completedCount = RELEASE_ITEMS.filter((i) => checkedIds.includes(i.id)).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1D3A]/55 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-modal-title"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xl my-auto">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0B1D3A] text-[#CFAF6E] flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  id="version-modal-title"
                  className="font-display text-xl font-bold text-[#0B1D3A]"
                >
                  Notas da Versão {CURRENT_APP_VERSION}
                </h3>
                <span className="text-xs font-mono font-semibold text-[#9A7835] bg-[#F7F1E3] px-2 py-0.5 rounded-md">
                  {completedCount}/{RELEASE_ITEMS.length} homologados
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Checklist interativo de atualizações implementadas. Marque cada item conforme
                testar.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Fechar notas da versão"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 max-h-[58vh] overflow-y-auto pr-1 space-y-2.5">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Carregando checklist de homologação...
            </div>
          ) : (
            RELEASE_ITEMS.map((item) => {
              const checked = checkedIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                    checked
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : 'bg-[#F7F8FA] border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => void toggleItem(item.id)}
                    className="w-4 h-4 mt-1 accent-[#0B1D3A] shrink-0"
                  />
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold ${
                        checked ? 'text-emerald-900' : 'text-[#0B1D3A]'
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            {saving ? 'Salvando progresso na nuvem...' : 'Progresso salvo automaticamente no Firebase'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
