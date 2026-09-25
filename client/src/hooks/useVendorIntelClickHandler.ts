import { useEffect } from 'react';
import { emitVendorIntel } from '../components/vendor-intel/VendorIntelDrawer';

/**
 * Listens for clicks on [data-vendor-intel] buttons injected into tooltip HTML strings.
 * Since tooltips are raw HTML (not React), we use event delegation on document.
 * Mount this hook once at the app root level.
 */
export function useVendorIntelClickHandler(): void {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-vendor-intel]') as HTMLElement | null;
      if (!target) {
        return;
      }
      const surveillanceType = target.getAttribute('data-vendor-intel');
      if (surveillanceType) {
        e.stopPropagation();
        emitVendorIntel(surveillanceType);
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);
}
