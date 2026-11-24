import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import type { ServiceLink, SignatureConfigSettings } from '../types/legal';
import { dataService } from '../services/dataService';
import { triggerBlobDownload, type GeneratedPdfArtifact } from '../utils/pdfGenerator';

interface ClientLayerSignatureProps {
  isOpen: boolean;
  isUnlocked: boolean;
  isCompleted: boolean;
  onToggle: () => void;
  link: ServiceLink;
  signatureConfig: SignatureConfigSettings;
  generatedArtifact: GeneratedPdfArtifact | null;
  onAdvanceToGovBrUpload: () => void;
}

export function ClientLayerSignature({
  isOpen,
  isUnlocked,
  isCompleted,
  onToggle,
  link,
  signatureConfig,
  generatedArtifact,
  onAdvanceToGovBrUpload,
}: ClientLayerSignatureProps) {
  const portalUrl = signatureConfig.govbrPortalUrl || 'https://assinador.iti.br';

  async function markGovBrSigningStarted() {
    if (link.status === 'pendente') {
      await dataService
        .updateLinkStatus(link.tokenId, {
          status: 'assinando',
          signatureMethod: 'govbr',
        })
        .catch(() => {});
    }
  }

  async function handleProceedToUpload() {
    await markGovBrSigningStarted();
    onAdvanceToGovBrUpload();
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <button
        type="button"
        disabled={!isUnlocked}
        aria-expanded={isOpen}
        onClick={onToggle}
        className="w-full min-h-[64px] px-5 sm:px-7 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50/70 disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
              isCompleted
                ? 'bg-emerald-700 text-white'
                : isOpen
                  ? 'bg-[#0B1D3A] text-white'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isCompleted ? <CheckCircle2 className="w-5 h-5" aria-hidden="true" /> : '2'}
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-[#0B1D3A] truncate">
              Etapa 2 · Assinatura Digital via Gov.br
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 truncate">
              {!isUnlocked
                ? 'Disponível após gerar o PDF na Etapa 1'
                : 'Assine gratuitamente no portal oficial Gov.br (assinador.iti.br)'}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-slate-500 shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && isUnlocked && (
        <div className="px-5 sm:px-7 pb-7 pt-4 border-t border-slate-100 space-y-5">
          {generatedArtifact && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                PDF pronto para assinar:{' '}
                <strong className="font-mono">{generatedArtifact.fileName}</strong>
              </span>
              <button
                type="button"
                onClick={() => triggerBlobDownload(generatedArtifact.blob, generatedArtifact.fileName)}
                className="inline-flex items-center gap-1.5 font-semibold underline hover:text-emerald-950 shrink-0"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Baixar PDF novamente
              </button>
            </div>
          )}

          <div className="p-5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0B1D3A] text-[#CFAF6E] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0B1D3A]">
                    Como assinar gratuitamente pelo Gov.br
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed">
                    {signatureConfig.instructionsNote ||
                      'Gratuito pelo portal oficial do Governo Federal (necessário conta Gov.br nível Prata ou Ouro).'}
                  </p>
                </div>
              </div>

              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void markGovBrSigningStarted()}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2.5 rounded-xl border border-[#0B1D3A] bg-white text-xs sm:text-sm font-semibold text-[#0B1D3A] hover:bg-slate-50 shrink-0 whitespace-nowrap"
              >
                Abrir assinador.iti.br
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>

            <ol className="space-y-3 text-sm text-slate-700">
              {[
                'Acesse o portal oficial assinador.iti.br ou abra o aplicativo Gov.br no seu celular (conta nível Prata ou Ouro).',
                'Faça login com seu CPF e senha da conta Gov.br.',
                `Selecione o arquivo PDF que você acabou de baixar (${generatedArtifact?.fileName || 'Documento_....pdf'}).`,
                'Posicione o selo azul da assinatura eletrônica na área reservada ao final do documento e clique em Assinar.',
                'Digite o código de confirmação recebido via SMS ou aplicativo Gov.br e baixe o novo PDF assinado.',
              ].map((step, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200"
                >
                  <span className="w-6 h-6 rounded-lg bg-[#0B1D3A] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            onClick={() => void handleProceedToUpload()}
            className="w-full min-h-[52px] px-5 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm sm:text-base font-semibold hover:bg-[#132B52] transition-colors inline-flex items-center justify-center gap-2"
          >
            Já assinei no Gov.br, avançar para o envio
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
