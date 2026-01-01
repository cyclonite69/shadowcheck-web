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

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Navigation />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/geospatial" element={<GeospatialIntelligencePage />} />
        <Route path="/geospatial-intel" element={<GeospatialIntelligencePage />} />
        <Route path="/geospatial-explorer" element={<GeospatialExplorer />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/wigle-test" element={<WigleTestPage />} />
        <Route path="/ml-training" element={<MLTrainingPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Router>
  );
}

export default App;
