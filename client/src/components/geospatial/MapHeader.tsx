import React from 'react';

interface MapHeaderProps {
  title: string;
  toolbar: React.ReactNode;
}

export const MapHeader = ({ toolbar }: MapHeaderProps) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '48px',
        padding: '0 14px',
        gap: 0,
        background: 'var(--nav-bg)',
        borderBottom: '0.5px solid var(--nav-border)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {toolbar}
    </div>
  );
};
