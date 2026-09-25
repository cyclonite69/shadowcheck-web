import { useState } from 'react';
import type { WigleSearchParams } from '../../../types/admin';
import { wigleApi } from '../../../api/wigleApi';

export interface BtSearchParams {
  namelike: string;
  showBt: boolean;
  showBle: boolean;
  mfgrIdMinimum: string;
  mfgrIdMaximum: string;
}

export interface UseWigleBluetoothOptions {
  searchParams: WigleSearchParams;
  refreshRuns: () => Promise<void> | void;
}

export interface UseWigleBluetoothResult {
  btParams: BtSearchParams;
  setBtParams: React.Dispatch<React.SetStateAction<BtSearchParams>>;
  btImportLoading: boolean;
  btImportError: string | null;
  importAllBluetooth: () => Promise<void>;
}

export const useWigleBluetooth = ({
  searchParams,
  refreshRuns,
}: UseWigleBluetoothOptions): UseWigleBluetoothResult => {
  const [btParams, setBtParams] = useState<BtSearchParams>({
    namelike: '',
    showBt: true,
    showBle: true,
    mfgrIdMinimum: '',
    mfgrIdMaximum: '',
  });
  const [btImportLoading, setBtImportLoading] = useState(false);
  const [btImportError, setBtImportError] = useState<string | null>(null);

  const importAllBluetooth = async (): Promise<void> => {
    setBtImportError(null);
    setBtImportLoading(true);
    try {
      const payload: Record<string, unknown> = {
        country: searchParams.country || 'US',
        region: searchParams.region || undefined,
        city: searchParams.city || undefined,
        latrange1: searchParams.latrange1 || undefined,
        latrange2: searchParams.latrange2 || undefined,
        longrange1: searchParams.longrange1 || undefined,
        longrange2: searchParams.longrange2 || undefined,
        showBt: btParams.showBt,
        showBle: btParams.showBle,
      };
      if (btParams.namelike.trim()) {
        payload.namelike = btParams.namelike.trim();
      }
      if (btParams.mfgrIdMinimum.trim()) {
        payload.mfgrIdMinimum = Number(btParams.mfgrIdMinimum);
      }
      if (btParams.mfgrIdMaximum.trim()) {
        payload.mfgrIdMaximum = Number(btParams.mfgrIdMaximum);
      }
      await wigleApi.importAllBluetooth(payload);
      await refreshRuns();
    } catch (err: any) {
      setBtImportError(err?.message || 'BT import failed');
    } finally {
      setBtImportLoading(false);
    }
  };

  return {
    btParams,
    setBtParams,
    btImportLoading,
    btImportError,
    importAllBluetooth,
  };
};
