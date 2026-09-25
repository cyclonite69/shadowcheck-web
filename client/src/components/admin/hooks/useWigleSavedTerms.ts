import { useEffect, useState } from 'react';
import { wigleApi } from '../../../api/wigleApi';

export interface SavedTerm {
  id: number;
  term: string;
}

export interface UseWigleSavedTermsOptions {
  ssid: string | undefined;
}

export interface UseWigleSavedTermsResult {
  savedTerms: SavedTerm[];
  ssidDropdownOpen: boolean;
  setSsidDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  saveCurrentSsid: () => Promise<void>;
  deleteSavedTerm: (id: number, e: React.MouseEvent) => Promise<void>;
}

export const useWigleSavedTerms = ({
  ssid,
}: UseWigleSavedTermsOptions): UseWigleSavedTermsResult => {
  const [savedTerms, setSavedTerms] = useState<SavedTerm[]>([]);
  const [ssidDropdownOpen, setSsidDropdownOpen] = useState(false);

  useEffect(() => {
    wigleApi
      .getSavedSsidTerms()
      .then((data: any) => setSavedTerms(data?.terms || []))
      .catch(() => {});
  }, []);

  const saveCurrentSsid = async (): Promise<void> => {
    const term = ssid?.trim() ?? '';
    if (term.length < 3) {
      return;
    }
    try {
      const data = await wigleApi.saveSsidTerm(term);
      if (data?.term) {
        setSavedTerms((prev) => {
          const without = prev.filter((t) => t.id !== data.term.id);
          return [data.term, ...without];
        });
      }
    } catch {
      // Best-effort save; ignore failures
    }
  };

  const deleteSavedTerm = async (id: number, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (!window.confirm('Remove this saved search term?')) {
      return;
    }
    try {
      await wigleApi.deleteSavedSsidTerm(id);
      setSavedTerms((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // Best-effort delete; ignore failures
    }
  };

  return {
    savedTerms,
    ssidDropdownOpen,
    setSsidDropdownOpen,
    saveCurrentSsid,
    deleteSavedTerm,
  };
};
