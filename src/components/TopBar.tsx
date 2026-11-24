import { LogOut, Scale } from 'lucide-react';

export type AppView = 'home' | 'client' | 'admin-auth' | 'admin';

interface TopBarProps {
  activeView: AppView;
  isAdminAuthenticated: boolean;
  onNavigate: (view: AppView) => void;
  onAdminLogout: () => void;
}

export function TopBar({
  activeView,
  isAdminAuthenticated,
  onNavigate,
  onAdminLogout,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 min-h-[44px] group"
        >
          <Scale className="w-5 h-5 text-[#9A7835] shrink-0" aria-hidden="true" />
          <span className="font-display text-lg font-semibold tracking-tight text-[#0B1D3A] group-hover:text-[#1D3E73] transition-colors">
            Mayara Martins
          </span>
        </button>

        {/* Zone 2: Concise single-line text links */}
        <nav
          aria-label="Navegação principal"
          className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className={`whitespace-nowrap shrink-0 min-h-[44px] border-b-2 transition-colors ${
              activeView === 'home'
                ? 'border-[#B8934A] text-[#0B1D3A] font-semibold'
                : 'border-transparent hover:text-[#0B1D3A]'
            }`}
          >
            Início
          </button>
          <button
            type="button"
            onClick={() => onNavigate('client')}
            className={`whitespace-nowrap shrink-0 min-h-[44px] border-b-2 transition-colors ${
              activeView === 'client'
                ? 'border-[#B8934A] text-[#0B1D3A] font-semibold'
                : 'border-transparent hover:text-[#0B1D3A]'
            }`}
          >
            Área do Cliente
          </button>
          <button
            type="button"
            onClick={() => onNavigate(isAdminAuthenticated ? 'admin' : 'admin-auth')}
            className={`whitespace-nowrap shrink-0 min-h-[44px] border-b-2 transition-colors ${
              activeView === 'admin' || activeView === 'admin-auth'
                ? 'border-[#B8934A] text-[#0B1D3A] font-semibold'
                : 'border-transparent hover:text-[#0B1D3A]'
            }`}
          >
            Área Administrativa
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          {isAdminAuthenticated && activeView === 'admin' ? (
            <button
              type="button"
              onClick={onAdminLogout}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-[#0B1D3A] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Sair
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('client')}
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132B52] transition-colors whitespace-nowrap shrink-0"
            >
              Acessar Documento
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
