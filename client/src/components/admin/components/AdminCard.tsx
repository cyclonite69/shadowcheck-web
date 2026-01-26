import React from 'react';

interface AdminCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  color: string;
  children: React.ReactNode;
}

export const AdminCard: React.FC<AdminCardProps> = ({ icon: Icon, title, color, children }) => (
  <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all">
    <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-br from-white/8 via-white/5 to-transparent" />
    <div className="flex items-center space-x-3 p-4 bg-slate-900/90 border-b border-slate-800/80">
      <div className={`p-2 rounded-lg bg-gradient-to-br ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
    </div>
    <div className="p-5">{children}</div>
  </div>
);
