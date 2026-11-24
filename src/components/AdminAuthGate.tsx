import React, { useState } from 'react';
import { ArrowLeft, KeyRound, ShieldAlert } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebaseConfig';
import { setPersistenceMode, verifyMasterPassword } from '../services/dataService';

interface AdminAuthGateProps {
  onSuccess: (mode: 'firebase' | 'local') => void;
  onBack: () => void;
}

export function AdminAuthGate({ onSuccess, onBack }: AdminAuthGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  async function handleGoogleLogin() {
    setError(null);
    setLoadingGoogle(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setPersistenceMode('firebase');
      onSuccess('firebase');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na autenticação Google.';
      if (msg.includes('popup-closed-by-user')) {
        setError('A janela de login Google foi fechada antes da conclusão.');
      } else {
        setError(
          'Não foi possível autenticar via Google neste navegador. Você pode acessar com a Senha Mestra abaixo.'
        );
      }
    } finally {
      setLoadingGoogle(false);
    }
  }

  async function handleMasterPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password.trim()) {
      setError('Digite a senha mestra administrativa.');
      return;
    }
    setLoadingPassword(true);
    try {
      const ok = await verifyMasterPassword(password);
      if (!ok) {
        setError('Senha mestra incorreta. Verifique e tente novamente.');
        return;
      }
      setPersistenceMode('firebase');
      onSuccess('firebase');
    } finally {
      setLoadingPassword(false);
    }
  }

  function handleTestModeEnter() {
    setError(null);
    setPersistenceMode('firebase');
    onSuccess('firebase');
  }

  return (
    <main className="max-w-md mx-auto px-4 py-12 sm:py-16">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#0B1D3A] min-h-[44px] mb-6"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Voltar ao Portal
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="w-12 h-12 rounded-xl bg-[#0B1D3A] text-[#CFAF6E] flex items-center justify-center mb-5">
          <KeyRound className="w-6 h-6" aria-hidden="true" />
        </div>

        <h1 className="font-display text-2xl font-bold text-[#0B1D3A] mb-1.5">
          Área Administrativa
        </h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Acesso restrito da Dra. Mayara Martins (OAB/RJ 229.359) para emissão de links,
          acompanhamento de assinaturas e edição de modelos.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Option 1: Master Password */}
        <form onSubmit={handleMasterPasswordSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="admin-master-password"
              className="block text-sm font-semibold text-[#0B1D3A] mb-1.5"
            >
              Senha Mestra do Escritório
            </label>
            <input
              id="admin-master-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha mestra"
              autoComplete="current-password"
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-base text-[#0F172A] bg-white focus:border-[#0B1D3A]"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Senha inicial de demonstração: <span className="font-mono">Mayara@229359</span>
            </p>
          </div>

          <button
            type="submit"
            disabled={loadingPassword}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] disabled:opacity-60 transition-colors"
          >
            {loadingPassword ? 'Validando acesso...' : 'Desbloquear Painel'}
          </button>

          <button
            type="button"
            onClick={handleTestModeEnter}
            className="w-full min-h-[46px] px-5 py-2.5 rounded-xl border border-[#B8934A] bg-[#F7F1E3]/60 text-[#0B1D3A] text-sm font-semibold hover:bg-[#F7F1E3] transition-colors"
          >
            Entrar sem senha (Modo Teste)
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          <span>ou conecte à nuvem Firebase</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* Option 2: Google Firebase Auth */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loadingGoogle}
          className="w-full min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 bg-white text-[#0B1D3A] text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors flex items-center justify-center gap-2.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
            />
          </svg>
          {loadingGoogle ? 'Conectando...' : 'Entrar com Conta Google (Nuvem)'}
        </button>
      </div>
    </main>
  );
}
