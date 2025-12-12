import React from 'react';
import NetworksExplorer from './NetworksExplorer';

export default function NetworksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white p-6">
      <div className="mb-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Network Explorer
        </h1>
        <p className="text-slate-300">Comprehensive explorer backed by mv_network_latest.</p>
      </div>
      <NetworksExplorer />
    </div>
  );
}
