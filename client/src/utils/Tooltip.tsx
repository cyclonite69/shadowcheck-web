import React, { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  delay?: number;
  maxWidth?: string;
  side?: 'top' | 'bottom';
}

/**
 * Lightweight tooltip component with portal positioning
 * Displays full content on hover for truncated fields
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  delay = 300,
  maxWidth = '300px',
  side = 'top',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: side === 'top' ? rect.top : rect.bottom,
      });
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!isVisible) {
    return (
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'contents' }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ display: 'contents' }}
    >
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              transform: `translate(-50%, ${side === 'top' ? '-100%' : '0'}) translateY(${side === 'top' ? '-8px' : '8px'})`,
              zIndex: 50,
              pointerEvents: 'none',
              maxWidth,
              backgroundColor: '#0f172a',
              color: '#f1f5f9',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              lineHeight: '1.4',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
              border: '1px solid #334155',
              wordBreak: 'break-word',
              whiteSpace: 'normal',
            }}
            role="tooltip"
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
};
