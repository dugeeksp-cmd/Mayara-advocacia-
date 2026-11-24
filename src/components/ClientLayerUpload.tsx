import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, FileUp, Loader2, Send } from 'lucide-react';
import type { ServiceLink } from '../types/legal';
import { dataService } from '../services/dataService';
import { sha256Hex } from '../utils/masksAndFormatters';

interface ClientLayerUploadProps {
  isOpen: boolean;
  isUnlocked: boolean;
  onToggle: () => void;
  link: ServiceLink;
  onUploadCompleted: (fileName: string) => void;
}

export function ClientLayerUpload({
  isOpen,
  isUnlocked,
  onToggle,
  link,
  onUploadCompleted,
}: ClientLayerUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Selecione apenas arquivos no formato PDF (.pdf) assinados.');
      setSelectedFile(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('O arquivo PDF excede o limite máximo de 10 MB.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  }

  async function handleSubmitUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setError('Selecione o PDF assinado pelo Gov.br antes de enviar.');
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const auditHash = await sha256Hex(buffer);

      const uploaded = await dataService.uploadSignedPdf(
        link.tokenId,
        selectedFile,
        selectedFile.name
      );

      await dataService.updateLinkStatus(link.tokenId, {
        status: 'concluido',
        signatureMethod: 'govbr',
        signatureAuditHash: auditHash,
        signedPdfUrl: uploaded.url,
        signedPdfStoragePath: uploaded.storagePath,
        signedPdfName: uploaded.fileName,
      });

      onUploadCompleted(uploaded.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar o documento assinado.');
    } finally {
      setUploading(false);
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
              isOpen ? 'bg-[#0B1D3A] text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            3
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-[#0B1D3A] truncate">
              Etapa 3 · Envio do Documento Assinado
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 truncate">
              {!isUnlocked
                ? 'Disponível após concluir a assinatura na Etapa 2'
                : 'Anexe o PDF assinado pelo Gov.br para finalizar o atendimento'}
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
        <form
          onSubmit={handleSubmitUpload}
          className="px-5 sm:px-7 pb-7 pt-4 border-t border-slate-100 space-y-5"
        >
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="signed-pdf-upload"
              className="block text-sm font-semibold text-[#0B1D3A] mb-2"
            >
              Selecione o PDF assinado (extensão .pdf)
            </label>
            <label
              htmlFor="signed-pdf-upload"
              className="flex flex-col items-center justify-center gap-2 min-h-[140px] p-6 rounded-xl border-2 border-dashed border-slate-300 bg-[#F7F8FA] hover:border-[#0B1D3A] cursor-pointer transition-colors text-center"
            >
              <FileUp className="w-8 h-8 text-[#9A7835]" aria-hidden="true" />
              {selectedFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#0B1D3A] inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {(selectedFile.size / 1024).toFixed(1)} KB · Toque para alterar
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#0B1D3A]">
                    Toque para escolher o PDF assinado
                  </p>
                  <p className="text-xs text-slate-500">
                    Arquivo baixado do assinador.iti.br ou App Gov.br (máx. 10 MB)
                  </p>
                </div>
              )}
              <input
                id="signed-pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#0B1D3A] text-white text-sm sm:text-base font-semibold hover:bg-[#132B52] disabled:opacity-55 transition-colors inline-flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                Enviando documento com segurança...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" aria-hidden="true" />
                Enviar Documento para a Advogada
              </>
            )}
          </button>
        </form>
      )}
    </section>
  );
}
