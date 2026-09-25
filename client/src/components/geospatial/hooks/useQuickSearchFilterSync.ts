import { useEffect } from 'react';
import { useFilterStore } from '../../../stores/filterStore';

interface UseQuickSearchFilterSyncProps {
  quickSearch: string;
}

export const useQuickSearchFilterSync = ({ quickSearch }: UseQuickSearchFilterSyncProps): void => {
  const setFilter = useFilterStore((state) => state.setFilter);
  const enableFilter = useFilterStore((state) => state.enableFilter);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const raw = quickSearch.trim();
      if (!raw) {
        setFilter('ssid', '');
        setFilter('bssid', '');
        setFilter('manufacturer', '');
        enableFilter('ssid', false);
        enableFilter('bssid', false);
        enableFilter('manufacturer', false);
        return;
      }

      const prefixed = raw.match(/^([sbm]):\s*(.+)$/i);
      let target: 'ssid' | 'bssid' | 'manufacturer' = 'ssid';
      let value = raw;

      if (prefixed) {
        const prefix = prefixed[1].toLowerCase();
        value = prefixed[2].trim();
        if (prefix === 'b') {
          target = 'bssid';
        }
        if (prefix === 'm') {
          target = 'manufacturer';
        }
      } else {
        if (/^([0-9A-Fa-f*]{1,2}:){5}[0-9A-Fa-f*]{1,2}$/.test(raw)) {
          target = 'bssid';
        } else if (/^[0-9a-f]{6}$/i.test(raw)) {
          target = 'manufacturer';
        }
      }

      setFilter('ssid', target === 'ssid' ? value : '');
      setFilter('bssid', target === 'bssid' ? value : '');
      setFilter('manufacturer', target === 'manufacturer' ? value : '');
      enableFilter('ssid', target === 'ssid');
      enableFilter('bssid', target === 'bssid');
      enableFilter('manufacturer', target === 'manufacturer');
    }, 250);
    return () => clearTimeout(timeout);
  }, [quickSearch, setFilter, enableFilter]);
};
