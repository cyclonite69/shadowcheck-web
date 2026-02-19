import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

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
        const newHeight = Math.max(150, Math.min(containerHeight - 150, startHeight + deltaY));
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
