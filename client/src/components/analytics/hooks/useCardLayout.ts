// ===== FILE: src/components/analytics/hooks/useCardLayout.ts =====
// PURPOSE: Custom hook for managing card layout, drag/drop, and resize functionality
// EXTRACTS: Cards state from lines 209-273, drag state from lines 274-277, drag/drop logic from lines 519-593

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Wifi,
  Signal,
  Lock,
  Clock,
  TrendingUp,
  AlertTriangle,
  BarChartIcon,
} from '../utils/chartConstants';

export interface Card {
  id: number;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
}

export interface UseCardLayoutReturn {
  cards: Card[];
  dragging: number | null;
  resizing: number | null;
  handleMouseDown: (e: React.MouseEvent, cardId: number, mode?: 'move' | 'resize') => void;
}

export const useCardLayout = (): UseCardLayoutReturn => {
  const [cards, setCards] = useState<Card[]>([
    {
      id: 1,
      title: 'Network Types',
      icon: Wifi,
      x: 0,
      y: 60,
      w: 50,
      h: 320,
      type: 'network-types',
    },
    { id: 2, title: 'Signal Strength', icon: Signal, x: 50, y: 60, w: 50, h: 320, type: 'signal' },
    { id: 3, title: 'Security Types', icon: Lock, x: 0, y: 390, w: 50, h: 320, type: 'security' },
    {
      id: 4,
      title: 'Threat Score Distribution',
      icon: AlertTriangle,
      x: 50,
      y: 390,
      w: 50,
      h: 320,
      type: 'threat-distribution',
    },
    {
      id: 5,
      title: 'Temporal Activity',
      icon: Clock,
      x: 0,
      y: 720,
      w: 50,
      h: 320,
      type: 'temporal',
    },
    {
      id: 6,
      title: 'Radio Types Over Time',
      icon: TrendingUp,
      x: 50,
      y: 720,
      w: 50,
      h: 320,
      type: 'radio-time',
    },
    {
      id: 7,
      title: 'Threat Score Trends',
      icon: AlertTriangle,
      x: 0,
      y: 1050,
      w: 50,
      h: 320,
      type: 'threat-trends',
    },
    {
      id: 8,
      title: 'Top WiFi Networks',
      icon: BarChartIcon,
      x: 50,
      y: 1050,
      w: 50,
      h: 320,
      type: 'top-networks',
    },
    {
      id: 9,
      title: 'Threat Severity Counts',
      icon: AlertTriangle,
      x: 0,
      y: 1380,
      w: 50,
      h: 320,
      type: 'severity-counts',
    },
  ]);

  const [dragging, setDragging] = useState<number | null>(null);
  const [resizing, setResizing] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const resizeStartRef = useRef({
    startX: 0,
    startY: 0,
    startWidthPx: 0,
    startHeightPx: 0,
    cardXPercent: 0,
  });

  const handleMouseDown = (
    e: React.MouseEvent,
    cardId: number,
    mode: 'move' | 'resize' = 'move'
  ) => {
    e.preventDefault();
    if (mode === 'move') {
      const card = cards.find((c) => c.id === cardId);
      if (!card) {
        return;
      }
      setDragging(cardId);
      setDragOffset({
        x: e.clientX - (card.x * window.innerWidth) / 100,
        y: e.clientY - card.y,
      });
    } else if (mode === 'resize') {
      const card = cards.find((c) => c.id === cardId);
      if (!card) {
        return;
      }
      resizeStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidthPx: (card.w / 100) * window.innerWidth,
        startHeightPx: card.h,
        cardXPercent: card.x,
      };
      setResizing(cardId);
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging) {
        setCards((prev) =>
          prev.map((card) => {
            if (card.id !== dragging) {
              return card;
            }
            const newX = Math.max(
              0,
              Math.min(100 - card.w, ((e.clientX - dragOffset.x) / window.innerWidth) * 100)
            );
            const newY = Math.max(0, e.clientY - dragOffset.y);
            return { ...card, x: newX, y: newY };
          })
        );
      } else if (resizing) {
        const start = resizeStartRef.current;
        setCards((prev) =>
          prev.map((card) => {
            if (card.id !== resizing) {
              return card;
            }
            const widthPx = Math.max(200, start.startWidthPx + (e.clientX - start.startX));
            const newW = Math.max(
              20,
              Math.min(100 - start.cardXPercent, (widthPx / window.innerWidth) * 100)
            );
            const newH = Math.max(150, start.startHeightPx + (e.clientY - start.startY));
            return { ...card, w: newW, h: newH };
          })
        );
      }
    },
    [dragOffset.x, dragOffset.y, dragging, resizing]
  );

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      setDragging(null);
    }
    if (resizing) {
      setResizing(null);
    }
  }, [dragging, resizing]);

  useEffect(() => {
    if (!dragging && !resizing) {
      return;
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, resizing, handleMouseMove, handleMouseUp]);

  return {
    cards,
    dragging,
    resizing,
    handleMouseDown,
  };
};

// ===== END FILE =====
