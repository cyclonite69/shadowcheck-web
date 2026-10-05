import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { SNAP_BUFFER } from '../constants/paneSizing';

type MapResizeHandleProps = {
  mapHeight: number;
  containerHeight: number;
  mapRef: MutableRefObject<any>;
  setMapHeight: Dispatch<SetStateAction<number>>;
  setResizing: Dispatch<SetStateAction<boolean>>;
  logDebug: (message: string) => void;
};

export const useMapResizeHandle = ({
  mapHeight,
  containerHeight,
  mapRef,
  setMapHeight,
  setResizing,
  logDebug,
}: MapResizeHandleProps) => {
  return useCallback(
    (e: React.MouseEvent) => {
      logDebug(`Resize handle clicked: ${e.clientY}`);
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);

      const startY = e.clientY;
      const startHeight = mapHeight;

      const handleMouseMove = (event: MouseEvent) => {
        event.preventDefault();
        const deltaY = event.clientY - startY;
        // Lower bound: 150px keeps a minimal sliver of map visible at the top.
        // Upper bound: containerHeight − SNAP_BUFFER seats the handle flush at
        // the viewport bottom with the table card collapsed to 0px.
        // Guard: ensure max >= min on very short windows.
        const dragMin = 150;
        const dragMax = Math.max(dragMin, containerHeight - SNAP_BUFFER);
        const newHeight = Math.max(dragMin, Math.min(dragMax, startHeight + deltaY));
        logDebug(`Resizing to: ${newHeight}`);
        setMapHeight(newHeight);

        // Force map resize if it exists
        if (mapRef.current) {
          setTimeout(() => mapRef.current?.resize(), 0);
        }
      };

      const handleMouseUp = (event: MouseEvent) => {
        logDebug('Resize ended');
        event.preventDefault();
        setResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [containerHeight, logDebug, mapHeight, mapRef, setMapHeight, setResizing]
  );
};
