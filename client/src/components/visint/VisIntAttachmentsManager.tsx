import { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';

interface DuplicateGroup {
  hash: string;
  ids: (number | string)[];
  filenames: string[];
  count: number;
}

export default function VisIntAttachmentsManager() {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDuplicates = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.getDuplicateMediaGroups();
      setDuplicates(result.duplicates || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch duplicates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, []);

  const handleDelete = async (id: number | string) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete media ID ${id}?\n\nThis will remove the media file. If this media is attached to an observation, the observation itself will not be deleted, but it will lose this attachment.`
      )
    ) {
      return;
    }
    try {
      await adminApi.deleteNetworkMedia(id);
      fetchDuplicates();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  if (loading) {
    return <div className="text-white p-4">Loading...</div>;
  }
  if (error) {
    return <div className="text-red-400 p-4">{error}</div>;
  }

  return (
    <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
      <h2 className="text-xl text-white font-bold mb-4">Duplicate Media Manager</h2>

      {duplicates.length === 0 ? (
        <div className="text-slate-400">No duplicates found.</div>
      ) : (
        <div className="space-y-6">
          {duplicates.map((group) => (
            <div
              key={group.hash}
              className="bg-slate-800 p-4 rounded-lg border border-orange-500/50"
            >
              <div className="text-orange-400 font-bold mb-2 flex items-center">
                <span className="mr-2">Duplicate Group ({group.count} copies)</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-orange-900/50 border border-orange-500 text-orange-300 uppercase">
                  Duplicate
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono mb-4 break-all">
                Hash: {group.hash}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.ids.map((id, index) => (
                  <div
                    key={id}
                    className="bg-slate-900 p-3 rounded border border-slate-700 flex flex-col items-center"
                  >
                    <img
                      src={`/api/admin/network-media/${id}/inline?thumbnail=true`}
                      alt={`Media ${id}`}
                      className="h-32 object-contain mb-2 bg-black w-full"
                    />
                    <div className="text-xs text-slate-300 font-mono mb-2">ID: {id}</div>
                    <div
                      className="text-xs text-slate-400 mb-4 truncate w-full text-center"
                      title={group.filenames[index]}
                    >
                      {group.filenames[index]}
                    </div>

                    <button
                      onClick={() => handleDelete(id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded"
                    >
                      Delete Action
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
