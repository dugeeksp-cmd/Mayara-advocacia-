import React, { useState } from 'react';
import { Check, ExternalLink, Save, ShieldCheck } from 'lucide-react';
import type { SignatureConfigSettings } from '../types/legal';

interface AdminSignatureSettingsProps {
  signatureConfig: SignatureConfigSettings;
  onSaveSignatureConfig: (
    config: Omit<SignatureConfigSettings, 'updatedAt' | 'updatedBy'>
  ) => Promise<void>;
}

export function AdminSignatureSettings({
  signatureConfig,
  onSaveSignatureConfig,
}: AdminSignatureSettingsProps) {
  const [sigForm, setSigForm] = useState<Omit<SignatureConfigSettings, 'updatedAt' | 'updatedBy'>>({
    govbrEnabled: signatureConfig.govbrEnabled,
    govbrPortalUrl: signatureConfig.govbrPortalUrl || 'https://assinador.iti.br',
    instructionsNote:
      signatureConfig.instructionsNote ||
      'Utilize sua conta Gov.br (nível Prata ou Ouro) no portal oficial assinador.iti.br ou pelo aplicativo Gov.br.',
    requireSignedUpload: signatureConfig.requireSignedUpload,
  });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      await onSaveSignatureConfig(sigForm);
      setSavedMsg('Configurações da Assinatura Digital Gov.br salvas com sucesso.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-3xl bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
      <div className="flex items-start gap-3.5 mb-6">
        <div className="w-11 h-11 rounded-xl bg-[#0B1D3A] text-[#CFAF6E] flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#0B1D3A]">
            Assinatura Eletrônica · Gov.br
          </h2>
          <p className="text-sm text-slate-600">
            Fluxo 100% exclusivo para assinatura digital gratuita pelo portal oficial do Governo
            Federal (assinador.iti.br), com envio do PDF assinado diretamente pelo cliente na Etapa 3.
          </p>
        </div>
      </div>

      {savedMsg && (
        <div
          role="status"
          className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2"
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{savedMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors">
          <div>
            <p className="text-sm font-semibold text-[#0B1D3A]">
              Assinatura Digital Gov.br Ativa (assinador.iti.br)
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Exibe o tutorial passo a passo e o link direto do assinador oficial Gov.br após o
              cliente baixar o PDF preenchido.
            </p>
          </div>
          <input
            type="checkbox"
            checked={sigForm.govbrEnabled}
            onChange={(e) =>
              setSigForm((prev) => ({ ...prev, govbrEnabled: e.target.checked }))
            }
            className="w-5 h-5 accent-[#0B1D3A] shrink-0"
          />
        </label>

        <div>
          <label
            htmlFor="sig-govbr-url"
            className="block text-sm font-semibold text-[#0B1D3A] mb-1.5"
          >
            URL Oficial do Assinador Gov.br
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="sig-govbr-url"
              type="url"
              value={sigForm.govbrPortalUrl}
              onChange={(e) =>
                setSigForm((prev) => ({ ...prev, govbrPortalUrl: e.target.value }))
              }
              placeholder="https://assinador.iti.br"
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-[#0F172A] font-mono bg-white"
              required
            />
            <a
              href={sigForm.govbrPortalUrl || 'https://assinador.iti.br'}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-[#0B1D3A] hover:bg-slate-50 inline-flex items-center justify-center gap-1.5 shrink-0"
            >
              Testar Link
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div>
          <label
            htmlFor="sig-govbr-note"
            className="block text-sm font-semibold text-[#0B1D3A] mb-1.5"
          >
            Orientação Adicional Exibida ao Cliente
          </label>
          <textarea
            id="sig-govbr-note"
            rows={3}
            value={sigForm.instructionsNote || ''}
            onChange={(e) =>
              setSigForm((prev) => ({ ...prev, instructionsNote: e.target.value }))
            }
            placeholder="Instruções sobre conta nível Prata ou Ouro, posicionamento do selo azul..."
            className="w-full p-3.5 rounded-xl border border-slate-300 text-sm text-[#0F172A] bg-white"
          />
        </div>

        <label className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors">
          <div>
            <p className="text-sm font-semibold text-[#0B1D3A]">
              Exigir Envio do PDF Assinado pelo Gov.br na Etapa 3
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Após assinar no portal Gov.br, o cliente anexa o PDF final assinado para registro
              automático no painel.
            </p>
          </div>
          <input
            type="checkbox"
            checked={sigForm.requireSignedUpload}
            onChange={(e) =>
              setSigForm((prev) => ({ ...prev, requireSignedUpload: e.target.checked }))
            }
            className="w-5 h-5 accent-[#0B1D3A] shrink-0"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          {saving ? 'Salvando...' : 'Salvar Configurações Gov.br'}
        </button>
      </form>
    </section>
  );
}
