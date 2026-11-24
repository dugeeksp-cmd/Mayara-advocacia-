import React, { useState } from 'react';
import { Check, Save, ShieldCheck } from 'lucide-react';
import type { SignatureConfigSettings, SignatureServerConfig } from '../types/legal';

interface AdminSignatureSettingsProps {
  signatureConfig: SignatureConfigSettings;
  signatureServerConfig: SignatureServerConfig | null;
  onSaveSignatureConfig: (
    config: Omit<SignatureConfigSettings, 'updatedAt' | 'updatedBy'>
  ) => Promise<void>;
}

export function AdminSignatureSettings({
  signatureConfig,
  signatureServerConfig,
  onSaveSignatureConfig,
}: AdminSignatureSettingsProps) {
  const [sigForm, setSigForm] = useState<Omit<SignatureConfigSettings, 'updatedAt' | 'updatedBy'>>({
    defaultProvider: signatureConfig.defaultProvider,
    clicksignEnabled: signatureConfig.clicksignEnabled,
    docusignEnabled: signatureConfig.docusignEnabled,
    govbrEnabled: signatureConfig.govbrEnabled,
  });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      await onSaveSignatureConfig(sigForm);
      setSavedMsg('Configurações de assinatura eletrônica salvas com sucesso.');
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
            Assinatura Eletrônica
          </h2>
          <p className="text-sm text-slate-600">
            Configure quais plataformas (Clicksign, DocuSign e Gov.br) ficarão disponíveis para o
            cliente na Etapa 2 após gerar o documento PDF.
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
        <div>
          <label htmlFor="sig-default" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
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
            className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
          >
            <option value="clicksign">Clicksign (MP 2.200-2/2001)</option>
            <option value="docusign">DocuSign eSignature</option>
          </select>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors">
            <div>
              <p className="text-sm font-semibold text-[#0B1D3A]">Clicksign Integrado</p>
              <p className="text-xs text-slate-500 mt-0.5">
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
              className="w-5 h-5 accent-[#0B1D3A] shrink-0"
            />
          </label>

          <label className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors">
            <div>
              <p className="text-sm font-semibold text-[#0B1D3A]">DocuSign Integrado</p>
              <p className="text-xs text-slate-500 mt-0.5">
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
              className="w-5 h-5 accent-[#0B1D3A] shrink-0"
            />
          </label>

          <label className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors">
            <div>
              <p className="text-sm font-semibold text-[#0B1D3A]">Gov.br (assinador.iti.br)</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Tutorial guiado em 5 passos + envio do PDF assinado no portal Gov.br
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
        </div>

        <button
          type="submit"
          disabled={saving}
          className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          {saving ? 'Salvando...' : 'Salvar Configurações de Assinatura'}
        </button>
      </form>
    </section>
  );
}
