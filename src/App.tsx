import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import LazyMapComponent from './components/LazyMapComponent';

// Eager load: lightweight pages that are commonly accessed first
import DashboardPage from './components/DashboardPage';

// Lazy load: heavy map/visualization pages (reduce initial bundle size)
const GeospatialIntelligencePage = lazy(() => import('./components/GeospatialIntelligencePage'));
const AnalyticsPage = lazy(() => import('./components/AnalyticsPage'));
const AdminPage = lazy(() => import('./components/AdminPage'));
const MLTrainingPage = lazy(() => import('./components/MLTrainingPage'));
const WigleTestPage = lazy(() => import('./components/WigleTestPage'));
const KeplerTestPage = lazy(() => import('./components/KeplerTestPage'));
const ApiTestPage = lazy(() => import('./components/ApiTestPage'));

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

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[999999] focus:bg-slate-900 focus:text-white focus:px-3 focus:py-2 focus:rounded"
      >
        Skip to main content
      </a>
      <Navigation />
      <main id="main-content" className="flex h-screen">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/geospatial" element={<GeospatialIntelligencePage />} />
            <Route path="/geospatial-intel" element={<GeospatialIntelligencePage />} />
            <Route path="/geospatial-explorer" element={<LazyMapComponent />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/wigle-test" element={<WigleTestPage />} />
            <Route path="/ml-training" element={<MLTrainingPage />} />
            <Route path="/kepler-test" element={<KeplerTestPage />} />
            <Route path="/endpoint-test" element={<ApiTestPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Suspense>
      </main>
    </Router>
  );
}

export default App;
