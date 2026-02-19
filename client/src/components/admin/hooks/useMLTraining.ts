import { useState } from 'react';
import { MLStatus } from '../types/admin.types';
import { adminApi } from '../../../api/adminApi';

export const useMLTraining = () => {
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlResult, setMlResult] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const loadMLStatus = async () => {
    try {
      const data = await adminApi.getMLStatus();
      setMlStatus(data);
    } catch {
      setMlStatus({ modelTrained: false, taggedNetworks: [] });
    }
  };

  const trainModel = async () => {
    setMlLoading(true);
    setMlResult(null);
    try {
      const data = await adminApi.trainML();
      if (data.ok) {
        setMlResult({
          type: 'success',
          message: `Model trained successfully! ${data.trainingSamples} samples (${data.threatCount} threats, ${data.safeCount} safe). Scoring job started.`,
        });
        await loadMLStatus();
      } else {
        setMlResult({
          type: 'error',
          message: data.error || 'Training failed',
        });
      }
    } catch (err: any) {
      setMlResult({ type: 'error', message: `Network error: ${err.message}` });
    } finally {
      setMlLoading(false);
    }
  };

  const recalculateScores = async (limit: number = 5000) => {
    setMlLoading(true);
    setMlResult(null);
    try {
      const data = await adminApi.scoreAll(limit);
      if (data.ok) {
        setMlResult({
          type: 'success',
          message: `Recalculation started! Scored ${data.scored} networks using hybrid gated formula.`,
        });
        await loadMLStatus();
      } else {
        setMlResult({
          type: 'error',
          message: data.error || 'Scoring failed',
        });
      }
    } catch (err: any) {
      setMlResult({ type: 'error', message: `Network error: ${err.message}` });
    } finally {
      setMlLoading(false);
    }
  };

  return {
    mlStatus,
    mlLoading,
    mlResult,
    loadMLStatus,
    trainModel,
    recalculateScores,
  };
};
