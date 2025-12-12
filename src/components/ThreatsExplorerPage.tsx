import React from 'react';
import ThreatsExplorer from './ThreatsExplorer';

export default function ThreatsExplorerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="mb-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-400 to-amber-400 bg-clip-text text-transparent">
          Threats Explorer
        </h1>
        <p className="text-slate-300 mt-1">
          Strong-signal candidates across all devices (mv_network_latest).
        </p>
      </div>
      <ThreatsExplorer />
    </div>
  );
}
