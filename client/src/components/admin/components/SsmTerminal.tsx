import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface SsmTerminalProps {
  instanceId: string;
  onClose: () => void;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

const statusColors: Record<ConnectionStatus, string> = {
  connecting: 'bg-amber-900/40 text-amber-300',
  connected: 'bg-green-900/40 text-green-300',
  disconnected: 'bg-slate-800/60 text-slate-400',
  error: 'bg-red-900/40 text-red-300',
};

export const SsmTerminal: React.FC<SsmTerminalProps> = ({ instanceId, onClose }) => {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  const cleanup = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
    }
    fitAddonRef.current = null;
  }, []);

  useEffect(() => {
    if (!termRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#e2e8f0',
        selectionBackground: '#334155',
      },
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(termRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/ssm?instanceId=${encodeURIComponent(instanceId)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      terminal.focus();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'output':
            terminal.write(msg.data || '');
            break;
          case 'status':
            terminal.writeln(`\r\n\x1b[36m${msg.data}\x1b[0m`);
            break;
          case 'error':
            terminal.writeln(`\r\n\x1b[31mError: ${msg.data}\x1b[0m`);
            setStatus('error');
            break;
          case 'exit':
            terminal.writeln(`\r\n\x1b[33m${msg.data}\x1b[0m`);
            setStatus('disconnected');
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setStatus((prev) => (prev === 'error' ? prev : 'disconnected'));
      terminal.writeln('\r\n\x1b[33mConnection closed.\x1b[0m');
    };

    ws.onerror = () => {
      setStatus('error');
    };

    // Terminal input → WebSocket
    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // ResizeObserver for fit
    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // Terminal may be disposed
      }
    });
    observer.observe(termRef.current);
    observerRef.current = observer;

    return cleanup;
  }, [instanceId, cleanup]);

  return (
    <div className="mt-4 rounded-lg border border-slate-700/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-slate-300">{instanceId}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[status]}`}>
            {status}
          </span>
        </div>
        <button
          onClick={() => {
            cleanup();
            onClose();
          }}
          className="px-3 py-1 text-xs bg-slate-700/60 text-slate-300 rounded hover:bg-slate-600/60 transition"
        >
          Close
        </button>
      </div>
      <div
        ref={termRef}
        style={{ height: 400, resize: 'vertical', overflow: 'hidden' }}
        className="bg-slate-950"
      />
    </div>
  );
};
