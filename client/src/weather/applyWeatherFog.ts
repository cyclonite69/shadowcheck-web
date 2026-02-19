import type { Map, FogSpecification } from 'mapbox-gl';
import type { WeatherClassification } from './weatherFxPolicy';

interface FogPreset {
  color: string;
  'horizon-blend': number;
  range: [number, number];
  'high-color': string;
  'space-color': string;
  'star-intensity': number;
}

const FOG_PRESETS: Record<string, FogPreset> = {
  clear: {
    color: '#ffffff',
    'horizon-blend': 0.1,
    range: [2, 20],
    'high-color': '#245aff',
    'space-color': '#010E21',
    'star-intensity': 0.15,
  },
  cloudy: {
    color: '#d0d0d0',
    'horizon-blend': 0.3,
    range: [1, 15],
    'high-color': '#87ceeb',
    'space-color': '#1a1a2e',
    'star-intensity': 0.05,
  },
  foggy: {
    color: '#c8c8d0',
    'horizon-blend': 0.5,
    range: [0.5, 8],
    'high-color': '#a0a0b0',
    'space-color': '#2a2a3e',
    'star-intensity': 0.0,
  },
  rain: {
    color: '#9fa3a8',
    'horizon-blend': 0.4,
    range: [0.8, 10],
    'high-color': '#5a6a7a',
    'space-color': '#1a2a3a',
    'star-intensity': 0.0,
  },
  snow: {
    color: '#f5f5f5',
    'horizon-blend': 0.6,
    range: [0.5, 6],
    'high-color': '#e8e8f0',
    'space-color': '#0a0a14',
    'star-intensity': 0.0,
  },
};

export function applyFog(map: Map, classification: WeatherClassification): void {
  const preset = FOG_PRESETS[classification.mode] || FOG_PRESETS.clear;
  const intensityFactor = Math.max(0.3, classification.intensity);

  // Intensity modulates fog range: higher intensity = denser (shorter range)
  const rangeMin = preset.range[0] / intensityFactor;
  const rangeMax = preset.range[1] / intensityFactor;

  map.setFog({
    ...preset,
    range: [rangeMin, rangeMax],
  } as FogSpecification);
}

export function clearFog(map: Map): void {
  map.setFog(null as unknown as FogSpecification);
}
