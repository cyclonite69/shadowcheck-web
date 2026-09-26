import { useState, useEffect } from 'react';
import { loadScript, loadCss } from '../components/kepler/utils';
import { logError } from '../logging/clientLogger';
import { NetworkData } from '../components/kepler/types';

interface UseKeplerAssetsOptions {
  mapboxToken: string;
  networkData: NetworkData[];
  initDeck: (token: string, data: NetworkData[]) => void;
}

export function useKeplerAssets({ mapboxToken, networkData, initDeck }: UseKeplerAssetsOptions) {
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [scriptsLoaded, setScriptsLoaded] = useState(
    () => typeof window !== 'undefined' && Boolean(window.deck && window.mapboxgl)
  );

  useEffect(() => {
    let cancelled = false;
    if (scriptsLoaded) {
      return;
    }
    if (typeof window !== 'undefined' && window.deck && window.mapboxgl) {
      setScriptsLoaded(true);
      return;
    }
    const loadAssets = async () => {
      try {
        await Promise.all([
          loadCss('https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.css'),
          loadScript('https://cdn.jsdelivr.net/npm/deck.gl@latest/dist.min.js'),
          loadScript('https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.js'),
        ]);
        if (cancelled) {
          return;
        }
        setScriptsLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setScriptError('Failed to load map engine.');
          logError('DeckGL scripts fail', err);
        }
      }
    };
    loadAssets();
    return () => {
      cancelled = true;
    };
  }, [scriptsLoaded]);

  useEffect(() => {
    if (scriptsLoaded && mapboxToken && networkData.length > 0) {
      initDeck(mapboxToken, networkData);
    }
  }, [scriptsLoaded, mapboxToken, networkData, initDeck]);

  return { scriptsLoaded, scriptError };
}
