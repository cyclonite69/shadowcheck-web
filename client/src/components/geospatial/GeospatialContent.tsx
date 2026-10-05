import React from 'react';

interface GeospatialContentProps {
  children: React.ReactNode;
  columnRef?: React.RefObject<HTMLDivElement | null>;
}

export const GeospatialContent = ({ children, columnRef }: GeospatialContentProps) => {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div ref={columnRef} className="flex flex-col gap-1 h-screen flex-1 w-full">
        {children}
      </div>
    </div>
  );
};
