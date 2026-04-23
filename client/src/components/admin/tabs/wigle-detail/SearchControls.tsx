import React from 'react';
import { AdminCard } from '../components/AdminCard';

const SearchIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

interface SearchControlsProps {
  netid: string;
  setNetid: (id: string) => void;
  onSearch: (shouldImport: boolean) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
}

export const SearchControls: React.FC<SearchControlsProps> = ({
  netid,
  setNetid,
  onSearch,
  onFileUpload,
  loading,
}) => (
  <AdminCard
    icon={SearchIcon}
    title="Network Detail Lookup (v3)"
    color="from-slate-500 to-slate-600"
  >
    <div className="flex gap-2">
      <input
        type="text"
        value={netid}
        onChange={(e) => setNetid(e.target.value)}
        placeholder="Enter NetID..."
        className="flex-1 rounded-lg bg-slate-950 px-3 py-2 text-sm border border-slate-700"
      />
      <button
        onClick={() => onSearch(false)}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-700"
      >
        Search
      </button>
      <input type="file" onChange={onFileUpload} className="hidden" id="wigle-file-upload" />
      <label
        htmlFor="wigle-file-upload"
        className="cursor-pointer px-4 py-2 bg-slate-700 rounded-lg text-sm hover:bg-slate-600"
      >
        Upload
      </label>
    </div>
  </AdminCard>
);
