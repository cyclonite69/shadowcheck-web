import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DashboardPage from './components/DashboardPage';
import GeospatialPage from './components/GeospatialPage';
import GeospatialIntelligencePage from './components/GeospatialIntelligencePage';
import AnalyticsPage from './components/AnalyticsPage';
import AdminPage from './components/AdminPage';
import MLTrainingPage from './components/MLTrainingPage';
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
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/geospatial" element={<GeospatialIntelligencePage />} />
        <Route path="/geospatial-intel" element={<GeospatialIntelligencePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/ml-training" element={<MLTrainingPage />} />
        <Route path="/kepler-test" element={<KeplerTestPage />} />
        <Route path="/api-test" element={<ApiTestPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Router>
  );
}

export default App;
