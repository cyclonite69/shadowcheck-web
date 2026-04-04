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
  const effectiveMenuHeight = Math.min(menuHeight, Math.max(viewportHeight - padding * 2, 0));
  const spaceBelow = Math.max(viewportHeight - e.clientY - padding, 0);
  const spaceAbove = Math.max(e.clientY - padding, 0);

  let posX = e.clientX;
  let position: 'below' | 'above' =
    spaceBelow >= effectiveMenuHeight || spaceBelow >= spaceAbove ? 'below' : 'above';
  let posY = position === 'below' ? e.clientY : e.clientY - effectiveMenuHeight;

  if (posX + menuWidth + padding > viewportWidth) {
    posX = viewportWidth - menuWidth - padding;
  }

  if (posX - padding < 0) {
    posX = padding;
  }

  const maxTop = Math.max(viewportHeight - effectiveMenuHeight - padding, padding);
  posY = Math.min(Math.max(posY, padding), maxTop);

  if (posY === padding && spaceAbove > spaceBelow) {
    position = 'above';
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
