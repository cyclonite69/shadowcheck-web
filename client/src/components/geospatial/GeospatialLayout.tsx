import React from 'react';
import { FiltersSidebar } from './panels/FiltersSidebar';
import { GeospatialContent } from './GeospatialContent';
import { GeospatialShell } from './GeospatialShell';

interface GeospatialLayoutProps {
  filtersOpen: boolean;
  filterPanel: React.ReactNode;
  content: React.ReactNode;
  overlays: React.ReactNode;
  columnRef?: React.RefObject<HTMLDivElement | null>;
}

export const GeospatialLayout = ({
  filtersOpen,
  filterPanel,
  content,
  overlays,
  columnRef,
}: GeospatialLayoutProps) => {
  return (
    <GeospatialShell>
      <FiltersSidebar open={filtersOpen}>{filterPanel}</FiltersSidebar>
      <GeospatialContent columnRef={columnRef}>{content}</GeospatialContent>
      {overlays}
    </GeospatialShell>
  );
};
