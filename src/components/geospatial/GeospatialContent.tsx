import React from 'react';

interface GeospatialContentProps {
  filtersOpen: boolean;
  children: React.ReactNode;
}

export const GeospatialContent = ({ filtersOpen, children }: GeospatialContentProps) => {
  return (
    <div className="flex h-screen">
      <div
        className="flex flex-col gap-3 p-3 h-screen flex-1"
        style={{ marginLeft: filtersOpen ? '332px' : 0 }}
      >
        {children}
      </div>
    </div>
  );
};
