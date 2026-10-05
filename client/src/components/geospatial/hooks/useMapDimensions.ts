import { useEffect, useRef } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { SNAP_BUFFER } from '../constants/paneSizing';

interface UseMapDimensionsParams {
  containerRef: RefObject<HTMLDivElement | null>;
  setContainerHeight: Dispatch<SetStateAction<number>>;
  setMapHeight: Dispatch<SetStateAction<number>>;
}

export const useMapDimensions = ({
  containerRef,
  setContainerHeight,
  setMapHeight,
}: UseMapDimensionsParams) => {
  // Tracks whether the initial default split has been set. Using a ref (not
  // state) avoids a re-render and prevents a user-dragged height of exactly
  // 500px from being misidentified as the unset sentinel.
  const initializedRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const update = (height: number) => {
      setContainerHeight(height);
      setMapHeight((prev) => {
        if (!initializedRef.current) {
          // First measurement: apply the legacy default formula so the default
          // split is numerically identical to the old window.innerHeight-based
          // calculation (map takes 75% of height-150 budget).
          initializedRef.current = true;
          return Math.floor((height - 150) * 0.75);
        }
        // On subsequent measurements (window resize): clamp a user-adjusted
        // height down to the new max, but never force a new default split.
        return Math.min(prev, height - SNAP_BUFFER);
      });
    };

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        update(entry.contentRect.height);
      }
    });
    ro.observe(el);
    // Seed immediately; ResizeObserver fires asynchronously on first attach.
    update(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, [containerRef, setContainerHeight, setMapHeight]);
};
