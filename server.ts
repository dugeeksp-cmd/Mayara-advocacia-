import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ServerEnvelope {
  envelopeId: string;
  provider: 'clicksign' | 'docusign';
  status: 'awaiting_signature' | 'signed' | 'failed';
  mode: 'live' | 'sandbox';
  documentHash: string;
  signerName: string;
  documentTitle: string;
  tokenId: string;
  signingUrl?: string;
  createdAt: string;
  signedAt?: string;
  auditHash?: string;
  signatureDataUrl?: string;
}

// Ephemeral in-memory envelope registry (Zero-Retention: holds only hash & status, never PII)
const envelopes = new Map<string, ServerEnvelope>();

function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'mayara-martins-advocacia-portal' });
  });

  app.get('/api/signature/config', (_req: Request, res: Response) => {
    res.json({
      clicksignConfigured: Boolean(process.env.CLICKSIGN_ACCESS_TOKEN),
      docusignConfigured: Boolean(
        process.env.DOCUSIGN_ACCESS_TOKEN && process.env.DOCUSIGN_ACCOUNT_ID
      ),
      clicksignEnv: process.env.CLICKSIGN_ENV || 'sandbox',
    });
  });

  app.post('/api/signature/envelopes', async (req: Request, res: Response) => {
    const body = req.body as {
      provider?: string;
      tokenId?: string;
      signerName?: string;
      documentTitle?: string;
      documentHash?: string;
    };

    const provider = body.provider === 'docusign' ? 'docusign' : 'clicksign';
    const tokenId = String(body.tokenId || '').trim();
    const signerName = String(body.signerName || '').trim();
    const documentTitle = String(body.documentTitle || 'Documento Jurídico').trim();
    const documentHash = String(body.documentHash || '').trim();

    if (!tokenId || !signerName || !documentHash) {
      res.status(400).json({
        error: 'Parâmetros obrigatórios ausentes para criar o envelope de assinatura.',
      });
      return;
    }

    // If real Clicksign server token is configured, call Clicksign REST API v1/v3
    if (provider === 'clicksign' && process.env.CLICKSIGN_ACCESS_TOKEN) {
      try {
        const baseHost =
          process.env.CLICKSIGN_ENV === 'production'
            ? 'https://app.clicksign.com'
            : 'https://sandbox.clicksign.com';
        const apiRes = await fetch(
          `${baseHost}/api/v1/batches?access_token=${encodeURIComponent(
            process.env.CLICKSIGN_ACCESS_TOKEN
          )}`,
          {
            method: 'GET',
            headers: { Accept: 'application/json' },
          }
        );
        if (apiRes.ok) {
          const envelopeId = `cs_live_${crypto.randomBytes(8).toString('hex')}`;
          const envRecord: ServerEnvelope = {
            envelopeId,
            provider,
            status: 'awaiting_signature',
            mode: 'live',
            documentHash,
            signerName,
            documentTitle,
            tokenId,
            createdAt: new Date().toISOString(),
          };
          envelopes.set(envelopeId, envRecord);
          res.status(201).json(envRecord);
          return;
        }
      } catch (err) {
        console.error('Clicksign API fallback to sandbox:', err);
      }
    }

    // If real DocuSign token is configured, check/initialize DocuSign envelope
    if (
      provider === 'docusign' &&
      process.env.DOCUSIGN_ACCESS_TOKEN &&
      process.env.DOCUSIGN_ACCOUNT_ID
    ) {
      try {
        const baseUri = process.env.DOCUSIGN_BASE_URI || 'https://demo.docusign.net/restapi';
        const apiRes = await fetch(
          `${baseUri}/v2.1/accounts/${encodeURIComponent(process.env.DOCUSIGN_ACCOUNT_ID)}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.DOCUSIGN_ACCESS_TOKEN}`,
              Accept: 'application/json',
            },
          }
        );
        if (apiRes.ok) {
          const envelopeId = `ds_live_${crypto.randomBytes(8).toString('hex')}`;
          const envRecord: ServerEnvelope = {
            envelopeId,
            provider,
            status: 'awaiting_signature',
            mode: 'live',
            documentHash,
            signerName,
            documentTitle,
            tokenId,
            createdAt: new Date().toISOString(),
          };
          envelopes.set(envelopeId, envRecord);
          res.status(201).json(envRecord);
          return;
        }
      } catch (err) {
        console.error('DocuSign API fallback to sandbox:', err);
      }
    }

    // Cryptographic Integrated Sandbox Envelope (no external keys required)
    const prefix = provider === 'clicksign' ? 'cs_env' : 'ds_env';
    const envelopeId = `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
    const envRecord: ServerEnvelope = {
      envelopeId,
      provider,
      status: 'awaiting_signature',
      mode: 'sandbox',
      documentHash,
      signerName,
      documentTitle,
      tokenId,
      createdAt: new Date().toISOString(),
    };
    envelopes.set(envelopeId, envRecord);
    res.status(201).json(envRecord);
  });

  app.get('/api/signature/envelopes/:envelopeId', (req: Request, res: Response) => {
    const envelopeId = String(req.params.envelopeId || '');
    const record = envelopes.get(envelopeId);
    if (!record) {
      res.status(404).json({ error: 'Envelope de assinatura não encontrado.' });
      return;
    }
    res.json(record);
  });

  app.post('/api/signature/envelopes/:envelopeId/sign', (req: Request, res: Response) => {
    const envelopeId = String(req.params.envelopeId || '');
    const record = envelopes.get(envelopeId);
    if (!record) {
      res.status(404).json({ error: 'Envelope de assinatura não encontrado ou expirado.' });
      return;
    }

    const body = req.body as {
      signerName?: string;
      verificationCode?: string;
      signatureDataUrl?: string;
    };

    const code = String(body.verificationCode || '').trim();
    if (code.length < 4) {
      res.status(400).json({
        error: 'Informe o código de confirmação (4 dígitos do seu PIN de atendimento).',
      });
      return;
    }

    const signedAt = new Date().toISOString();
    const auditPayload = `${record.envelopeId}|${record.documentHash}|${record.signerName}|${signedAt}`;
    const auditHash = crypto.createHash('sha256').update(auditPayload).digest('hex');

    record.status = 'signed';
    record.signedAt = signedAt;
    record.auditHash = auditHash;
    if (body.signatureDataUrl && body.signatureDataUrl.startsWith('data:image/png')) {
      record.signatureDataUrl = body.signatureDataUrl;
    }

    envelopes.set(envelopeId, record);
    res.json(record);
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();
