import React, { useState } from 'react';

type Result = {
  ok: boolean;
  status: number;
  body: any;
};

async function callApi(path: string, options?: RequestInit): Promise<Result> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const text = await res.text();
    let body: any = text;
    try {
      body = JSON.parse(text);
    } catch (_) {
      /* plain text */
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err: any) {
    return { ok: false, status: 0, body: err?.message || 'Request failed' };
  }
}

export default function MLTrainingPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState<any>(null);

  const runTraining = async () => {
    setLoading(true);
    setMessage('Starting training...');
    setLogs(null);
    const result = await callApi('/api/ml/train');
    setLoading(false);
    setMessage(result.ok ? 'Training complete' : `Training failed (${result.status})`);
    setLogs(result.body);
  };

  const runQuickTest = async () => {
    setLoading(true);
    setMessage('Running quick inference...');
    setLogs(null);
    const result = await callApi('/api/ml/reassess');
    setLoading(false);
    setMessage(result.ok ? 'Inference complete' : `Inference failed (${result.status})`);
    setLogs(result.body);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          ML Training Console
        </h1>
        <p className="text-slate-300 mt-1">
          Trigger server-side ML training and quick reassess calls.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={runTraining}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Working…' : 'Start Training (/api/ml/train)'}
        </button>
        <button
          onClick={runQuickTest}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Working…' : 'Run Quick Reassess (/api/ml/reassess)'}
        </button>
      </div>

      {message && <div className="text-slate-200">{message}</div>}

      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">Response</h2>
        <pre className="text-xs text-slate-200 whitespace-pre-wrap break-all">
          {logs ? JSON.stringify(logs, null, 2) : 'No output yet.'}
        </pre>
      </div>
    </div>
  );
}
