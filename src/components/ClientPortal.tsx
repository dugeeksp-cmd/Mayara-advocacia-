import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, LockKeyhole, ShieldAlert } from 'lucide-react';
import type {
  DocumentTemplate,
  LetterheadSettings,
  ServiceLink,
  SignatureConfigSettings,
  SignatureProvider,
} from '../types/legal';
import { dataService } from '../services/dataService';
import { DEFAULT_SIGNATURE_CONFIG, DEFAULT_TEMPLATES } from '../utils/templateEngine';
import type { GeneratedPdfArtifact } from '../utils/pdfGenerator';
import { ClientLayerForm } from './ClientLayerForm';
import { ClientLayerSignature } from './ClientLayerSignature';
import { ClientLayerUpload } from './ClientLayerUpload';

interface ClientPortalProps {
  initialToken: string;
  letterhead: LetterheadSettings;
  onBackHome: () => void;
}

export function ClientPortal({ initialToken, letterhead, onBackHome }: ClientPortalProps) {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [pinInput, setPinInput] = useState('');
  const [loading, setLoading] = useState(Boolean(initialToken));
  const [link, setLink] = useState<ServiceLink | null>(null);
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [signatureConfig, setSignatureConfig] =
    useState<SignatureConfigSettings>(DEFAULT_SIGNATURE_CONFIG);
  const [pinVerified, setPinVerified] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  // Accordion Layer States
  const [activeLayer, setActiveLayer] = useState<1 | 2 | 3>(1);
  const [layer1Done, setLayer1Done] = useState(false);
  const [layer2Unlocked, setLayer2Unlocked] = useState(false);
  const [layer3Unlocked, setLayer3Unlocked] = useState(false);

  // Transient RAM-only document artifact for Layer 2 integrated signature (never persisted!)
  const [transientPdf, setTransientPdf] = useState<{
    artifact: GeneratedPdfArtifact;
    renderedText: string;
    signerDisplayName: string;
  } | null>(null);

  const [completedSummary, setCompletedSummary] = useState<{
    fileName: string;
    methodLabel: string;
  } | null>(null);

  // Clear any transient RAM PDF buffer if user leaves/unmounts page
  useEffect(() => {
    const clearTransient = () => setTransientPdf(null);
    window.addEventListener('beforeunload', clearTransient);
    return () => {
      window.removeEventListener('beforeunload', clearTransient);
      setTransientPdf(null);
    };
  }, []);

  useEffect(() => {
    if (!initialToken) return;
    void loadToken(initialToken);
  }, [initialToken]);

  async function loadToken(token: string) {
    const clean = token.trim();
    if (!clean) {
      setGateError('Informe o código do link de atendimento.');
      return;
    }
    setLoading(true);
    setGateError(null);
    try {
      const found = await dataService.getLinkByToken(clean);
      if (!found) {
        setLink(null);
        setGateError(
          'Link de atendimento não localizado. Verifique o código ou solicite um novo link ao escritório.'
        );
        return;
      }
      setLink(found);
      if (found.status !== 'concluido') {
        const [tpl, sigCfg] = await Promise.all([
          dataService.getTemplateById(found.templateId),
          dataService.getSignatureConfig(),
        ]);
        setTemplate(tpl || DEFAULT_TEMPLATES[0]);
        setSignatureConfig(sigCfg);
      }
    } catch {
      setGateError('Não foi possível validar este link agora. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  }

  async function handleValidatePin(e: React.FormEvent) {
    e.preventDefault();
    setGateError(null);

    if (!link) {
      await loadToken(tokenInput);
      return;
    }

    if (pinInput.trim() !== link.pin) {
      setGateError('Senha (PIN) incorreta. Informe os 4 últimos dígitos do seu telefone.');
      return;
    }

    setPinVerified(true);
    setActiveLayer(1);
  }

  // Final Success Screen
  if (completedSummary) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1D3A] mb-3">
            Documento enviado com sucesso para a Dra. Mayara Martins!
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
            Por motivos de segurança e privacidade, este link foi encerrado permanentemente e
            nenhum dado pessoal digitado permaneceu armazenado.
          </p>
          <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 text-xs sm:text-sm text-slate-700 space-y-1 mb-7">
            <p>
              <strong>Arquivo enviado:</strong>{' '}
              <span className="font-mono">{completedSummary.fileName}</span>
            </p>
            <p>
              <strong>Método de assinatura:</strong> {completedSummary.methodLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] transition-colors"
          >
            Voltar à Página Inicial
          </button>
        </div>
      </main>
    );
  }

  // Expired / Already Used Token Screen
  if (link && link.status === 'concluido') {
    return (
      <main className="max-w-xl mx-auto px-4 py-12 sm:py-16">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F7F1E3] text-[#9A7835] flex items-center justify-center mx-auto mb-5">
            <LockKeyhole className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#0B1D3A] mb-3">
            Link Encerrado por Segurança
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-7">
            Este link já foi utilizado e encerrado por segurança. Caso precise enviar um novo
            documento, solicite um novo link ao escritório.
          </p>
          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] transition-colors"
          >
            Voltar ao Início
          </button>
        </div>
      </main>
    );
  }

  // Gate: Enter Token & 4-Digit PIN
  if (!pinVerified || !link || !template) {
    return (
      <main className="max-w-md mx-auto px-4 py-10 sm:py-16">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#0B1D3A] min-h-[44px] mb-5"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Voltar ao Portal
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <div className="w-12 h-12 rounded-xl bg-[#0B1D3A] text-[#CFAF6E] flex items-center justify-center mb-5">
            <LockKeyhole className="w-6 h-6" aria-hidden="true" />
          </div>

          <h1 className="font-display text-2xl font-bold text-[#0B1D3A] mb-1.5">
            Área do Cliente
          </h1>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {link
              ? `Olá, ${link.clientName}. Para liberar o preenchimento de "${link.templateTitle}", digite os 4 últimos dígitos do seu celular.`
              : 'Informe o código do link recebido via WhatsApp e a senha de 4 dígitos.'}
          </p>

          {gateError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{gateError}</span>
            </div>
          )}

          {loading ? (
            <p className="py-6 text-center text-sm text-slate-500">Validando link seguro...</p>
          ) : (
            <form onSubmit={handleValidatePin} className="space-y-4">
              {!link && (
                <div>
                  <label htmlFor="client-token" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Código do Link de Atendimento
                  </label>
                  <input
                    id="client-token"
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Ex.: mm_demo_pendente_01"
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm text-[#0F172A] bg-white"
                    required
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Link de teste disponível: <span className="font-mono">mm_demo_pendente_01</span> (PIN:{' '}
                    <span className="font-mono">4321</span>)
                  </p>
                </div>
              )}

              {link && (
                <div>
                  <label htmlFor="client-pin" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                    Senha de Acesso (4 últimos dígitos do celular)
                  </label>
                  <input
                    id="client-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="w-full min-h-[52px] px-4 py-2.5 rounded-xl border border-slate-300 font-mono text-xl tracking-[0.35em] text-center text-[#0B1D3A] bg-white tabular-nums"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm sm:text-base font-semibold hover:bg-[#132B52] transition-colors"
              >
                {link ? 'Validar PIN e Iniciar' : 'Localizar Atendimento'}
              </button>

              {link && (
                <button
                  type="button"
                  onClick={() => {
                    setLink(null);
                    setPinInput('');
                    setGateError(null);
                  }}
                  className="w-full min-h-[44px] text-xs font-medium text-slate-500 hover:text-[#0B1D3A]"
                >
                  Informar outro código de atendimento
                </button>
              )}
            </form>
          )}
        </div>
      </main>
    );
  }

  // Verified 3-Layer Accordion Experience
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9A7835] mb-1">
          {letterhead.officeTitle} · {letterhead.oabNumber}
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1D3A]">
          {template.title}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Atendimento destinado a <strong>{link.clientName}</strong> · Siga as etapas abaixo no seu
          aparelho.
        </p>
      </div>

      <div className="space-y-4">
        <ClientLayerForm
          isOpen={activeLayer === 1}
          isCompleted={layer1Done}
          onToggle={() => setActiveLayer(activeLayer === 1 ? 2 : 1)}
          template={template}
          letterhead={letterhead}
          defaultClientName={link.clientName}
          onPdfGenerated={(result) => {
            setTransientPdf(result);
            setLayer1Done(true);
            setLayer2Unlocked(true);
            setActiveLayer(2);
          }}
        />

        <ClientLayerSignature
          isOpen={activeLayer === 2}
          isUnlocked={layer2Unlocked}
          isCompleted={Boolean(completedSummary)}
          onToggle={() => {
            if (layer2Unlocked) setActiveLayer(2);
          }}
          link={link}
          letterhead={letterhead}
          signatureConfig={signatureConfig}
          generatedArtifact={transientPdf?.artifact || null}
          renderedText={transientPdf?.renderedText || ''}
          signerDisplayName={transientPdf?.signerDisplayName || link.clientName}
          onAdvanceToGovBrUpload={() => {
            setLayer3Unlocked(true);
            setActiveLayer(3);
          }}
          onIntegratedSignatureCompleted={(fileName: string, method: SignatureProvider) => {
            // Wipe transient PDF buffer from RAM immediately after upload
            setTransientPdf(null);
            setCompletedSummary({
              fileName,
              methodLabel: method === 'clicksign' ? 'Clicksign (Assinatura Eletrônica)' : 'DocuSign (Assinatura Eletrônica)',
            });
          }}
        />

        <ClientLayerUpload
          isOpen={activeLayer === 3}
          isUnlocked={layer3Unlocked}
          onToggle={() => {
            if (layer3Unlocked) setActiveLayer(3);
          }}
          link={link}
          onUploadCompleted={(fileName) => {
            setTransientPdf(null);
            setCompletedSummary({
              fileName,
              methodLabel: 'Gov.br (assinador.iti.br)',
            });
          }}
        />
      </div>
    </main>
  );
}
