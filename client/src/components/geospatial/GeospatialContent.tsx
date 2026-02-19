import React from 'react';

interface GeospatialContentProps {
  children: React.ReactNode;
}

export const GeospatialContent = ({ children }: GeospatialContentProps) => {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="flex flex-col gap-1 h-screen flex-1 w-full">{children}</div>
    </div>
  );
};
