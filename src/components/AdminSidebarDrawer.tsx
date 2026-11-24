import { useEffect } from 'react';
import {
  FileText,
  Link2,
  PenTool,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';

export type AdminSection = 'generate' | 'links' | 'clients' | 'cms' | 'signature';

interface AdminSidebarDrawerProps {
  isOpen: boolean;
  activeSection: AdminSection;
  documentsCount: number;
  clientsCount: number;
  onClose: () => void;
  onSelectSection: (section: AdminSection) => void;
}

export function AdminSidebarDrawer({
  isOpen,
  activeSection,
  documentsCount,
  clientsCount,
  onClose,
  onSelectSection,
}: AdminSidebarDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems: Array<{
    id: AdminSection;
    label: string;
    icon: typeof Link2;
    count?: number;
  }> = [
    { id: 'generate', label: 'Gerar Link', icon: Link2 },
    { id: 'links', label: 'Documentos Recebidos', icon: FileText, count: documentsCount },
    { id: 'clients', label: 'Clientes', icon: Users, count: clientsCount },
    { id: 'cms', label: 'Modelo e Timbrado', icon: PenTool },
    { id: 'signature', label: 'Assinatura Eletrônica', icon: ShieldCheck },
  ];

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menu administrativo">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fechar menu lateral"
        onClick={onClose}
        className="fixed inset-0 bg-[#0B1D3A]/45 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Panel */}
      <aside className="relative z-10 w-80 max-w-[85vw] bg-white border-r border-slate-200 h-full flex flex-col shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A7835]">
              OAB/RJ 229.359
            </p>
            <h2 className="font-display text-lg font-bold text-[#0B1D3A]">
              Menu Administrativo
            </h2>
          </div>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#0B1D3A] hover:bg-slate-50"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Navegação do painel administrativo" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onClose();
                }}
                className={`w-full min-h-[48px] px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-left text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#0B1D3A] text-white'
                    : 'text-[#0B1D3A] hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#CFAF6E]' : 'text-[#9A7835]'}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      isActive ? 'text-[#CFAF6E]' : 'text-slate-500'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500">
          Mayara Martins Advocacia · Portal Seguro
        </div>
      </aside>
    </div>
  );
}
