import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { ServerIcon } from './ConfigIcons';
import type { StackAction, StackActionMessage } from '../../hooks/useStackActions';

interface StackActionsConfigProps {
  stackActionLoading: StackAction | null;
  stackActionMessage: StackActionMessage | null;
  runLocalStackAction: (action: StackAction) => void;
}

export const StackActionsConfig: React.FC<StackActionsConfigProps> = ({
  stackActionLoading,
  stackActionMessage,
  runLocalStackAction,
}) => (
  <AdminCard icon={ServerIcon} title="Stack Actions" color="from-emerald-500 to-teal-600">
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
        Use these only when you intentionally want to apply deploy-time or build-time config changes
        to the local Docker stack.
      </div>
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          disabled={stackActionLoading !== null}
          onClick={() => runLocalStackAction('recreate-api')}
          className="rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-sm text-amber-100 transition hover:bg-amber-600/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stackActionLoading === 'recreate-api' ? 'Recreating API...' : 'Recreate API'}
        </button>
        <button
          type="button"
          disabled={stackActionLoading !== null}
          onClick={() => runLocalStackAction('rebuild-frontend')}
          className="rounded-lg border border-fuchsia-600/40 bg-fuchsia-600/10 px-3 py-2 text-sm text-fuchsia-100 transition hover:bg-fuchsia-600/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stackActionLoading === 'rebuild-frontend'
            ? 'Rebuilding frontend...'
            : 'Rebuild Frontend'}
        </button>
        <button
          type="button"
          disabled={stackActionLoading !== null}
          onClick={() => runLocalStackAction('rebuild-stack')}
          className="rounded-lg border border-blue-600/40 bg-blue-600/10 px-3 py-2 text-sm text-blue-100 transition hover:bg-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stackActionLoading === 'rebuild-stack'
            ? 'Rebuilding full stack...'
            : 'Rebuild Full Stack'}
        </button>
      </div>
      {stackActionMessage ? (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            stackActionMessage.tone === 'success'
              ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-200'
              : 'border-red-700/50 bg-red-900/20 text-red-200'
          }`}
        >
          {stackActionMessage.text}
        </div>
      ) : null}
    </div>
  </AdminCard>
);
