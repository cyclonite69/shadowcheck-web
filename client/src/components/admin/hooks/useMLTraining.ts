import { useState, useEffect } from 'react';
import { MLStatus } from '../types/admin.types';

export const useMLTraining = () => {
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlResult, setMlResult] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const loadMLStatus = async () => {
    try {
      const res = await fetch('/api/ml/status');
      const data = await res.json();
      setMlStatus(data);
    } catch {
      setMlStatus({ modelTrained: false, taggedNetworks: [] });
    }
  };

  const trainModel = async () => {
    setMlLoading(true);
    setMlResult(null);
    try {
      const res = await fetch('/api/ml/train', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setMlResult({
          type: 'success',
          message: `Model trained successfully! ${data.trainingSamples} samples (${data.threatCount} threats, ${data.safeCount} safe). Scoring job started.`,
        });
        await loadMLStatus();
      } else {
        setMlResult({
          type: 'error',
          message: data.error || `HTTP ${res.status}: ${res.statusText}`,
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
      const res = await fetch(`/api/ml/score-all?limit=${limit}`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setMlResult({
          type: 'success',
          message: `Recalculation started! Scored ${data.scored} networks using hybrid gated formula.`,
        });
        await loadMLStatus();
      } else {
        setMlResult({
          type: 'error',
          message: data.error || `HTTP ${res.status}: ${res.statusText}`,
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
