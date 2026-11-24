import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Eraser,
  ExternalLink,
  FileSignature,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import type {
  FooterProfile,
  HeaderProfile,
  LetterheadSettings,
  LogoAsset,
  ServiceLink,
  SignatureConfigSettings,
  SignatureEnvelope,
  SignatureProvider,
} from '../types/legal';
import { dataService } from '../services/dataService';
import {
  completeIntegratedSignature,
  createSignatureEnvelope,
  getSignatureEnvelopeStatus,
} from '../services/signatureApi';
import {
  generateSignedDocumentPdf,
  triggerBlobDownload,
  type GeneratedPdfArtifact,
} from '../utils/pdfGenerator';

interface ClientLayerSignatureProps {
  isOpen: boolean;
  isUnlocked: boolean;
  isCompleted: boolean;
  onToggle: () => void;
  link: ServiceLink;
  letterhead: LetterheadSettings;
  header?: HeaderProfile | null;
  footer?: FooterProfile | null;
  logo?: LogoAsset | null;
  signatureConfig: SignatureConfigSettings;
  generatedArtifact: GeneratedPdfArtifact | null;
  renderedText: string;
  signerDisplayName: string;
  onAdvanceToGovBrUpload: () => void;
  onIntegratedSignatureCompleted: (fileName: string, method: SignatureProvider) => void;
}

export function ClientLayerSignature({
  isOpen,
  isUnlocked,
  isCompleted,
  onToggle,
  link,
  letterhead,
  header,
  footer,
  logo,
  signatureConfig,
  generatedArtifact,
  renderedText,
  signerDisplayName,
  onAdvanceToGovBrUpload,
  onIntegratedSignatureCompleted,
}: ClientLayerSignatureProps) {
  const defaultTab: 'integrated' | 'govbr' =
    signatureConfig.clicksignEnabled || signatureConfig.docusignEnabled ? 'integrated' : 'govbr';
  const [methodTab, setMethodTab] = useState<'integrated' | 'govbr'>(defaultTab);
  const [provider, setProvider] = useState<SignatureProvider>(signatureConfig.defaultProvider);

  const [envelope, setEnvelope] = useState<SignatureEnvelope | null>(null);
  const [creatingEnv, setCreatingEnv] = useState(false);
  const [signing, setSigning] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Signature Canvas Pad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0B1D3A';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [envelope]);

  function getPointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    isDrawingRef.current = true;
    setHasDrawn(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function handlePointerUp() {
    isDrawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  async function handleStartIntegratedSignature() {
    if (!generatedArtifact) {
      setError('Gere o documento PDF na Etapa 1 antes de iniciar a assinatura.');
      return;
    }
    setError(null);
    setCreatingEnv(true);
    try {
      const env = await createSignatureEnvelope({
        provider,
        tokenId: link.tokenId,
        signerName: signerDisplayName || link.clientName,
        documentTitle: link.templateTitle,
        documentHash: generatedArtifact.sha256,
      });
      setEnvelope(env);
      await dataService.updateLinkStatus(link.tokenId, {
        status: 'assinando',
        signatureMethod: provider,
        signatureEnvelopeId: env.envelopeId,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao conectar com a plataforma de assinatura.'
      );
    } finally {
      setCreatingEnv(false);
    }
  }

  async function handleRefreshStatus() {
    if (!envelope) return;
    setPolling(true);
    try {
      const latest = await getSignatureEnvelopeStatus(envelope.envelopeId);
      setEnvelope(latest);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status.');
    } finally {
      setPolling(false);
    }
  }

  async function handleCompleteSignature(e: React.FormEvent) {
    e.preventDefault();
    if (!envelope || !generatedArtifact) return;
    setError(null);

    if (pinConfirm.trim() !== link.pin) {
      setError('O código de confirmação deve corresponder aos 4 últimos dígitos do seu celular.');
      return;
    }

    setSigning(true);
    try {
      const signatureDataUrl =
        hasDrawn && canvasRef.current ? canvasRef.current.toDataURL('image/png') : undefined;

      const signedEnv = await completeIntegratedSignature({
        envelopeId: envelope.envelopeId,
        signerName: signerDisplayName || link.clientName,
        verificationCode: pinConfirm.trim(),
        signatureDataUrl,
      });
      setEnvelope(signedEnv);

      // Generate final signed PDF with MP 2.200-2/2001 audit seal & upload to Storage + Firestore
      const signedArtifact = await generateSignedDocumentPdf({
        documentTitle: link.templateTitle,
        renderedText,
        letterhead,
        header,
        footer,
        logo,
        clientName: signerDisplayName || link.clientName,
        provider: signedEnv.provider,
        envelopeId: signedEnv.envelopeId,
        documentHash: generatedArtifact.sha256,
        auditHash: signedEnv.auditHash || generatedArtifact.sha256,
        signedAtIso: signedEnv.signedAt || new Date().toISOString(),
        signatureDataUrl,
      });

      triggerBlobDownload(signedArtifact.blob, signedArtifact.fileName);

      const uploaded = await dataService.uploadSignedPdf(
        link.tokenId,
        signedArtifact.blob,
        signedArtifact.fileName
      );

      await dataService.updateLinkStatus(link.tokenId, {
        status: 'concluido',
        signatureMethod: signedEnv.provider,
        signatureEnvelopeId: signedEnv.envelopeId,
        signatureAuditHash: signedEnv.auditHash || signedArtifact.sha256,
        signedPdfUrl: uploaded.url,
        signedPdfStoragePath: uploaded.storagePath,
        signedPdfName: uploaded.fileName,
      });

      onIntegratedSignatureCompleted(uploaded.fileName, signedEnv.provider);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível concluir e enviar a assinatura.'
      );
    } finally {
      setSigning(false);
    }
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
              Etapa 2 · Assinatura Eletrônica
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 truncate">
              {!isUnlocked
                ? 'Disponível após gerar o PDF na Etapa 1'
                : 'Assine pela plataforma integrada (Clicksign/DocuSign) ou via Gov.br'}
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
              <span>
                PDF gerado: <strong className="font-mono">{generatedArtifact.fileName}</strong>
              </span>
              <button
                type="button"
                onClick={() => triggerBlobDownload(generatedArtifact.blob, generatedArtifact.fileName)}
                className="font-semibold underline hover:text-emerald-950"
              >
                Baixar novamente
              </button>
            </div>
          )}

          {/* Method Switcher */}
          <div
            role="tablist"
            aria-label="Escolha o método de assinatura"
            className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-xl"
          >
            {(signatureConfig.clicksignEnabled || signatureConfig.docusignEnabled) && (
              <button
                type="button"
                role="tab"
                aria-selected={methodTab === 'integrated'}
                onClick={() => setMethodTab('integrated')}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  methodTab === 'integrated'
                    ? 'bg-white text-[#0B1D3A] shadow-sm'
                    : 'text-slate-600 hover:text-[#0B1D3A]'
                }`}
              >
                Plataforma Integrada (Clicksign / DocuSign)
              </button>
            )}

            {signatureConfig.govbrEnabled && (
              <button
                type="button"
                role="tab"
                aria-selected={methodTab === 'govbr'}
                onClick={() => setMethodTab('govbr')}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  methodTab === 'govbr'
                    ? 'bg-white text-[#0B1D3A] shadow-sm'
                    : 'text-slate-600 hover:text-[#0B1D3A]'
                }`}
              >
                Assinatura Digital Gov.br (assinador.iti.br)
              </button>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm"
            >
              {error}
            </div>
          )}

          {/* Option A: Integrated Electronic Signature (Clicksign / DocuSign) */}
          {methodTab === 'integrated' && (
            <div className="space-y-5">
              {!envelope ? (
                <div className="p-5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-[#0B1D3A] mb-1">
                      Assinar diretamente nesta página
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Com a assinatura eletrônica integrada (validade jurídica nos termos da MP
                      2.200-2/2001), você assina agora mesmo e o PDF autenticado é enviado
                      automaticamente para a Dra. Mayara Martins.
                    </p>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-[#0B1D3A] mb-2">
                      Selecione o provedor de assinatura:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {signatureConfig.clicksignEnabled && (
                        <button
                          type="button"
                          onClick={() => setProvider('clicksign')}
                          className={`min-h-[48px] px-4 py-3 rounded-xl border text-left transition-colors ${
                            provider === 'clicksign'
                              ? 'border-[#0B1D3A] bg-white text-[#0B1D3A] font-semibold'
                              : 'border-slate-200 bg-white/70 text-slate-600'
                          }`}
                        >
                          <span className="block text-sm">Clicksign</span>
                          <span className="block text-xs text-slate-500 font-normal">
                            Padrão jurídico nacional · SHA-256
                          </span>
                        </button>
                      )}
                      {signatureConfig.docusignEnabled && (
                        <button
                          type="button"
                          onClick={() => setProvider('docusign')}
                          className={`min-h-[48px] px-4 py-3 rounded-xl border text-left transition-colors ${
                            provider === 'docusign'
                              ? 'border-[#0B1D3A] bg-white text-[#0B1D3A] font-semibold'
                              : 'border-slate-200 bg-white/70 text-slate-600'
                          }`}
                        >
                          <span className="block text-sm">DocuSign</span>
                          <span className="block text-xs text-slate-500 font-normal">
                            eSignature Global · Trilha de auditoria
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={creatingEnv}
                    onClick={handleStartIntegratedSignature}
                    className="w-full min-h-[52px] px-5 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm sm:text-base font-semibold hover:bg-[#132B52] disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    {creatingEnv ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        Preparando envelope de assinatura...
                      </>
                    ) : (
                      <>
                        <FileSignature className="w-5 h-5" aria-hidden="true" />
                        Iniciar Assinatura via {provider === 'clicksign' ? 'Clicksign' : 'DocuSign'}
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleCompleteSignature}
                  className="p-5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-4"
                >
                  {/* Envelope Status Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div className="text-xs sm:text-sm">
                      <span className="text-slate-500">Envelope:</span>{' '}
                      <span className="font-mono font-semibold text-[#0B1D3A]">
                        {envelope.envelopeId}
                      </span>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="text-slate-600 capitalize">
                        {envelope.provider} ({envelope.mode === 'live' ? 'Produção' : 'Homologação'})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRefreshStatus}
                      disabled={polling}
                      className="text-xs font-semibold text-[#0B1D3A] underline min-h-[36px] px-2"
                    >
                      {polling ? 'Atualizando...' : 'Status: Aguardando assinatura'}
                    </button>
                  </div>

                  {/* Signature Pad */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="signature-pad" className="text-sm font-semibold text-[#0B1D3A]">
                        Rubrica / Assinatura na Tela (opcional, mas recomendado)
                      </label>
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-[#0B1D3A] min-h-[36px] px-2"
                      >
                        <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
                        Limpar
                      </button>
                    </div>
                    <canvas
                      id="signature-pad"
                      ref={canvasRef}
                      width={560}
                      height={150}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                      className="w-full h-36 bg-white border border-slate-300 rounded-xl touch-none cursor-crosshair"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Desenhe sua assinatura acima usando o dedo ou o mouse.
                    </p>
                  </div>

                  {/* Token / PIN Confirmation */}
                  <div>
                    <label
                      htmlFor="sig-pin-confirm"
                      className="block text-sm font-semibold text-[#0B1D3A] mb-1.5"
                    >
                      Confirme os 4 últimos dígitos do seu celular (PIN de Autenticação)
                    </label>
                    <input
                      id="sig-pin-confirm"
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={pinConfirm}
                      onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="••••"
                      className="w-full sm:w-48 min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-lg tracking-[0.25em] text-center tabular-nums"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={signing}
                    className="w-full min-h-[52px] px-5 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm sm:text-base font-semibold hover:bg-[#132B52] disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    {signing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        Autenticando e enviando PDF assinado...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                        Assinar e Enviar para a Advogada
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Option B: Gov.br Visual 5-Step Tutorial */}
          {methodTab === 'govbr' && (
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#0B1D3A]">
                      Passo a passo · Assinatura Digital Gov.br
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Gratuito pelo portal oficial do Governo Federal (conta nível Prata ou Ouro).
                    </p>
                  </div>
                  <a
                    href="https://assinador.iti.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl border border-[#0B1D3A] bg-white text-xs sm:text-sm font-semibold text-[#0B1D3A] hover:bg-slate-50"
                  >
                    Abrir assinador.iti.br
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  </a>
                </div>

                <ol className="space-y-3 text-sm text-slate-700">
                  {[
                    'Acesse o portal oficial assinador.iti.br ou abra o aplicativo Gov.br no seu celular (necessário conta nível Prata ou Ouro).',
                    'Faça login com seu CPF e senha da conta Gov.br.',
                    `Selecione o arquivo PDF que você acabou de baixar (${generatedArtifact?.fileName || 'Procuracao_...pdf'}).`,
                    'Posicione o selo azul da assinatura eletrônica na área indicada ao final do documento e clique em Assinar.',
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
                onClick={onAdvanceToGovBrUpload}
                className="w-full min-h-[52px] px-5 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm sm:text-base font-semibold hover:bg-[#132B52] transition-colors inline-flex items-center justify-center gap-2"
              >
                Já assinei o documento, avançar para o envio
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
