import { useState, useEffect } from 'react';
import { LAYER_STORAGE_KEY, DEFAULT_LAYERS } from '../../utils/wigle';

export interface WigleLayerState {
  v2: boolean;
  v3: boolean;
  kml: boolean;
  fieldOffices: boolean;
  residentAgencies: boolean;
  federalCourthouses: boolean;
}

function loadLayerState(): WigleLayerState {
  try {
    const stored = localStorage.getItem(LAYER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_LAYERS, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_LAYERS;
}

function saveLayerState(state: WigleLayerState) {
  localStorage.setItem(LAYER_STORAGE_KEY, JSON.stringify(state));
}

export const useWigleLayers = () => {
  const [layers, setLayers] = useState<WigleLayerState>(loadLayerState);

  useEffect(() => {
    saveLayerState(layers);
  }, [layers]);

  const toggleLayer = (key: keyof WigleLayerState) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return { layers, toggleLayer, setLayers };
};
