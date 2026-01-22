import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import DashboardPage from './components/DashboardPage';
import GeospatialIntelligencePage from './components/GeospatialIntelligencePage';
import GeospatialExplorer from './components/GeospatialExplorer';
import AnalyticsPage from './components/AnalyticsPage';
import AdminPage from './components/AdminPage';
import MLTrainingPage from './components/MLTrainingPage';
import WigleTestPage from './components/WigleTestPage';
import KeplerTestPage from './components/KeplerTestPage';
import ApiTestPage from './components/ApiTestPage';

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
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/geospatial" element={<GeospatialIntelligencePage />} />
          <Route path="/geospatial-intel" element={<GeospatialIntelligencePage />} />
          <Route path="/geospatial-explorer" element={<GeospatialExplorer />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/wigle-test" element={<WigleTestPage />} />
          <Route path="/ml-training" element={<MLTrainingPage />} />
          <Route path="/kepler-test" element={<KeplerTestPage />} />
          <Route path="/endpoint-test" element={<ApiTestPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
