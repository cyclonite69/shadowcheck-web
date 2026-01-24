import React from 'react';
import { FiltersSidebar } from './FiltersSidebar';
import { GeospatialContent } from './GeospatialContent';
import { GeospatialShell } from './GeospatialShell';

interface GeospatialLayoutProps {
  filtersOpen: boolean;
  filterPanel: React.ReactNode;
  content: React.ReactNode;
  overlays: React.ReactNode;
}

export const GeospatialLayout = ({
  filtersOpen,
  filterPanel,
  content,
  overlays,
}: GeospatialLayoutProps) => {
  return (
    <GeospatialShell>
      <FiltersSidebar open={filtersOpen}>{filterPanel}</FiltersSidebar>
      <GeospatialContent filtersOpen={filtersOpen}>{content}</GeospatialContent>
      {overlays}
    </GeospatialShell>
  );
};
