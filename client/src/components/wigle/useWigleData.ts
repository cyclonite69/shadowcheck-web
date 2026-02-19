import { useState, useCallback } from 'react';
import { wigleApi } from '../../api/wigleApi';
import { logDebug } from '../../logging/clientLogger';
import type { WigleRow } from '../../utils/wigle';

interface UseWigleDataParams {
  limit: number | null;
  offset: number;
  typeFilter: string;
  adaptedFilters: {
    filtersForPage: any;
    enabledForPage: any;
  };
  v2Enabled: boolean;
  v3Enabled: boolean;
}

export const useWigleData = ({
  limit,
  offset,
  typeFilter,
  adaptedFilters,
  v2Enabled,
  v3Enabled,
}: UseWigleDataParams) => {
  const [v2Loading, setV2Loading] = useState(false);
  const [v3Loading, setV3Loading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [v2Rows, setV2Rows] = useState<WigleRow[]>([]);
  const [v3Rows, setV3Rows] = useState<WigleRow[]>([]);
  const [v2Total, setV2Total] = useState<number | null>(null);
  const [v3Total, setV3Total] = useState<number | null>(null);

  const fetchPoints = useCallback(async () => {
    logDebug('[WiGLE] Fetch triggered');
    setError(null);

    const params = new URLSearchParams({ include_total: '1' });
    if (limit !== null) params.set('limit', String(limit));
    if (offset > 0) params.set('offset', String(offset));
    if (typeFilter.trim()) params.set('type', typeFilter.trim());
    const { filtersForPage, enabledForPage } = adaptedFilters;
    params.set('filters', JSON.stringify(filtersForPage));
    params.set('enabled', JSON.stringify(enabledForPage));

    const doFetch = async (endpoint: string) => {
      const payload = await wigleApi.searchLocalWigle(endpoint, params);
      const rows =
        payload.data?.map((row: any) => ({
          ...row,
          accuracy: row.accuracy || row.acc || null,
        })) || [];
      return { rows, total: typeof payload.total === 'number' ? payload.total : null };
    };

    // Fetch enabled sources in parallel
    const promises: Promise<void>[] = [];

    if (v2Enabled) {
      setV2Loading(true);
      promises.push(
        doFetch('/api/wigle/networks-v2')
          .then(({ rows, total }) => {
            setV2Rows(rows);
            setV2Total(total);
          })
          .catch((err) => setError(err.message || 'Failed to load v2 points'))
          .finally(() => setV2Loading(false))
      );
    }

    if (v3Enabled) {
      setV3Loading(true);
      promises.push(
        doFetch('/api/wigle/networks-v3')
          .then(({ rows, total }) => {
            setV3Rows(rows);
            setV3Total(total);
          })
          .catch((err) => setError(err.message || 'Failed to load v3 points'))
          .finally(() => setV3Loading(false))
      );
    }

    if (promises.length === 0) return;

    await Promise.all(promises);
  }, [limit, offset, typeFilter, adaptedFilters, v2Enabled, v3Enabled]);

  return {
    v2Loading,
    v3Loading,
    error,
    v2Rows,
    v3Rows,
    v2Total,
    v3Total,
    fetchPoints,
  };
};
