import { useCallback, useState } from 'react';
import { wigleApi } from '../../api/wigleApi';
import { logDebug } from '../../logging/clientLogger';

export type WigleKmlRow = {
  id: number;
  bssid: string | null;
  ssid: string | null;
  network_id: string | null;
  name: string | null;
  network_type: string | null;
  observed_at: string | null;
  accuracy_m: number | null;
  signal_dbm: number | null;
  source_file: string | null;
  folder_name: string | null;
  latitude: number;
  longitude: number;
};

interface UseWigleKmlDataParams {
  limit: number | null;
  offset: number;
  adaptedFilters: {
    filtersForPage: any;
    enabledForPage: any;
  };
  enabled: boolean;
}

export function useWigleKmlData({ limit, offset, adaptedFilters, enabled }: UseWigleKmlDataParams) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<WigleKmlRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPoints = useCallback(async () => {
    if (!enabled) return;

    logDebug('[WiGLE/KML] Fetch triggered');
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ include_total: '1' });
      if (limit !== null) params.set('limit', String(limit));
      if (offset > 0) params.set('offset', String(offset));

      const { filtersForPage, enabledForPage } = adaptedFilters;
      params.set('filters', JSON.stringify(filtersForPage));
      params.set('enabled', JSON.stringify(enabledForPage));

      const payload = await wigleApi.getKmlPoints(params);
      setRows(payload.data || []);
      setTotal(typeof payload.total === 'number' ? payload.total : null);
    } catch (err: any) {
      setError(err.message || 'Failed to load KML points');
    } finally {
      setLoading(false);
    }
  }, [adaptedFilters, enabled, limit, offset]);

  return {
    loading,
    rows,
    total,
    error,
    fetchPoints,
  };
}
