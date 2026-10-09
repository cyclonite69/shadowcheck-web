import type { Map } from 'mapbox-gl';
import { logDebug, logWarn } from '../../logging/clientLogger';

type StyleReadyCallback = () => void;

export function runWhenStyleReady(
  map: Map,
  reason: string,
  callback: StyleReadyCallback
): (() => void) | undefined {
  const runSafely = () => {
    try {
      callback();
    } catch (error) {
      logWarn(`Map overlay apply failed (${reason})`, error);
    }
  };

  if (map.isStyleLoaded()) {
    runSafely();
    return undefined;
  }

  let complete = false;

  const cleanup = () => {
    map.off('style.load', runIfReady);
    map.off('idle', runIfReady);
  };

  function runIfReady() {
    if (complete || !map.isStyleLoaded()) {
      return;
    }
    complete = true;
    cleanup();
    runSafely();
  }

  map.on('style.load', runIfReady);
  map.on('idle', runIfReady);
  logDebug(`Queued map overlay apply until style is ready (${reason})`);

  return cleanup;
}
