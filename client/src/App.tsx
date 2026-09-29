import { Suspense, lazy, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import LazyMapComponent from './components/LazyMapComponent';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoginForm } from './components/auth/LoginForm';
import { ChangePasswordForm } from './components/auth/ChangePasswordForm';
import StartPage from './components/StartPage';
import { VendorIntelDrawer } from './components/vendor-intel/VendorIntelDrawer';
import { DetectionEvidenceGlobal } from './components/geospatial/networkTagMenu/DetectionEvidenceModal';
import { useVendorIntelClickHandler } from './hooks/useVendorIntelClickHandler';

// Eager load: lightweight pages that are commonly accessed first
import DashboardPage from './components/DashboardPage';
import RouteErrorBoundary from './components/ErrorBoundary';

// Lazy load: heavy map/visualization pages (reduce initial bundle size)
const AnalyticsPage = lazy(() => import('./components/AnalyticsPage'));
const AdminPage = lazy(() => import('./components/AdminPage'));
const WiglePage = lazy(() => import('./components/WiglePage'));
const KeplerPage = lazy(() => import('./components/KeplerPage'));
const MonitoringPage = lazy(() => import('./components/MonitoringPage'));

/**
 * Route loading fallback - minimal, no layout shift
 * Uses fixed positioning to overlay without affecting page structure
 */
function RouteLoadingFallback() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
      role="status"
      aria-label="Loading page"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading...</span>
      </div>
    </div>
  );
}

function AppContent() {
  const { loading, login, isAuthenticated, mustChangePassword, pendingUsername, refreshAuth } =
    useAuth();
  useVendorIntelClickHandler();
  const [error, setError] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [forcedCurrentPassword, setForcedCurrentPassword] = useState('');
  const demoMode = String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase() === 'true';

  const handleLogin = (payload: {
    user: any;
    forcePasswordChange?: boolean;
    currentPassword: string;
  }) => {
    setForcedCurrentPassword(payload.forcePasswordChange ? payload.currentPassword : '');
    login({
      user: payload.user,
      forcePasswordChange: payload.forcePasswordChange,
    });
  };

  if (loading) {
    return <RouteLoadingFallback />;
  }

  if (mustChangePassword) {
    return (
      <ChangePasswordForm
        forceMode
        initialUsername={pendingUsername}
        initialCurrentPassword={forcedCurrentPassword}
        onSuccess={async () => {
          setForcedCurrentPassword('');
          await refreshAuth();
        }}
      />
    );
  }

  if (!isAuthenticated) {
    if (showChangePassword) {
      return <ChangePasswordForm onBack={() => setShowChangePassword(false)} />;
    }

    return (
      <div>
        {error && (
          <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg z-50">
            {error}
          </div>
        )}
        <LoginForm
          onLogin={handleLogin}
          onError={setError}
          onChangePassword={() => setShowChangePassword(true)}
        />
      </div>
    );
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-modal focus:bg-slate-900 focus:text-white focus:px-3 focus:py-2 focus:rounded"
      >
        Skip to main content
      </a>
      <Navigation />
      <VendorIntelDrawer />
      <DetectionEvidenceGlobal />
      <main id="main-content" className="flex h-full">
        <RouteErrorBoundary>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route path="/" element={demoMode ? <StartPage /> : <DashboardPage />} />
              <Route path="/start" element={<StartPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/geospatial-explorer" element={<LazyMapComponent />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/wigle" element={<WiglePage />} />
              <Route path="/kepler" element={<KeplerPage />} />
              <Route path="/monitoring" element={<MonitoringPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </main>
    </>
  );
}

function App() {
  const isTestMode =
    String(import.meta.env.VITE_TEST_DB_BANNER || '').toLowerCase() === 'true' ||
    window.location.port === '8081';

  return (
    <AuthProvider>
      <Router>
        <div className="flex flex-col h-screen overflow-hidden">
          {isTestMode && (
            <div
              id="test-db-banner"
              className="w-full bg-amber-600 text-white text-xs font-bold text-center z-[10002] flex items-center justify-center gap-2 uppercase tracking-wider select-none shadow-md border-b border-amber-700/50 shrink-0"
              style={{ height: '32px' }}
            >
              <span className="animate-pulse">⚠️ TEST DATABASE ACTIVE</span>
              <span>—</span>
              <span>Target: shadowcheck_test (API Port: 3002)</span>
              <span>—</span>
              <span className="bg-amber-800 px-1.5 py-0.5 rounded text-[10px]">SANDBOX</span>
            </div>
          )}
          <div className="flex-1 min-h-0 relative h-full">
            <AppContent />
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
