import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeRenderer,
  useBadgeConfigs,
  BADGE_DEFAULTS,
  BADGE_PREVIEW_SAMPLES,
} from '../../badgeStudio';
import { createFallbackBadgeConfig } from '../../badgeStudio/useBadgeConfigs';
import { SEMANTIC_PALETTE } from '../../badgeStudio/palette';
import { NETWORK_COLUMNS, type NetworkColumnConfig } from '../../../constants/network';
import type {
  BadgeColorRule,
  BadgeFill,
  BadgeShape,
  BadgeSize,
  ColumnBadgeConfig,
} from '../../../types/badgeConfig';

const SHAPES: BadgeShape[] = ['pill', 'chip', 'tag', 'square', 'dot-label', 'icon-only'];
const FILLS: BadgeFill[] = ['ghost', 'outlined', 'solid', 'text-only'];
const SIZES: BadgeSize[] = ['compact', 'normal', 'prominent'];

type ColorMode = 'static' | 'rules';

function cloneConfig(config: ColumnBadgeConfig): ColumnBadgeConfig {
  return {
    ...config,
    defaultColor: { ...config.defaultColor },
    rules: config.rules.map((rule) => ({ ...rule, color: { ...rule.color } })),
  };
}

function getColumnConfig(column: string, configs: Record<string, ColumnBadgeConfig>) {
  return cloneConfig(configs[column] ?? createFallbackBadgeConfig(column));
}

function getColumnSamples(column: string): unknown[] {
  if (BADGE_PREVIEW_SAMPLES[column]) {
    return BADGE_PREVIEW_SAMPLES[column];
  }
  if (column.toLowerCase().includes('score')) {
    return [95, 72, 44, 12];
  }
  if (column.toLowerCase().includes('count')) {
    return [0, 1, 7, 24];
  }
  if (column.toLowerCase().includes('lat')) {
    return [42.9904, 37.7749];
  }
  if (column.toLowerCase().includes('lon')) {
    return [-83.6975, -122.4194];
  }
  return ['Sample', 'Unknown', 'None'];
}

function describeRule(rule: BadgeColorRule): string {
  const { match } = rule;
  if (match.type === 'any') {
    return 'Any value';
  }
  if (match.type === 'exact') {
    return `Equals ${String(match.value)}`;
  }
  if (match.type === 'contains') {
    return `Contains ${match.value}`;
  }
  if (match.type === 'regex') {
    return `Regex ${match.pattern}`;
  }
  const bounds = [
    match.min !== null && match.min !== undefined ? `min ${match.min}` : '',
    match.max !== null && match.max !== undefined ? `max ${match.max}` : '',
  ]
    .filter(Boolean)
    .join(' / ');
  return bounds || 'Numeric range';
}

function updateRule(
  config: ColumnBadgeConfig,
  index: number,
  patch: Partial<BadgeColorRule>
): ColumnBadgeConfig {
  return {
    ...config,
    rules: config.rules.map((rule, ruleIndex) =>
      ruleIndex === index
        ? {
            ...rule,
            ...patch,
            color: patch.color ? { ...patch.color } : rule.color,
          }
        : rule
    ),
  };
}

/**
 * Admin tab for Badge Studio — real per-column badge configuration for Explorer cells.
 * Gated by the badgeStudio runtime feature flag.
 */
export const BadgeStudioTab: React.FC = () => {
  const { configs, updateColumnConfig, resetColumnConfig } = useBadgeConfigs();

  const columns = useMemo(
    () =>
      (Object.entries(NETWORK_COLUMNS) as Array<[string, NetworkColumnConfig | undefined]>)
        .filter((entry): entry is [string, NetworkColumnConfig] =>
          Boolean(entry[1] && entry[0] !== 'select')
        )
        .map(([column, config]) => ({
          key: column,
          label: config.label,
          hasPreset: Boolean(BADGE_DEFAULTS[column]),
          enabled: Boolean(configs[column]?.enabled),
        })),
    [configs]
  );

  const [selectedColumn, setSelectedColumn] = useState(columns[0]?.key ?? 'type');
  const [draft, setDraft] = useState<ColumnBadgeConfig>(() => getColumnConfig('type', configs));
  const [colorMode, setColorMode] = useState<ColorMode>(
    draft.rules.length > 1 || draft.rules[0]?.match.type !== 'any' ? 'rules' : 'static'
  );

  useEffect(() => {
    if (!columns.some((column) => column.key === selectedColumn) && columns[0]) {
      setSelectedColumn(columns[0].key);
    }
  }, [columns, selectedColumn]);

  useEffect(() => {
    const next = getColumnConfig(selectedColumn, configs);
    setDraft(next);
    setColorMode(next.rules.length > 1 || next.rules[0]?.match.type !== 'any' ? 'rules' : 'static');
  }, [configs, selectedColumn]);

  const selectedColumnLabel =
    columns.find((column) => column.key === selectedColumn)?.label ?? selectedColumn;
  const samples = getColumnSamples(selectedColumn);

  const updateDraft = (patch: Partial<ColumnBadgeConfig>) => {
    setDraft((current) => ({ ...current, ...patch, column: selectedColumn }));
  };

  const saveDraft = () => {
    updateColumnConfig(selectedColumn, { ...draft, column: selectedColumn });
  };

  const applySmartPreset = () => {
    const preset = BADGE_DEFAULTS[selectedColumn];
    if (!preset) {
      return;
    }
    const next = cloneConfig({ ...preset, enabled: true });
    setDraft(next);
    setColorMode(next.rules.length > 1 ? 'rules' : 'static');
    updateColumnConfig(selectedColumn, next);
  };

  const disableColumn = () => {
    const next = { ...draft, enabled: false, column: selectedColumn };
    setDraft(next);
    updateColumnConfig(selectedColumn, next);
  };

  const resetColumn = () => {
    resetColumnConfig(selectedColumn);
    const next = cloneConfig(
      BADGE_DEFAULTS[selectedColumn] ?? createFallbackBadgeConfig(selectedColumn)
    );
    setDraft(next);
    setColorMode(next.rules.length > 1 ? 'rules' : 'static');
  };

  const setStaticColor = (accentColor: string) => {
    const next = {
      ...draft,
      defaultColor: { ...draft.defaultColor, accentColor },
      rules:
        colorMode === 'static'
          ? [{ match: { type: 'any' as const }, color: { accentColor } }]
          : draft.rules,
    };
    setDraft(next);
  };

  const setMode = (mode: ColorMode) => {
    setColorMode(mode);
    if (mode === 'static') {
      setDraft((current) => ({
        ...current,
        rules: [
          { match: { type: 'any' }, color: { accentColor: current.defaultColor.accentColor } },
        ],
      }));
      return;
    }
    const preset = BADGE_DEFAULTS[selectedColumn];
    if (preset) {
      setDraft((current) => ({
        ...cloneConfig(preset),
        enabled: current.enabled,
        shape: current.shape,
        fill: current.fill,
        size: current.size,
      }));
    }
  };

  return (
    <div className="px-6 py-4 text-slate-200">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Badge Studio</h2>
          <p className="mt-1 text-sm text-slate-400">
            Configure optional badge rendering for Explorer columns. Sorting, filtering, and export
            continue to use raw cell values.
          </p>
        </div>
        <div className="rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">
          {columns.filter((column) => column.enabled).length} active badges
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-lg border border-slate-700/70 bg-slate-950/60">
          <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Explorer columns
          </div>
          <div className="max-h-[620px] overflow-y-auto p-2">
            {columns.map((column) => (
              <button
                key={column.key}
                type="button"
                onClick={() => setSelectedColumn(column.key)}
                className={`mb-1 flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition ${
                  selectedColumn === column.key
                    ? 'bg-blue-500/15 text-blue-200'
                    : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{column.label}</span>
                  <span className="block truncate text-xs text-slate-500">{column.key}</span>
                </span>
                <span
                  className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] ${
                    column.enabled
                      ? 'border-green-500/40 bg-green-500/10 text-green-300'
                      : 'border-slate-700 bg-slate-900 text-slate-500'
                  }`}
                >
                  {column.enabled ? 'badge' : column.hasPreset ? 'preset' : 'raw'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">{selectedColumnLabel}</h3>
                <p className="text-xs text-slate-500">{selectedColumn}</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) => updateDraft({ enabled: event.target.checked })}
                />
                Enabled
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1 text-xs text-slate-400">
                Shape
                <select
                  value={draft.shape}
                  onChange={(event) => updateDraft({ shape: event.target.value as BadgeShape })}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                >
                  {SHAPES.map((shape) => (
                    <option key={shape} value={shape}>
                      {shape}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs text-slate-400">
                Fill
                <select
                  value={draft.fill}
                  onChange={(event) => updateDraft({ fill: event.target.value as BadgeFill })}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                >
                  {FILLS.map((fill) => (
                    <option key={fill} value={fill}>
                      {fill}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs text-slate-400">
                Size
                <select
                  value={draft.size}
                  onChange={(event) => updateDraft({ size: event.target.value as BadgeSize })}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                >
                  {SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Color behavior</h3>
              <div className="flex rounded border border-slate-700 bg-slate-900 p-0.5 text-xs">
                {(['static', 'rules'] as ColorMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setMode(mode)}
                    className={`rounded px-3 py-1 ${
                      colorMode === mode ? 'bg-blue-500/20 text-blue-200' : 'text-slate-500'
                    }`}
                  >
                    {mode === 'static' ? 'Static' : 'Mapped rules'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {SEMANTIC_PALETTE.slice(0, 18).map((color) => (
                <button
                  key={color.token}
                  type="button"
                  onClick={() => setStaticColor(color.accent)}
                  className="h-7 w-7 rounded border border-slate-700"
                  style={{ background: color.accent }}
                  title={color.name}
                />
              ))}
              <input
                type="color"
                value={draft.defaultColor.accentColor}
                onChange={(event) => setStaticColor(event.target.value)}
                className="h-7 w-10 rounded border border-slate-700 bg-slate-900"
                title="Custom static color"
              />
            </div>

            {colorMode === 'rules' && (
              <div className="space-y-2">
                {draft.rules.map((rule, index) => (
                  <div
                    key={`${describeRule(rule)}-${index}`}
                    className="grid gap-2 rounded border border-slate-800 bg-slate-900/50 p-2 md:grid-cols-[1fr_120px_90px]"
                  >
                    <div>
                      <div className="text-xs text-slate-500">{describeRule(rule)}</div>
                      <input
                        value={rule.label ?? ''}
                        onChange={(event) =>
                          setDraft((current) =>
                            updateRule(current, index, {
                              label: event.target.value.trim() || undefined,
                            })
                          )
                        }
                        placeholder="Optional label"
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                      />
                    </div>
                    <input
                      type="color"
                      value={rule.color.accentColor}
                      onChange={(event) =>
                        setDraft((current) =>
                          updateRule(current, index, {
                            color: { ...rule.color, accentColor: event.target.value },
                          })
                        )
                      }
                      className="h-8 w-full rounded border border-slate-700 bg-slate-900"
                    />
                    <BadgeRenderer value={samples[index % samples.length]} config={draft} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Live preview</h3>
            <div className="flex flex-wrap items-center gap-2">
              {samples.map((sample, index) => (
                <BadgeRenderer key={`${String(sample)}-${index}`} value={sample} config={draft} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveDraft}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Save column config
            </button>
            <button
              type="button"
              onClick={disableColumn}
              className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Disable
            </button>
            <button
              type="button"
              onClick={applySmartPreset}
              disabled={!BADGE_DEFAULTS[selectedColumn]}
              className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply smart preset
            </button>
            <button
              type="button"
              onClick={resetColumn}
              className="rounded border border-red-900/70 px-4 py-2 text-sm text-red-300 hover:bg-red-950/30"
            >
              Reset/remove config
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
