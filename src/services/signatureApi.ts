import type {
  SignatureEnvelope,
  SignatureProvider,
  SignatureServerConfig,
} from '../types/legal';

export async function fetchSignatureServerConfig(): Promise<SignatureServerConfig> {
  const res = await fetch('/api/signature/config');
  if (!res.ok) {
    throw new Error('Falha ao consultar configuração do servidor de assinatura.');
  }
  return (await res.json()) as SignatureServerConfig;
}

export async function createSignatureEnvelope(params: {
  provider: SignatureProvider;
  tokenId: string;
  signerName: string;
  documentTitle: string;
  documentHash: string;
}): Promise<SignatureEnvelope> {
  const res = await fetch('/api/signature/envelopes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao iniciar assinatura.' }));
    throw new Error(err.error || 'Erro ao iniciar envelope de assinatura.');
  }
  return (await res.json()) as SignatureEnvelope;
}

export async function getSignatureEnvelopeStatus(envelopeId: string): Promise<SignatureEnvelope> {
  const res = await fetch(`/api/signature/envelopes/${encodeURIComponent(envelopeId)}`);
  if (!res.ok) {
    throw new Error('Não foi possível consultar o status da assinatura.');
  }
  return (await res.json()) as SignatureEnvelope;
}

export async function completeIntegratedSignature(params: {
  envelopeId: string;
  signerName: string;
  verificationCode: string;
  signatureDataUrl?: string;
}): Promise<SignatureEnvelope> {
  const res = await fetch(
    `/api/signature/envelopes/${encodeURIComponent(params.envelopeId)}/sign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signerName: params.signerName,
        verificationCode: params.verificationCode,
        signatureDataUrl: params.signatureDataUrl,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao finalizar assinatura.' }));
    throw new Error(err.error || 'Falha ao finalizar assinatura eletrônica.');
  }
  return (await res.json()) as SignatureEnvelope;
}
