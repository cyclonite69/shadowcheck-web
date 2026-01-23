import React from 'react';

interface MapHeaderProps {
  title: string;
  toolbar: React.ReactNode;
}

export const MapHeader = ({ title, toolbar }: MapHeaderProps) => {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: '12px 12px 0 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <h2
        style={{
          fontSize: '22px',
          fontWeight: '900',
          margin: 0,
          background: 'linear-gradient(to right, #1e293b, #64748b, #475569, #1e293b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter:
            'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 20px rgba(100, 116, 139, 0.3))',
          letterSpacing: '-0.5px',
        }}
      >
        {title}
      </h2>
      {toolbar}
    </div>
  );
};
