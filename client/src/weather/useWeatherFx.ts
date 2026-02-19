import { useEffect, useRef, useState } from 'react';
import { logDebug, logWarn } from '../logging/clientLogger';
import { fetchCurrentWeather } from './openMeteoClient';
import { classifyFx } from './weatherFxPolicy';
import { applyFog, clearFog } from './applyWeatherFog';
import { WeatherParticleOverlay } from './WeatherParticleOverlay';

export type WeatherFxMode = 'off' | 'auto' | 'rain' | 'snow';

const STORAGE_KEY = 'shadowcheck_weather_fx';

export function useWeatherFx(
  mapRef: React.MutableRefObject<mapboxgl.Map | null>,
  mapContainerRef: React.RefObject<HTMLDivElement | null>,
  mapReady: boolean
): {
  weatherFxMode: WeatherFxMode;
  setWeatherFxMode: (mode: WeatherFxMode) => void;
} {
  const [weatherFxMode, setWeatherFxMode] = useState<WeatherFxMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as WeatherFxMode) || 'off';
  });

  const overlayRef = useRef<WeatherParticleOverlay | null>(null);
  const moveendListenerRef = useRef<(() => void) | null>(null);

  // Initialize overlay when map is ready
  useEffect(() => {
    if (!mapReady || !mapContainerRef.current) return;

    overlayRef.current = new WeatherParticleOverlay(mapContainerRef.current);

    return () => {
      overlayRef.current?.destroy();
      overlayRef.current = null;
    };
  }, [mapReady, mapContainerRef]);

  // Apply weather FX based on mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    localStorage.setItem(STORAGE_KEY, weatherFxMode);

    if (weatherFxMode === 'off') {
      clearFog(map);
      overlayRef.current?.stop();
      if (moveendListenerRef.current) {
        map.off('moveend', moveendListenerRef.current);
        moveendListenerRef.current = null;
      }
      return;
    }

    if (weatherFxMode === 'auto') {
      // Attach moveend listener for auto updates
      if (!moveendListenerRef.current) {
        moveendListenerRef.current = async () => {
          const center = map.getCenter();
          const weather = await fetchCurrentWeather(center.lat, center.lng);
          if (weather) {
            const classification = classifyFx(weather);
            applyFog(map, classification);
            if (classification.mode === 'rain' || classification.mode === 'snow') {
              overlayRef.current?.start(classification.mode, classification.intensity);
            } else {
              overlayRef.current?.stop();
            }
            logDebug('[Weather FX] Auto:', { classification, center });
          } else {
            logWarn('[Weather FX] Failed to fetch weather data');
          }
        };
        map.on('moveend', moveendListenerRef.current);
      }
      // Fetch immediately
      (async () => {
        const center = map.getCenter();
        const weather = await fetchCurrentWeather(center.lat, center.lng);
        if (weather) {
          const classification = classifyFx(weather);
          applyFog(map, classification);
          if (classification.mode === 'rain' || classification.mode === 'snow') {
            overlayRef.current?.start(classification.mode, classification.intensity);
          } else {
            overlayRef.current?.stop();
          }
          logDebug('[Weather FX] Auto (init):', { classification, center });
        }
      })();
    }

    if (weatherFxMode === 'rain') {
      applyFog(map, { mode: 'rain', intensity: 0.6 });
      overlayRef.current?.start('rain', 0.6);
      if (moveendListenerRef.current) {
        map.off('moveend', moveendListenerRef.current);
        moveendListenerRef.current = null;
      }
    }

    if (weatherFxMode === 'snow') {
      applyFog(map, { mode: 'snow', intensity: 0.6 });
      overlayRef.current?.start('snow', 0.6);
      if (moveendListenerRef.current) {
        map.off('moveend', moveendListenerRef.current);
        moveendListenerRef.current = null;
      }
    }

    // Re-apply fog after style loads
    const styleLoadHandler = () => {
      if (weatherFxMode === 'auto') {
        const center = map.getCenter();
        (async () => {
          const weather = await fetchCurrentWeather(center.lat, center.lng);
          if (weather) {
            const classification = classifyFx(weather);
            applyFog(map, classification);
          }
        })();
      } else {
        const intensity = weatherFxMode === 'rain' || weatherFxMode === 'snow' ? 0.6 : 1.0;
        applyFog(map, { mode: weatherFxMode as any, intensity });
      }
    };
    map.on('style.load', styleLoadHandler);

    return () => {
      map.off('style.load', styleLoadHandler);
    };
  }, [weatherFxMode, mapReady, mapRef]);

  return { weatherFxMode, setWeatherFxMode };
}
