import { useState } from 'react';
import { adminApi } from '../../../api/adminApi';

export type StackAction = 'recreate-api' | 'rebuild-frontend' | 'rebuild-stack';

export interface StackActionMessage {
  tone: 'success' | 'error';
  text: string;
}

export const useStackActions = () => {
  const [stackActionLoading, setStackActionLoading] = useState<StackAction | null>(null);
  const [stackActionMessage, setStackActionMessage] = useState<StackActionMessage | null>(null);

  const runLocalStackAction = async (action: StackAction) => {
    const confirmationText: Record<StackAction, string> = {
      'recreate-api':
        'Recreate the API container now? Use this after changing deploy-time settings or secrets.',
      'rebuild-frontend':
        'Rebuild the frontend container now? Use this after changing build-time frontend flags.',
      'rebuild-stack':
        'Rebuild the full local stack now? This is the most disruptive option and will recreate multiple services.',
    };

    if (!window.confirm(confirmationText[action])) return;

    try {
      setStackActionLoading(action);
      setStackActionMessage(null);
      const response = await adminApi.runLocalStackAction(action);
      setStackActionMessage({
        tone: 'success',
        text: response?.message || `Local stack action '${action}' completed.`,
      });
    } catch (error) {
      setStackActionMessage({
        tone: 'error',
        text: `Failed to run '${action}': ${(error as Error).message}`,
      });
    } finally {
      setStackActionLoading(null);
    }
  };

  return {
    stackActionLoading,
    stackActionMessage,
    runLocalStackAction,
    setStackActionMessage,
  };
};
