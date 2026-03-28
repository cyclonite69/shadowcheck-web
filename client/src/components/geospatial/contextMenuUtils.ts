import type { MouseEvent as ReactMouseEvent } from 'react';
import type { NetworkRow } from '../../types/network';
import { networkApi } from '../../api/networkApi';

export type ContextMenuPlacement = {
  x: number;
  y: number;
  position: 'above' | 'below';
};

export const calculateContextMenuPlacement = (
  e: Pick<ReactMouseEvent, 'clientX' | 'clientY'>,
  menuWidth = 200,
  menuHeight = 440,
  padding = 10
): ContextMenuPlacement => {
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  let posX = e.clientX;
  let posY = e.clientY;
  let position: 'below' | 'above' = 'below';

  if (posY + menuHeight + padding > viewportHeight) {
    posY = e.clientY - menuHeight;
    position = 'above';
  }

  if (posY < padding) {
    posY = padding;
    position = 'below';
  }

  if (posX + menuWidth + padding > viewportWidth) {
    posX = viewportWidth - menuWidth - padding;
  }

  if (posX - padding < 0) {
    posX = padding;
  }

  return { x: posX, y: posY, position };
};

export const fetchNetworkTagAndNotes = async (bssid: string) => {
  const [tagResult, notesResult] = await Promise.allSettled([
    networkApi.getNetworkTags(bssid),
    networkApi.getNetworkNotes(bssid),
  ]);
  return { tagResult, notesResult };
};
