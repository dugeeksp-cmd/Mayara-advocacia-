import React, { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Send, Smartphone } from 'lucide-react';
import type { DocumentTemplate, ServiceLink } from '../types/legal';
import { dataService } from '../services/dataService';
import {
  extractLast4Digits,
  formatPhoneBR,
  generateWhatsAppUrl,
} from '../utils/masksAndFormatters';
import {
  buildClientTokenRelativeHref,
  buildClientTokenUrl,
} from '../utils/portalUrl';

interface AdminLinkGeneratorProps {
  templates: DocumentTemplate[];
  onLinkCreated: (link: ServiceLink) => void;
}

export function AdminLinkGenerator({ templates, onLinkCreated }: AdminLinkGeneratorProps) {
  const defaultTemplateId = useMemo(() => {
    const def = templates.find((t) => t.isDefault) || templates[0];
    return def?.id || 'procuracao-ad-judicia';
  }, [templates]);

  const [clientName, setClientName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [templateId, setTemplateId] = useState(defaultTemplateId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{
    link: ServiceLink;
    url: string;
    waUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const previewPin = extractLast4Digits(whatsapp);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (clientName.trim().length < 2) {
      setError('Informe o nome completo do cliente.');
      return;
    }
    if (previewPin.length !== 4) {
      setError('Informe um número de WhatsApp válido com DDD e telefone completo.');
      return;
    }

    const selectedTemplate = templates.find((t) => t.id === templateId) || templates[0];
    if (!selectedTemplate) {
      setError('Selecione um modelo de documento válido.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await dataService.createServiceLink({
        clientName: clientName.trim(),
        whatsapp: whatsapp.trim(),
        templateId: selectedTemplate.id,
        templateTitle: selectedTemplate.title,
      });

      const clientUrl = buildClientTokenUrl(created.tokenId);
      const waUrl = generateWhatsAppUrl(
        created.whatsapp,
        created.clientName,
        clientUrl,
        created.pin,
        created.templateTitle
      );

      setGenerated({ link: created, url: clientUrl, waUrl });
      onLinkCreated(created);
      setClientName('');
      setWhatsapp('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar link de atendimento.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyUrl() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Form Column */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#0B1D3A] mb-1.5">
          Gerar Link de Atendimento
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          O link exclusivo utiliza automaticamente os 4 últimos dígitos do WhatsApp do cliente como
          senha (PIN) de proteção.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="gen-client-name" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
              Nome do Cliente
            </label>
            <input
              id="gen-client-name"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex.: Carlos Eduardo Ferreira"
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-base text-[#0F172A] bg-white"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="gen-whatsapp" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                WhatsApp do Cliente
              </label>
              <input
                id="gen-whatsapp"
                type="tel"
                inputMode="numeric"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatPhoneBR(e.target.value))}
                placeholder="(22) 99999-9999"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-base text-[#0F172A] bg-white tabular-nums"
                required
              />
            </div>

            <div>
              <span className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                PIN Gerado Automaticamente
              </span>
              <div className="min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">4 últimos dígitos</span>
                <span className="font-mono text-base font-semibold text-[#0B1D3A] tabular-nums">
                  {previewPin.length === 4 ? previewPin : '••••'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="gen-template" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
              Modelo de Documento
            </label>
            <select
              id="gen-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-base text-[#0F172A] bg-white"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title} ({tpl.category})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm sm:text-base font-semibold hover:bg-[#132B52] disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            {submitting ? 'Gerando link seguro...' : 'Gerar Link e Enviar via WhatsApp'}
          </button>
        </form>
      </div>

      {/* Output / Dispatch Column */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-2.5 mb-4">
          <Smartphone className="w-5 h-5 text-[#9A7835]" aria-hidden="true" />
          <h3 className="font-display text-lg font-semibold text-[#0B1D3A]">
            Envio ao Cliente
          </h3>
        </div>

        {!generated ? (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl px-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Preencha o formulário ao lado para gerar o token exclusivo de atendimento e a mensagem
              pronta para envio pelo WhatsApp.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Cliente</span>
                <span className="font-semibold text-[#0B1D3A]">{generated.link.clientName}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Documento</span>
                <span className="font-medium text-slate-800">{generated.link.templateTitle}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">PIN de Acesso</span>
                <span className="font-mono font-semibold text-[#9A7835] tabular-nums">
                  {generated.link.pin}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="block text-xs text-slate-500 mb-1">Link direto</span>
                <p className="font-mono text-xs text-slate-700 break-all">{generated.url}</p>
              </div>
            </div>

            <a
              href={generated.waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#15803D] text-white text-sm font-semibold hover:bg-[#166534] transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              Abrir Mensagem no WhatsApp
            </a>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-[#0B1D3A] hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    Copiar Link
                  </>
                )}
              </button>

              <a
                href={buildClientTokenRelativeHref(generated.link.tokenId)}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-[#0B1D3A] hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                Testar Link
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
