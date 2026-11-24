import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { LetterheadSettings } from './types/legal';
import { auth } from './services/firebaseConfig';
import { dataService, setPersistenceMode } from './services/dataService';
import { DEFAULT_LETTERHEAD } from './utils/templateEngine';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopBar, type AppView } from './components/TopBar';
import { HomePortal } from './components/HomePortal';
import { AdminAuthGate } from './components/AdminAuthGate';
import { AdminDashboard } from './components/AdminDashboard';
import { ClientPortal } from './components/ClientPortal';

function getInitialTokenFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return (params.get('token') || '').trim();
}

export default function App() {
  const [initialToken, setInitialToken] = useState<string>(() => getInitialTokenFromUrl());
  const [activeView, setActiveView] = useState<AppView>(() =>
    getInitialTokenFromUrl() ? 'client' : 'home'
  );
  const [adminMode, setAdminMode] = useState<'firebase' | 'local' | null>(null);
  const [letterhead, setLetterhead] = useState<LetterheadSettings>(DEFAULT_LETTERHEAD);

  useEffect(() => {
    void dataService.getLetterhead().then((lh) => setLetterhead(lh));

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.emailVerified) {
        setPersistenceMode('firebase');
        setAdminMode('firebase');
      }
    });
    return () => unsubscribe();
  }, []);

  function handleNavigate(view: AppView) {
    if (view !== 'client') {
      // Clean token query param when leaving client portal
      if (window.location.search.includes('token=')) {
        window.history.replaceState({}, '', '/');
        setInitialToken('');
      }
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

        <footer className="border-t border-slate-200 bg-white mt-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p className="font-medium text-[#0B1D3A] text-center sm:text-left">
              {letterhead.officeTitle} · {letterhead.oabNumber}
            </p>
            <p className="text-center sm:text-right">
              {letterhead.addressFooter} · {letterhead.phone} · {letterhead.email}
            </p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
