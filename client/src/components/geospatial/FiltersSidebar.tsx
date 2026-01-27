import React from 'react';

interface FiltersSidebarProps {
  open: boolean;
  children: React.ReactNode;
}

export const FiltersSidebar = ({ open, children }: FiltersSidebarProps) => {
  if (!open) return null;

  return (
    <div className="fixed top-14 left-3 w-[440px] max-h-[calc(100vh-80px)] z-40 overflow-y-auto rounded-xl bg-slate-900/95 backdrop-blur-xl shadow-2xl pointer-events-auto border border-slate-600/60">
      <div className="p-3 space-y-2 text-xs">{children}</div>
    </div>
  );
};
