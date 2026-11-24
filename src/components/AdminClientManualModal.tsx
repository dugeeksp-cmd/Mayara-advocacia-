import React, { useEffect, useState } from 'react';
import { FileDown, Loader2, MapPin, Save, UserPlus, X } from 'lucide-react';
import type {
  ClientRecord,
  DocumentTemplate,
  FooterProfile,
  HeaderProfile,
  LetterheadSettings,
  LogoAsset,
} from '../types/legal';
import type { SaveClientInput } from '../services/dataService';
import {
  extractLast4Digits,
  formatCEP,
  formatCPF,
  formatPhoneBR,
  formatRG,
  isValidCPF,
  isValidEmail,
  onlyDigits,
} from '../utils/masksAndFormatters';
import { buildTemplateValuesFromClient } from '../utils/legalFieldOptions';
import { interpolateTemplate } from '../utils/templateEngine';
import { resolveTemplateTimbrado } from '../utils/timbradoTheme';
import { generateLegalDocumentPdf, triggerBlobDownload } from '../utils/pdfGenerator';
import {
  MaritalStatusSelectField,
  NationalitySelectField,
  ProfessionComboboxField,
} from './SmartLegalFields';

interface AdminClientManualModalProps {
  isOpen: boolean;
  editingClient?: ClientRecord | null;
  prefillName?: string;
  prefillWhatsapp?: string;
  templates: DocumentTemplate[];
  headers: HeaderProfile[];
  footers: FooterProfile[];
  logos: LogoAsset[];
  letterhead: LetterheadSettings;
  onClose: () => void;
  onSaveClient: (input: SaveClientInput) => Promise<ClientRecord>;
  onCreateAtendimentoForClient: (input: {
    clientId: string;
    clientName: string;
    whatsapp: string;
    templateId: string;
    templateTitle: string;
  }) => Promise<void>;
  onSuccessFeedback: (msg: string) => void;
}

export function AdminClientManualModal({
  isOpen,
  editingClient = null,
  prefillName = '',
  prefillWhatsapp = '',
  templates,
  headers,
  footers,
  logos,
  letterhead,
  onClose,
  onSaveClient,
  onCreateAtendimentoForClient,
  onSuccessFeedback,
}: AdminClientManualModalProps) {
  const defaultTemplate = templates.find((t) => t.isDefault) || templates[0];

  const [templateId, setTemplateId] = useState<string>(defaultTemplate?.id || '');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('brasileiro(a)');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [profession, setProfession] = useState('');
  const [address, setAddress] = useState('');

  // Quick ViaCEP helper state
  const [cepInput, setCepInput] = useState('');
  const [numberInput, setNumberInput] = useState('');
  const [complementInput, setComplementInput] = useState('');
  const [cepLoading, setCepLoading] = useState(false);

  const [generatePdfNow, setGeneratePdfNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setTemplateId(defaultTemplate?.id || templates[0]?.id || '');
    if (editingClient) {
      setFullName(editingClient.fullName);
      setCpf(editingClient.cpf);
      setRg(editingClient.rg);
      setWhatsapp(editingClient.whatsapp);
      setEmail(editingClient.email);
      setNationality(editingClient.nationality || 'brasileiro(a)');
      setMaritalStatus(editingClient.maritalStatus);
      setProfession(editingClient.profession);
      setAddress(editingClient.address);
      setGeneratePdfNow(false);
    } else {
      setFullName(prefillName);
      setCpf('');
      setRg('');
      setWhatsapp(prefillWhatsapp);
      setEmail('');
      setNationality('brasileiro(a)');
      setMaritalStatus('');
      setProfession('');
      setAddress('');
      setCepInput('');
      setNumberInput('');
      setComplementInput('');
      setGeneratePdfNow(true);
    }
  }, [isOpen, editingClient, prefillName, prefillWhatsapp, defaultTemplate?.id, templates]);

  if (!isOpen) return null;

  async function handleLookupCep(rawCep: string) {
    const clean = onlyDigits(rawCep);
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) return;
      const numPart = numberInput.trim() ? `, n.º ${numberInput.trim()}` : '';
      const compPart = complementInput.trim() ? ` (${complementInput.trim()})` : '';
      const composed = [
        `${data.logradouro || ''}${numPart}${compPart}`.trim(),
        data.bairro || '',
        data.localidade && data.uf ? `${data.localidade}/${data.uf}` : '',
        `CEP ${formatCEP(clean)}`,
      ]
        .filter(Boolean)
        .join(' - ');
      setAddress(composed);
    } catch {
      // Ignore network issues on CEP helper; user can type address freely
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Informe o nome completo do cliente.');
      return;
    }
    if (!isValidCPF(cpf)) {
      setError('Informe um número de CPF válido (11 dígitos).');
      return;
    }
    if (extractLast4Digits(whatsapp).length !== 4) {
      setError('Informe um número de WhatsApp válido com DDD.');
      return;
    }
    if (email.trim() && !isValidEmail(email)) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }
    if (!nationality.trim()) {
      setError('Selecione ou informe a nacionalidade do cliente.');
      return;
    }
    if (!maritalStatus.trim()) {
      setError('Selecione o estado civil do cliente.');
      return;
    }
    if (!profession.trim()) {
      setError('Informe a profissão do cliente.');
      return;
    }
    if (!address.trim()) {
      setError('Informe o endereço completo do cliente.');
      return;
    }

    setSubmitting(true);
    try {
      const id =
        editingClient?.id ||
        `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const savedClient = await onSaveClient({
        id,
        fullName: fullName.trim(),
        cpf: formatCPF(cpf),
        rg: rg.trim(),
        email: email.trim(),
        whatsapp: formatPhoneBR(whatsapp),
        address: address.trim(),
        nationality: nationality.trim(),
        maritalStatus: maritalStatus.trim(),
        profession: profession.trim(),
      });

      const selectedTpl = templates.find((t) => t.id === templateId) || defaultTemplate;

      if (generatePdfNow && selectedTpl) {
        await onCreateAtendimentoForClient({
          clientId: savedClient.id,
          clientName: savedClient.fullName,
          whatsapp: savedClient.whatsapp,
          templateId: selectedTpl.id,
          templateTitle: selectedTpl.title,
        });

        const tagValues = buildTemplateValuesFromClient(savedClient);
        const renderedText = interpolateTemplate(
          selectedTpl.content,
          tagValues,
          new Date(),
          selectedTpl.customFields
        );
        const { header, footer, logo } = resolveTemplateTimbrado({
          template: selectedTpl,
          headers,
          footers,
          logos,
          fallbackLetterhead: letterhead,
        });
        const artifact = await generateLegalDocumentPdf({
          documentTitle: selectedTpl.title,
          renderedText,
          letterhead,
          header,
          footer,
          logo,
          clientName: savedClient.fullName,
        });
        triggerBlobDownload(artifact.blob, artifact.fileName);
        onSuccessFeedback(
          `Cliente "${savedClient.fullName}" cadastrado no Firebase e PDF "${selectedTpl.title}" gerado para download.`
        );
      } else {
        onSuccessFeedback(
          `Cadastro de "${savedClient.fullName}" salvo e sincronizado com sucesso.`
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar cliente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1D3A]/55 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-client-modal-title"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl my-auto">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0B1D3A] text-[#CFAF6E] flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="manual-client-modal-title"
                className="font-display text-xl font-bold text-[#0B1D3A]"
              >
                {editingClient ? 'Atualizar Cadastro do Cliente' : 'Cadastrar Cliente Manualmente'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Preencha os dados pelo painel, salve no banco em nuvem e gere o PDF na hora.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Fechar modal de cadastro de cliente"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-medium"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Template Selection */}
          <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label htmlFor="mc-template" className="text-sm font-semibold text-[#0B1D3A]">
                Modelo de Documento
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0B1D3A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={generatePdfNow}
                  onChange={(e) => setGeneratePdfNow(e.target.checked)}
                  className="w-4 h-4 accent-[#0B1D3A]"
                />
                Gerar e baixar PDF ao salvar
              </label>
            </div>
            <select
              id="mc-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={!generatePdfNow}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] disabled:opacity-60"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title} ({tpl.category})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="mc-name" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                Nome Completo *
              </label>
              <input
                id="mc-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex.: Mariana Costa Oliveira"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-base text-[#0F172A]"
                required
              />
            </div>

            <div>
              <label htmlFor="mc-cpf" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                CPF *
              </label>
              <input
                id="mc-cpf"
                type="text"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-base text-[#0F172A] tabular-nums"
                required
              />
            </div>

            <div>
              <label htmlFor="mc-rg" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                RG
              </label>
              <input
                id="mc-rg"
                type="text"
                value={rg}
                onChange={(e) => setRg(formatRG(e.target.value))}
                placeholder="00.000.000-0"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-base text-[#0F172A]"
              />
            </div>

            <div>
              <label htmlFor="mc-whatsapp" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                WhatsApp *
              </label>
              <input
                id="mc-whatsapp"
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatPhoneBR(e.target.value))}
                placeholder="(22) 99999-9999"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-base text-[#0F172A] tabular-nums"
                required
              />
            </div>

            <div>
              <label htmlFor="mc-email" className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
                E-mail
              </label>
              <input
                id="mc-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@exemplo.com"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-base text-[#0F172A]"
              />
            </div>

            <NationalitySelectField
              id="mc-nationality"
              label="Nacionalidade *"
              value={nationality}
              onChange={setNationality}
            />

            <MaritalStatusSelectField
              id="mc-marital"
              label="Estado Civil *"
              value={maritalStatus}
              onChange={setMaritalStatus}
            />

            <div className="sm:col-span-2">
              <ProfessionComboboxField
                id="mc-profession"
                label="Profissão *"
                value={profession}
                onChange={setProfession}
              />
            </div>
          </div>

          {/* Address with optional ViaCEP quick lookup */}
          <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0B1D3A]">
              <MapPin className="w-4 h-4 text-[#9A7835]" aria-hidden="true" />
              <span>Endereço Completo (preenchimento automático opcional por CEP)</span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label htmlFor="mc-cep" className="block text-xs font-semibold text-slate-600 mb-1">
                  CEP
                </label>
                <input
                  id="mc-cep"
                  type="text"
                  inputMode="numeric"
                  value={cepInput}
                  onChange={(e) => {
                    const masked = formatCEP(e.target.value);
                    setCepInput(masked);
                    if (onlyDigits(masked).length === 8) {
                      void handleLookupCep(masked);
                    }
                  }}
                  placeholder="28994-675"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>
              <div>
                <label htmlFor="mc-num" className="block text-xs font-semibold text-slate-600 mb-1">
                  Número
                </label>
                <input
                  id="mc-num"
                  type="text"
                  value={numberInput}
                  onChange={(e) => setNumberInput(e.target.value)}
                  onBlur={() => {
                    if (onlyDigits(cepInput).length === 8) void handleLookupCep(cepInput);
                  }}
                  placeholder="Nº"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>
              <div>
                <label htmlFor="mc-comp" className="block text-xs font-semibold text-slate-600 mb-1">
                  Compl.
                </label>
                <input
                  id="mc-comp"
                  type="text"
                  value={complementInput}
                  onChange={(e) => setComplementInput(e.target.value)}
                  onBlur={() => {
                    if (onlyDigits(cepInput).length === 8) void handleLookupCep(cepInput);
                  }}
                  placeholder="Apto / Casa"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="mc-address" className="block text-xs font-semibold text-[#0B1D3A] mb-1">
                Endereço Formatado para o Documento * {cepLoading ? '(Buscando CEP...)' : ''}
              </label>
              <input
                id="mc-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro, cidade/UF e CEP"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A]"
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 inline-flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Salvando...
                </>
              ) : generatePdfNow ? (
                <>
                  <FileDown className="w-4 h-4" aria-hidden="true" />
                  Salvar e Gerar PDF
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" aria-hidden="true" />
                  Salvar Cliente
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
