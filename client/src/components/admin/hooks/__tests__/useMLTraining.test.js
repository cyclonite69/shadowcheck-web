import { renderHook, act } from '@testing-library/react';
import { useMLTraining } from '../useMLTraining';

// Mock global fetch
global.fetch = jest.fn();

describe('useMLTraining Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default states', () => {
    const { result } = renderHook(() => useMLTraining());

    expect(result.current.mlStatus).toBeNull();
    expect(result.current.mlLoading).toBe(false);
    expect(result.current.mlResult).toBeNull();
  });

  it('should load ML status successfully', async () => {
    const mockStatus = { modelTrained: true, taggedNetworks: [] };
    global.fetch.mockResolvedValueOnce({
      json: async () => mockStatus,
    });

    const { result } = renderHook(() => useMLTraining());

    await act(async () => {
      await result.current.loadMLStatus();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/ml/status');
    expect(result.current.mlStatus).toEqual(mockStatus);
  });

  it('should handle load ML status error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('API Error'));

    const { result } = renderHook(() => useMLTraining());

    await act(async () => {
      await result.current.loadMLStatus();
    });

    // Should set default fallback state
    expect(result.current.mlStatus).toEqual({ modelTrained: false, taggedNetworks: [] });
  });

  it('should handle trainModel success', async () => {
    const mockTrainResponse = {
      ok: true,
      trainingSamples: 100,
      threatCount: 50,
      safeCount: 50,
    };
    const mockStatus = { modelTrained: true, taggedNetworks: [] };

    // Mock train call
    global.fetch.mockResolvedValueOnce({
      json: async () => mockTrainResponse,
    });
    // Mock subsequent status reload
    global.fetch.mockResolvedValueOnce({
      json: async () => mockStatus,
    });

    const { result } = renderHook(() => useMLTraining());

    await act(async () => {
      await result.current.trainModel();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/ml/train', { method: 'POST' });
    expect(result.current.mlResult).toEqual({
      type: 'success',
      message: 'Model trained successfully! 100 samples (50 threats, 50 safe)',
    });
    expect(result.current.mlLoading).toBe(false);
  });

  it('should handle trainModel failure from API', async () => {
    const mockErrorResponse = {
      ok: false,
      error: 'Training failed',
    };

    global.fetch.mockResolvedValueOnce({
      json: async () => mockErrorResponse,
      status: 400,
      statusText: 'Bad Request',
    });

    const { result } = renderHook(() => useMLTraining());

    await act(async () => {
      await result.current.trainModel();
    });

    expect(result.current.mlResult).toEqual({
      type: 'error',
      message: 'Training failed',
    });
    expect(result.current.mlLoading).toBe(false);
  });

  it('should handle network error during training', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network Error'));

    const { result } = renderHook(() => useMLTraining());

    await act(async () => {
      await result.current.trainModel();
    });

    expect(result.current.mlResult).toEqual({
      type: 'error',
      message: 'Network error: Network Error',
    });
    expect(result.current.mlLoading).toBe(false);
  });
});
