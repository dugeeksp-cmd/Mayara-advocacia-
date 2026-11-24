import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Download, MapPin, ShieldCheck } from 'lucide-react';
import type { DocumentTemplate, LetterheadSettings } from '../types/legal';
import {
  formatCEP,
  formatCPF,
  formatCpfOrCnpj,
  formatPhoneBR,
  formatRG,
  isValidCPF,
  isValidEmail,
  onlyDigits,
} from '../utils/masksAndFormatters';
import { extractTemplateFields, interpolateTemplate } from '../utils/templateEngine';
import {
  generateLegalDocumentPdf,
  triggerBlobDownload,
  type GeneratedPdfArtifact,
} from '../utils/pdfGenerator';

interface ClientLayerFormProps {
  isOpen: boolean;
  isCompleted: boolean;
  onToggle: () => void;
  template: DocumentTemplate;
  letterhead: LetterheadSettings;
  defaultClientName: string;
  onPdfGenerated: (result: {
    artifact: GeneratedPdfArtifact;
    renderedText: string;
    signerDisplayName: string;
  }) => void;
}

export function ClientLayerForm({
  isOpen,
  isCompleted,
  onToggle,
  template,
  letterhead,
  defaultClientName,
  onPdfGenerated,
}: ClientLayerFormProps) {
  const fields = useMemo(
    () => extractTemplateFields(template.content, template.customFields),
    [template.content, template.customFields]
  );

  const [values, setValues] = useState<Record<string, string>>(() => ({
    '{{NOME_COMPLETO}}': defaultClientName || '',
  }));

  // Transient CEP helper state (Zero-Retention: wiped immediately after PDF generation)
  const [cep, setCep] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);

  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  function updateField(rawToken: string, val: string, mask: string) {
    let formatted = val;
    if (mask === 'cpf') formatted = formatCPF(val);
    else if (mask === 'cpf_cnpj') formatted = formatCpfOrCnpj(val);
    else if (mask === 'rg') formatted = formatRG(val);
    else if (mask === 'phone') formatted = formatPhoneBR(val);
    setValues((prev) => ({ ...prev, [rawToken]: formatted }));
  }

  async function handleLookupCep(rawCep: string) {
    const clean = onlyDigits(rawCep);
    setCep(formatCEP(clean));
    setCepMessage(null);
    if (clean.length !== 8) return;

    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
        cep?: string;
      };
      if (data.erro || !data.logradouro) {
        setCepMessage('CEP não localizado. Preencha o endereço manualmente.');
        return;
      }
      const numPart = addressNumber.trim() ? `, n.º ${addressNumber.trim()}` : ', n.º ___';
      const compPart = addressComplement.trim() ? ` (${addressComplement.trim()})` : '';
      const composed = `${data.logradouro}${numPart}${compPart}, ${data.bairro}, ${data.localidade}/${data.uf}, CEP ${data.cep}`;
      setValues((prev) => ({ ...prev, '{{ENDERECO_COMPLETO}}': composed }));
      setCepMessage('Endereço preenchido via ViaCEP. Confira o número da residência.');
    } catch {
      setCepMessage('Não foi possível consultar o ViaCEP agora. Preencha manualmente.');
    } finally {
      setCepLoading(false);
    }
  }

  function applyNumberToAddress(num: string, comp: string) {
    setAddressNumber(num);
    setAddressComplement(comp);
    const currentAddr = values['{{ENDERECO_COMPLETO}}'] || '';
    if (!currentAddr) return;
    // Update n.º placeholder if already populated from ViaCEP
    if (currentAddr.includes(', n.º ')) {
      const updated = currentAddr.replace(
        /, n\.º [^,]+(?:\s*\([^)]*\))?/,
        `, n.º ${num.trim() || '___'}${comp.trim() ? ` (${comp.trim()})` : ''}`
      );
      setValues((prev) => ({ ...prev, '{{ENDERECO_COMPLETO}}': updated }));
    }
  }

  async function handleGeneratePdf(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    for (const field of fields) {
      const val = (values[field.rawToken] || '').trim();
      if (!val) {
        setError(`Por favor, preencha o campo "${field.label}".`);
        return;
      }
      if (field.mask === 'cpf' && !isValidCPF(val)) {
        setError('O CPF informado não é válido. Confira os dígitos.');
        return;
      }
      if (field.mask === 'email' && !isValidEmail(val)) {
        setError('Informe um endereço de e-mail válido.');
        return;
      }
    }

    if (!lgpdAccepted) {
      setError('É obrigatório confirmar a ciência da política de privacidade LGPD Zero-Retention.');
      return;
    }

    setGenerating(true);
    try {
      const renderedText = interpolateTemplate(
        template.content,
        values,
        undefined,
        template.customFields
      );
      const signerDisplayName = (values['{{NOME_COMPLETO}}'] || defaultClientName).trim();

      const artifact = await generateLegalDocumentPdf({
        documentTitle: template.title,
        renderedText,
        letterhead,
        clientName: signerDisplayName,
      });

      // Trigger automatic client-side PDF download
      triggerBlobDownload(artifact.blob, artifact.fileName);

      // LGPD Zero-Retention: immediately wipe all personal fields from React memory
      setValues({});
      setCep('');
      setAddressNumber('');
      setAddressComplement('');
      setCepMessage(null);

      onPdfGenerated({
        artifact,
        renderedText,
        signerDisplayName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar o PDF do documento.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="w-full min-h-[64px] px-5 sm:px-7 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50/70 transition-colors"
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
            {isCompleted ? <CheckCircle2 className="w-5 h-5" aria-hidden="true" /> : '1'}
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-[#0B1D3A] truncate">
              Etapa 1 · Preenchimento dos Dados
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 truncate">
              {isCompleted
                ? 'PDF gerado e dados pessoais descartados da memória'
                : 'Seus dados não são gravados no servidor (LGPD)'}
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

      {isOpen && (
        <form onSubmit={handleGeneratePdf} className="px-5 sm:px-7 pb-7 pt-2 border-t border-slate-100 space-y-5">
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((field) => {
              if (field.isAddressComposite) {
                return (
                  <div key={field.rawToken} className="sm:col-span-2 space-y-3 p-4 rounded-xl bg-[#F7F8FA] border border-slate-200">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1D3A]">
                      <MapPin className="w-4 h-4 text-[#9A7835]" aria-hidden="true" />
                      <span>Busca Automática por CEP (ViaCEP)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="client-cep" className="block text-xs font-medium text-slate-600 mb-1">
                          CEP
                        </label>
                        <input
                          id="client-cep"
                          type="text"
                          inputMode="numeric"
                          value={cep}
                          onChange={(e) => void handleLookupCep(e.target.value)}
                          placeholder="00000-000"
                          className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm tabular-nums"
                        />
                      </div>
                      <div>
                        <label htmlFor="client-addr-num" className="block text-xs font-medium text-slate-600 mb-1">
                          Número
                        </label>
                        <input
                          id="client-addr-num"
                          type="text"
                          value={addressNumber}
                          onChange={(e) => applyNumberToAddress(e.target.value, addressComplement)}
                          placeholder="Ex.: 720"
                          className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="client-addr-comp" className="block text-xs font-medium text-slate-600 mb-1">
                          Complemento
                        </label>
                        <input
                          id="client-addr-comp"
                          type="text"
                          value={addressComplement}
                          onChange={(e) => applyNumberToAddress(addressNumber, e.target.value)}
                          placeholder="Apto / Casa / Loja"
                          className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                        />
                      </div>
                    </div>

                    {cepLoading && (
                      <p className="text-xs text-slate-500">Consultando endereço pelo CEP...</p>
                    )}
                    {cepMessage && <p className="text-xs text-[#0B1D3A] font-medium">{cepMessage}</p>}

                    <div>
                      <label htmlFor={`field-${field.key}`} className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                        {field.label}
                      </label>
                      <input
                        id={`field-${field.key}`}
                        type="text"
                        value={values[field.rawToken] || ''}
                        onChange={(e) => updateField(field.rawToken, e.target.value, field.mask)}
                        placeholder={field.placeholder}
                        className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-base text-[#0F172A]"
                        required
                      />
                    </div>
                  </div>
                );
              }

              const isWide = field.key === 'NOME_COMPLETO' || field.key.startsWith('CAMPO_');

              return (
                <div key={field.rawToken} className={isWide ? 'sm:col-span-2' : ''}>
                  <label
                    htmlFor={`field-${field.key}`}
                    className="block text-sm font-semibold text-[#0B1D3A] mb-1.5"
                  >
                    {field.label}
                  </label>
                  <input
                    id={`field-${field.key}`}
                    type={field.type}
                    inputMode={field.mask === 'cpf' || field.mask === 'phone' ? 'numeric' : undefined}
                    value={values[field.rawToken] || ''}
                    onChange={(e) => updateField(field.rawToken, e.target.value, field.mask)}
                    placeholder={field.placeholder}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-base text-[#0F172A]"
                    required
                  />
                </div>
              );
            })}
          </div>

          {/* Mandatory LGPD Zero-Retention Consent */}
          <label className="flex items-start gap-3 p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 cursor-pointer">
            <input
              id="lgpd-consent"
              type="checkbox"
              checked={lgpdAccepted}
              onChange={(e) => setLgpdAccepted(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-[#0B1D3A] shrink-0"
              required
            />
            <span className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              <strong className="text-[#0B1D3A] inline-flex items-center gap-1 mr-1">
                <ShieldCheck className="w-4 h-4 text-[#9A7835]" aria-hidden="true" />
                Privacidade LGPD:
              </strong>
              Declaro estar ciente de que este sistema não armazena meus dados pessoais em banco de
              dados; as informações digitadas serão utilizadas exclusivamente no meu navegador para
              preencher o documento e descartadas imediatamente após o encerramento.
            </span>
          </label>

          <button
            type="submit"
            disabled={generating}
            className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#0B1D3A] text-white text-sm sm:text-base font-semibold hover:bg-[#132B52] disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" aria-hidden="true" />
            {generating ? 'Gerando PDF timbrado...' : 'Gerar Documento PDF'}
          </button>
        </form>
      )}
    </section>
  );
}
