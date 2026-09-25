import { useState, useMemo, useCallback } from 'react';
import type { ColumnBadgeConfig, BadgePreset } from '../../types/badgeConfig';
import { BADGE_DEFAULTS } from './badgeDefaults';

export const BADGE_COLUMN_CONFIGS_STORAGE_KEY = 'shadowcheck.badgeStudio.columnConfigs.v1';
const LEGACY_LS_KEY_CONFIGS = 'shadowcheck_badge_column_configs';
const LS_KEY_PRESET = 'shadowcheck_badge_active_preset';
const LS_KEY_PRESETS = 'shadowcheck_badge_presets';

type BadgeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getBrowserStorage(): BadgeStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function readLocalStorage<T>(key: string): T | null {
  try {
    const storage = getBrowserStorage();
    if (!storage) {
      return null;
    }
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: unknown): void {
  try {
    const storage = getBrowserStorage();
    if (!storage) {
      return;
    }
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function readStoredColumnBadgeConfigs(
  storage: BadgeStorage | null = getBrowserStorage()
): Record<string, ColumnBadgeConfig> {
  try {
    if (!storage) {
      return {};
    }
    const raw = storage.getItem(BADGE_COLUMN_CONFIGS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as Record<string, ColumnBadgeConfig>;
    }

    const legacyRaw = storage.getItem(LEGACY_LS_KEY_CONFIGS);
    if (!legacyRaw) {
      return {};
    }

    const migrated = JSON.parse(legacyRaw) as Record<string, ColumnBadgeConfig>;
    storage.setItem(BADGE_COLUMN_CONFIGS_STORAGE_KEY, JSON.stringify(migrated));
    storage.removeItem(LEGACY_LS_KEY_CONFIGS);
    return migrated;
  } catch {
    return {};
  }
}

export function writeStoredColumnBadgeConfigs(
  configs: Record<string, ColumnBadgeConfig>,
  storage: Pick<Storage, 'setItem'> | null = getBrowserStorage()
): void {
  if (!storage) {
    return;
  }
  storage.setItem(BADGE_COLUMN_CONFIGS_STORAGE_KEY, JSON.stringify(configs));
}

export function removeStoredColumnBadgeConfig(
  configs: Record<string, ColumnBadgeConfig>,
  column: string
): Record<string, ColumnBadgeConfig> {
  const next = { ...configs };
  delete next[column];
  return next;
}

export function createFallbackBadgeConfig(column: string): ColumnBadgeConfig {
  return {
    column,
    enabled: false,
    shape: 'pill',
    fill: 'ghost',
    size: 'compact',
    defaultColor: { accentColor: '#64748b' },
    rules: [{ match: { type: 'any' }, color: { accentColor: '#64748b' } }],
    showRawValueAsTooltip: true,
  };
}

export function getActiveBadgeConfigs(
  configs: Record<string, ColumnBadgeConfig>,
  badgeStudioEnabled: boolean
): Record<string, ColumnBadgeConfig> | undefined {
  return badgeStudioEnabled ? configs : undefined;
}

/**
 * Merge order (last wins): BADGE_DEFAULTS → active preset columns → unsaved per-column overrides.
 * All configs start with enabled: false — nothing renders until the user opts in.
 */
export function useBadgeConfigs(): {
  configs: Record<string, ColumnBadgeConfig>;
  presets: BadgePreset[];
  activePresetId: string | null;
  updateColumnConfig: (column: string, cfg: ColumnBadgeConfig) => void;
  resetColumnConfig: (column: string) => void;
  activatePreset: (id: string | null) => void;
  saveAsPreset: (name: string, description?: string) => BadgePreset;
  deletePreset: (id: string) => void;
} {
  const [unsaved, setUnsaved] = useState<Record<string, ColumnBadgeConfig>>(() =>
    readStoredColumnBadgeConfigs()
  );

  const [presets, setPresets] = useState<BadgePreset[]>(
    () => readLocalStorage<BadgePreset[]>(LS_KEY_PRESETS) ?? []
  );

  const [activePresetId, setActivePresetId] = useState<string | null>(() =>
    readLocalStorage<string>(LS_KEY_PRESET)
  );

  const configs = useMemo<Record<string, ColumnBadgeConfig>>(() => {
    const base: Record<string, ColumnBadgeConfig> = { ...BADGE_DEFAULTS };

    // Apply active preset columns
    const activePreset = presets.find((p) => p.id === activePresetId);
    if (activePreset) {
      for (const cfg of activePreset.columns) {
        base[cfg.column] = cfg;
      }
    }

    // Apply unsaved per-column overrides
    for (const [col, cfg] of Object.entries(unsaved)) {
      base[col] = cfg;
    }

    return base;
  }, [unsaved, presets, activePresetId]);

  const updateColumnConfig = useCallback((column: string, cfg: ColumnBadgeConfig) => {
    setUnsaved((prev) => {
      const next = { ...prev, [column]: cfg };
      writeStoredColumnBadgeConfigs(next);
      return next;
    });
  }, []);

  const resetColumnConfig = useCallback((column: string) => {
    setUnsaved((prev) => {
      const next = removeStoredColumnBadgeConfig(prev, column);
      writeStoredColumnBadgeConfigs(next);
      return next;
    });
  }, []);

  const activatePreset = useCallback((id: string | null) => {
    setActivePresetId(id);
    writeLocalStorage(LS_KEY_PRESET, id);
  }, []);

  const saveAsPreset = useCallback(
    (name: string, description?: string): BadgePreset => {
      const now = new Date().toISOString();
      const preset: BadgePreset = {
        id: `preset_${Date.now()}`,
        name,
        description,
        columns: Object.values(configs),
        createdAt: now,
        updatedAt: now,
      };
      setPresets((prev) => {
        const next = [...prev, preset];
        writeLocalStorage(LS_KEY_PRESETS, next);
        return next;
      });
      return preset;
    },
    [configs]
  );

  const deletePreset = useCallback(
    (id: string) => {
      setPresets((prev) => {
        const next = prev.filter((p) => p.id !== id);
        writeLocalStorage(LS_KEY_PRESETS, next);
        return next;
      });
      if (activePresetId === id) {
        setActivePresetId(null);
        writeLocalStorage(LS_KEY_PRESET, null);
      }
    },
    [activePresetId]
  );

  return {
    configs,
    presets,
    activePresetId,
    updateColumnConfig,
    resetColumnConfig,
    activatePreset,
    saveAsPreset,
    deletePreset,
  };
}
