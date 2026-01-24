import React from 'react';

interface GeospatialShellProps {
  children: React.ReactNode;
}

export const GeospatialShell = ({ children }: GeospatialShellProps) => {
  return (
    <div
      className="relative w-full min-h-screen overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 20% 20%, rgba(52, 211, 153, 0.06), transparent 25%), radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.06), transparent 20%), linear-gradient(135deg, #0a1525 0%, #0d1c31 40%, #0a1424 100%)',
      }}
    >
      {children}
    </div>
  );
};
