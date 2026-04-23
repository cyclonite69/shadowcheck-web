import React from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
}

export const ConfigSectionHeader: React.FC<SectionHeaderProps> = ({ title, description }) => (
  <div className="mb-4">
    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h3>
    {description && <p className="mt-0.5 text-[11px] text-slate-600">{description}</p>}
  </div>
);
