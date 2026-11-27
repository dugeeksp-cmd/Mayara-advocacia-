import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { LetterheadSettings } from './types/legal';
import { auth } from './services/firebaseConfig';
import { dataService, setPersistenceMode } from './services/dataService';
import { DEFAULT_LETTERHEAD } from './utils/templateEngine';
import { deriveLetterheadFromProfiles } from './utils/timbradoTheme';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopBar, type AppView } from './components/TopBar';
import { HomePortal } from './components/HomePortal';
import { AdminAuthGate } from './components/AdminAuthGate';
import { AdminDashboard } from './components/AdminDashboard';
import { ClientPortal } from './components/ClientPortal';
import {
  CURRENT_APP_VERSION,
  VersionChangelogModal,
} from './components/VersionChangelogModal';
import { cleanPortalPathname, resolveInitialPortalRoute } from './utils/portalUrl';

function getInitialRoute() {
  if (typeof window === 'undefined') {
    return { initialToken: '', initialView: 'home' as const };
  }
  return resolveInitialPortalRoute(window.location.search);
}

export default function App() {
  const [initialRoute] = useState(() => getInitialRoute());
  const [initialToken, setInitialToken] = useState<string>(initialRoute.initialToken);
  const [activeView, setActiveView] = useState<AppView>(initialRoute.initialView);
  const [adminMode, setAdminMode] = useState<'firebase' | 'local' | null>(null);
  const [letterhead, setLetterhead] = useState<LetterheadSettings>(DEFAULT_LETTERHEAD);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  useEffect(() => {
    void Promise.all([
      dataService.getHeaders(),
      dataService.getFooters(),
      dataService.getLogos(),
      dataService.getLetterhead(),
    ]).then(([headers, footers, logos, lh]) => {
      setLetterhead(
        deriveLetterheadFromProfiles({
          headers,
          footers,
          logos,
          fallback: lh,
        })
      );
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.emailVerified) {
        setPersistenceMode('firebase');
        setAdminMode('firebase');
        setActiveView((prev) => (prev === 'admin-auth' ? 'admin' : prev));
      }
    });
    return () => unsubscribe();
  }, []);

  function handleNavigate(view: AppView) {
    if (window.location.search) {
      window.history.replaceState({}, '', cleanPortalPathname(window.location.pathname));
    }
    if (view !== 'client') {
      setInitialToken('');
    }
    setActiveView(view);
  }

  async function handleAdminLogout() {
    if (adminMode === 'firebase') {
      await signOut(auth).catch(() => {});
    }
    setAdminMode(null);
    setPersistenceMode('local');
    setActiveView('home');
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-[#0F172A]">
        <TopBar
          activeView={activeView}
          isAdminAuthenticated={adminMode !== null}
          onNavigate={handleNavigate}
          onAdminLogout={() => void handleAdminLogout()}
        />

        <div className="flex-1">
          {activeView === 'home' && (
            <HomePortal
              letterhead={letterhead}
              onEnterClientArea={() => setActiveView('client')}
              onEnterAdminArea={() => setActiveView(adminMode ? 'admin' : 'admin-auth')}
            />
          )}

          {activeView === 'admin-auth' && (
            <AdminAuthGate
              onBack={() => setActiveView('home')}
              onSuccess={(mode) => {
                setAdminMode(mode);
                setActiveView('admin');
              }}
            />
          )}

          {activeView === 'admin' && adminMode && (
            <AdminDashboard
              mode={adminMode}
              letterhead={letterhead}
              onLetterheadUpdated={setLetterhead}
            />
          )}

          {activeView === 'client' && (
            <ClientPortal
              initialToken={initialToken}
              letterhead={letterhead}
              onBackHome={() => handleNavigate('home')}
            />
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white/95 mt-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs leading-relaxed text-slate-600">
            <p className="font-medium text-[#0B1D3A] text-center md:text-left [text-wrap:balance] max-w-md md:max-w-none">
              © 2026 Mayara Martins — Advocacia e Consultoria Jurídica. Todos os direitos
              reservados.
            </p>

            <div className="flex flex-col items-center md:items-end gap-1.5 text-center md:text-right">
              <p className="text-slate-600 [text-wrap:balance]">
                Sistema exclusivo para a Dra. Mayara Martins • Desenvolvido com carinho por{' '}
                <span className="font-semibold text-[#9A7835]">Eduardo Lima</span>
              </p>
              <button
                type="button"
                onClick={() => setVersionModalOpen(true)}
                className="text-[11px] font-medium text-slate-500 hover:text-[#0B1D3A] underline underline-offset-4 decoration-slate-300 hover:decoration-[#B8934A] transition-colors py-1 px-2 rounded"
              >
                Versão {CURRENT_APP_VERSION}
              </button>
            </div>
          </div>
        </footer>

        <VersionChangelogModal
          isOpen={versionModalOpen}
          onClose={() => setVersionModalOpen(false)}
        />
      </div>
    </ErrorBoundary>
  );
}
