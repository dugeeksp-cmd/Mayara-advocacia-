import { ArrowRight, FileCheck2, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { LetterheadSettings } from '../types/legal';

interface HomePortalProps {
  letterhead: LetterheadSettings;
  onEnterClientArea: () => void;
  onEnterAdminArea: () => void;
}

export function HomePortal({
  letterhead,
  onEnterClientArea,
  onEnterAdminArea,
}: HomePortalProps) {
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-11">
      {/* Institutional Header */}
      <section className="max-w-3xl mx-auto text-center mb-8 sm:mb-10">
        <p className="text-xs sm:text-sm font-semibold tracking-[0.14em] uppercase text-[#9A7835] mb-2.5">
          {letterhead.oabNumber} · Atendimento Digital Seguro
        </p>
        <h1 className="font-display text-3xl sm:text-5xl font-bold text-[#0B1D3A] leading-tight tracking-tight [text-wrap:balance] mb-3.5">
          {letterhead.officeTitle}
        </h1>
        <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto [text-wrap:balance]">
          Portal de automação jurídica para emissão, conferência e assinatura eletrônica de
          documentos com proteção integral de dados pessoais (LGPD Zero-Retention).
        </p>
      </section>

      {/* Two Primary Entry Cards */}
      <section
        aria-label="Portais de acesso"
        className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-10"
      >
        {/* Card 1: Client Portal */}
        <div className="bg-white border border-slate-200 rounded-2xl p-7 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-[#0B1D3A] text-[#CFAF6E] flex items-center justify-center mb-5">
              <FileCheck2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-[#0B1D3A] mb-2.5">
              Área do Cliente
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
              Recebeu um link ou código de atendimento? Preencha seus dados no seu próprio aparelho,
              gere o PDF timbrado e assine digitalmente via Clicksign, DocuSign ou Gov.br.
            </p>
          </div>
          <button
            type="button"
            onClick={onEnterClientArea}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm sm:text-base font-semibold hover:bg-[#132B52] active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2"
          >
            Acessar Área do Cliente
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Card 2: Admin Portal */}
        <div className="bg-white border border-slate-200 rounded-2xl p-7 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-[#F7F1E3] text-[#9A7835] flex items-center justify-center mb-5">
              <LockKeyhole className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-[#0B1D3A] mb-2.5">
              Área Administrativa
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
              Acesso exclusivo da advogada para geração de links com envio via WhatsApp, gestão em
              tempo real dos documentos assinados e edição do papel timbrado.
            </p>
          </div>
          <button
            type="button"
            onClick={onEnterAdminArea}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl border border-[#0B1D3A] bg-white text-[#0B1D3A] text-sm sm:text-base font-semibold hover:bg-slate-50 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2"
          >
            Entrar no Painel da Advogada
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* LGPD Zero-Retention Architecture Strip */}
      <section className="max-w-4xl mx-auto border-t border-slate-200 pt-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm text-slate-600">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#9A7835] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[#0B1D3A] mb-1">Zero-Retention (LGPD)</p>
              <p className="leading-relaxed">
                CPF, RG e endereço permanecem apenas na memória do navegador durante a geração do PDF.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileCheck2 className="w-5 h-5 text-[#9A7835] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[#0B1D3A] mb-1">Assinatura Integrada ou Gov.br</p>
              <p className="leading-relaxed">
                Escolha assinar na própria tela via Clicksign/DocuSign ou pelo assinador oficial Gov.br.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <LockKeyhole className="w-5 h-5 text-[#9A7835] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[#0B1D3A] mb-1">Link Único Protegido por PIN</p>
              <p className="leading-relaxed">
                Acesso liberado somente com os 4 últimos dígitos do celular e encerrado após o envio.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
