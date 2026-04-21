/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useMLTraining } from '../useMLTraining';

describe('useMLTraining Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        json: async () => ({}),
      } as Response)
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize with default states', () => {
    const { result } = renderHook(() => useMLTraining());

    expect(result.current.mlStatus).toBeNull();
    expect(result.current.mlLoading).toBe(false);
    expect(result.current.mlResult).toBeNull();
  });

  it('should load ML status successfully', async () => {
    const mockStatus = { modelTrained: true, taggedNetworks: [] };
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => mockStatus,
    });

    const { result } = renderHook(() => useMLTraining());

    await act(async () => {
      await result.current.loadMLStatus();
    });

    expect(fetch).toHaveBeenCalledWith('/api/ml/status');
    expect(result.current.mlStatus).toEqual(mockStatus);
  });

  it('should handle load ML status error', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    const { result } = renderHook(() => useMLTraining());

    await act(async () => {
      await result.current.loadMLStatus();
    });

    // Should set default status on error
    expect(result.current.mlStatus).toEqual({ modelTrained: false, taggedNetworks: [] });
  });

  it('should handle trainModel success', async () => {
    const mockTrainResult = {
      ok: true,
      model: { accuracy: 0.95 },
      message: 'Training successful',
    };

    // Mock the training API call
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => mockTrainResult,
    });
    // Mock the status reload call
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ modelTrained: true, taggedNetworks: [] }),
    });

    const { result } = renderHook(() => useMLTraining());

    await act(async () => {
      await result.current.trainModel();
    });

    expect(fetch).toHaveBeenCalledWith('/api/ml/train', { method: 'POST' });
    expect(result.current.mlResult).toEqual({
      success: true,
      data: mockTrainResult,
    });
    expect(result.current.mlLoading).toBe(false);
  });

  it('should handle trainModel failure from API', async () => {
    const mockErrorResult = {
      ok: false,
      error: 'Insufficient training data',
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => mockErrorResult,
    });

    const { result } = renderHook(() => useMLTraining());

    await act(async () => {
      await result.current.trainModel();
    });

    expect(result.current.mlResult).toEqual({
      success: false,
      error: 'Insufficient training data',
    });
    expect(result.current.mlLoading).toBe(false);
  });

  it('should handle network error during training', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

    const { result } = renderHook(() => useMLTraining());

    await act(async () => {
      await result.current.trainModel();
    });

    expect(result.current.mlResult).toEqual({
      success: false,
      error: 'Network Error',
    });
    expect(result.current.mlLoading).toBe(false);
  });
});
