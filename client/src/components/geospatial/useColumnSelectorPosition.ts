import { useLayoutEffect, useState } from 'react';

export type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export const useColumnSelectorPosition = (
  visible: boolean,
  anchorRef: React.RefObject<HTMLDivElement | null>
) => {
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    top: 44,
    left: 12,
    width: 280,
    maxHeight: 400,
  });

  useLayoutEffect(() => {
    if (!visible) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openAbove = spaceBelow < 260 && spaceAbove > spaceBelow;
      const availableHeight = openAbove ? spaceAbove : spaceBelow;
      const preferredWidth = Math.min(320, Math.max(240, rect.width + 80));
      const maxLeft = Math.max(margin, viewportWidth - preferredWidth - margin);
      const left = Math.min(Math.max(margin, rect.right - preferredWidth), maxLeft);
      const maxHeight = Math.min(420, Math.max(220, availableHeight));
      const top = openAbove
        ? Math.max(margin, rect.top - maxHeight - margin)
        : rect.bottom + margin;

      setMenuPosition({
        top,
        left,
        width: preferredWidth,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [visible, anchorRef]);

  return menuPosition;
};
