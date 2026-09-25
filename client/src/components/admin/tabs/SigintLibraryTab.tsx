import React, { useState, useMemo } from 'react';
import vendorManifest from '../../vendor-intel/vendor_intel_manifest.json';
import type { SourceType, VendorEntry } from '../../vendor-intel/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: 'Tier 1 — Active Intercept', color: '#dc2626', bg: '#dc262612', border: '#dc262640' },
  2: {
    label: 'Tier 2 — Passive Surveillance',
    color: '#f97316',
    bg: '#f9731612',
    border: '#f9731640',
  },
  3: {
    label: 'Tier 3 — Dual-Use / Tactical',
    color: '#eab308',
    bg: '#eab30812',
    border: '#eab30840',
  },
};

const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  SIGINT_INTERCEPT: {
    label: 'SIGINT / Intercept',
    color: '#dc2626',
    bg: '#dc262612',
    border: '#dc262640',
  },
  BODY_CAMERA: { label: 'Body Camera', color: '#3b82f6', bg: '#3b82f612', border: '#3b82f640' },
  CEW_TASER: { label: 'CEW / TASER', color: '#8b5cf6', bg: '#8b5cf612', border: '#8b5cf640' },
  ALPR_CAMERA: { label: 'ALPR Camera', color: '#ef4444', bg: '#ef444412', border: '#ef444440' },
  ACOUSTIC_SENSOR: {
    label: 'Acoustic Sensor',
    color: '#ef4444',
    bg: '#ef444412',
    border: '#ef444440',
  },
  PUBLIC_SAFETY_MOBILE_ROUTER: {
    label: 'Public Safety Router',
    color: '#10b981',
    bg: '#10b98112',
    border: '#10b98140',
  },
  DEFENSE_C4ISR: {
    label: 'Defense / C4ISR',
    color: '#f97316',
    bg: '#f9731612',
    border: '#f9731640',
  },
  DUAL_USE_INFRASTRUCTURE: {
    label: 'Dual-use Infrastructure',
    color: '#eab308',
    bg: '#eab30812',
    border: '#eab30840',
  },
  DUAL_USE_PENTEST_GEAR: {
    label: 'Pentest / RF Research',
    color: '#f59e0b',
    bg: '#f59e0b12',
    border: '#f59e0b40',
  },
  UNKNOWN_PRIVATE_OUI: {
    label: 'Private / Unknown OUI',
    color: '#6b7280',
    bg: '#6b728012',
    border: '#6b728040',
  },
};

const getCategoryConfig = (entry: VendorEntry) => {
  if (entry.category && CATEGORY_CONFIG[entry.category]) {
    return CATEGORY_CONFIG[entry.category];
  }
  if (entry.threat_tier && TIER_CONFIG[entry.threat_tier]) {
    const t = TIER_CONFIG[entry.threat_tier];
    return { label: t.label, color: t.color, bg: t.bg, border: t.border };
  }
  return CATEGORY_CONFIG.UNKNOWN_PRIVATE_OUI;
};

const SOURCE_CONFIG: Record<
  SourceType,
  { label: string; color: string; bg: string; border: string }
> = {
  leaked: { label: 'LEAKED', color: '#dc2626', bg: '#dc262620', border: '#dc262660' },
  foia: { label: 'FOIA', color: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50' },
  manufacturer: { label: 'MANUFACTURER', color: '#6b7280', bg: '#6b728015', border: '#6b728040' },
  public: { label: 'PUBLIC', color: '#3b82f6', bg: '#3b82f615', border: '#3b82f640' },
  research: { label: 'RESEARCH', color: '#8b5cf6', bg: '#8b5cf615', border: '#8b5cf640' },
  procurement: { label: 'PROCUREMENT', color: '#10b981', bg: '#10b98115', border: '#10b98140' },
  fcc: { label: 'FCC', color: '#06b6d4', bg: '#06b6d415', border: '#06b6d440' },
};

const ALL_SOURCE_TYPES: SourceType[] = [
  'leaked',
  'foia',
  'manufacturer',
  'public',
  'research',
  'procurement',
  'fcc',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const SourceBadge: React.FC<{ type: SourceType }> = ({ type }) => {
  const c = SOURCE_CONFIG[type] ?? SOURCE_CONFIG.public;
  return (
    <span
      className="inline-block shrink-0"
      style={{
        padding: '1px 6px',
        borderRadius: '4px',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      {c.label}
    </span>
  );
};

const CategoryBadge: React.FC<{ entry: VendorEntry }> = ({ entry }) => {
  const c = getCategoryConfig(entry);
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      {c.label.toUpperCase()}
    </span>
  );
};

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export const SigintLibraryTab: React.FC = () => {
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceType | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  const vendors = vendorManifest.vendors as VendorEntry[];

  const filtered = useMemo(() => {
    return vendors
      .filter((v) => tierFilter === null || v.threat_tier === tierFilter)
      .filter((v) => categoryFilter === null || v.category === categoryFilter)
      .filter((v) => {
        if (!sourceFilter) {
          return true;
        }
        return v.docs.some((d) => d.source_type === sourceFilter);
      })
      .filter((v) => {
        if (!search.trim()) {
          return true;
        }
        const q = search.toLowerCase();
        return (
          v.display_name.toLowerCase().includes(q) ||
          v.surveillance_type.toLowerCase().includes(q) ||
          (v.category ?? '').toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.docs.some(
            (d) =>
              d.title.toLowerCase().includes(q) ||
              d.summary.toLowerCase().includes(q) ||
              d.origin.toLowerCase().includes(q)
          )
        );
      })
      .sort((a, b) => {
        // SIGINT/defense first by tier, others by category label
        if (a.threat_tier && b.threat_tier) {
          return a.threat_tier - b.threat_tier;
        }
        if (a.threat_tier) {
          return -1;
        }
        if (b.threat_tier) {
          return 1;
        }
        return (a.category ?? '').localeCompare(b.category ?? '');
      });
  }, [vendors, tierFilter, sourceFilter, categoryFilter, search]);

  const totalDocs = vendors.reduce((sum, v) => sum + v.docs.length, 0);

  // Unique categories for filter pills
  const allCategories = Array.from(
    new Set(vendors.map((v) => v.category).filter(Boolean))
  ) as string[];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-white">Device Intel Library</h2>
            <p className="text-sm text-slate-400 mt-1">
              {vendors.length} entries · {totalDocs} reference documents indexed
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category filter */}
            <select
              value={categoryFilter ?? ''}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
              className="bg-slate-800 border border-slate-600 text-slate-300 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All categories</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_CONFIG[cat]?.label ?? cat}
                </option>
              ))}
            </select>

            {/* Tier filter (legacy SIGINT tiers) */}
            <div className="flex gap-1">
              {[1, 2, 3].map((t) => {
                const c = TIER_CONFIG[t];
                return (
                  <button
                    key={t}
                    onClick={() => setTierFilter(tierFilter === t ? null : t)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      cursor: 'pointer',
                      border: `1px solid ${tierFilter === t ? c.color : 'rgba(255,255,255,0.12)'}`,
                      background: tierFilter === t ? c.bg : 'rgba(255,255,255,0.04)',
                      color: tierFilter === t ? c.color : 'rgba(255,255,255,0.5)',
                      transition: 'all 0.15s',
                    }}
                  >
                    T{t}
                  </button>
                );
              })}
            </div>

            {/* Source filter */}
            <select
              value={sourceFilter ?? ''}
              onChange={(e) => setSourceFilter((e.target.value as SourceType) || null)}
              className="bg-slate-800 border border-slate-600 text-slate-300 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All sources</option>
              {ALL_SOURCE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_CONFIG[s].label}
                </option>
              ))}
            </select>

            {/* Search */}
            <input
              type="text"
              placeholder="Search entries, docs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-slate-300 text-xs rounded-md px-3 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Entry cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            No entries match the current filters.
          </div>
        )}
        {filtered.map((vendor) => {
          const cat = getCategoryConfig(vendor);
          const isExpanded = expandedVendor === vendor.vendor_key;
          const visibleDocs = sourceFilter
            ? vendor.docs.filter((d) => d.source_type === sourceFilter)
            : vendor.docs;

          return (
            <div
              key={vendor.vendor_key}
              className="rounded-xl border backdrop-blur-sm overflow-hidden"
              style={{
                borderColor: isExpanded ? `${cat.color}40` : 'rgba(255,255,255,0.08)',
                background: '#0f1117',
              }}
            >
              {/* Entry header row */}
              <button
                onClick={() => setExpandedVendor(isExpanded ? null : vendor.vendor_key)}
                className="w-full text-left"
                style={{ padding: '14px 16px', background: isExpanded ? cat.bg : 'transparent' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <CategoryBadge entry={vendor} />
                      <span
                        style={{
                          fontSize: '9px',
                          fontFamily: 'monospace',
                          color: 'rgba(255,255,255,0.35)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {vendor.device_class ?? vendor.surveillance_type}
                      </span>
                    </div>
                    <div className="text-white font-semibold text-sm">{vendor.display_name}</div>
                    <div className="text-slate-400 text-xs mt-1 line-clamp-2">
                      {vendor.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-500">
                      {vendor.docs.length > 0
                        ? `${vendor.docs.length} docs`
                        : vendor.docs_status === 'needs_collection'
                          ? 'no docs yet'
                          : '—'}
                    </span>
                    <span
                      style={{
                        color: cat.color,
                        fontSize: '16px',
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        display: 'inline-block',
                      }}
                    >
                      ›
                    </span>
                  </div>
                </div>

                {/* OUI chips */}
                {vendor.oui_prefixes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-xs text-slate-500 self-center">OUI:</span>
                    {vendor.oui_prefixes.slice(0, 8).map((oui) => (
                      <span
                        key={oui}
                        className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: 'rgba(255,255,255,0.6)',
                          fontSize: '9px',
                        }}
                      >
                        {oui}
                      </span>
                    ))}
                    {vendor.oui_prefixes.length > 8 && (
                      <span className="text-xs text-slate-500 self-center">
                        +{vendor.oui_prefixes.length - 8} more
                      </span>
                    )}
                  </div>
                )}
              </button>

              {/* Expanded doc list */}
              {isExpanded && (
                <div
                  style={{
                    borderTop: `1px solid ${cat.color}25`,
                    padding: '12px 16px 16px',
                    background: 'rgba(0,0,0,0.2)',
                  }}
                >
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">
                    Reference Documents
                  </div>
                  <div className="space-y-2">
                    {visibleDocs.map((doc, i) => (
                      <a
                        key={i}
                        href={`/vendor-docs/${doc.file}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg p-3 transition-colors"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            'rgba(255,255,255,0.06)')
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            'rgba(255,255,255,0.03)')
                        }
                      >
                        <div className="flex items-start gap-2 mb-1.5">
                          <SourceBadge type={doc.source_type} />
                          <span className="text-sm font-medium text-slate-200 leading-snug flex-1">
                            {doc.title}
                          </span>
                          <span
                            className="text-xs shrink-0"
                            style={{
                              color: 'rgba(255,255,255,0.3)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {doc.format === 'pdf' ? '📄 PDF' : '🌐 HTML'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed mb-1.5">
                          {doc.summary}
                        </p>
                        <div
                          className="flex gap-3 text-xs"
                          style={{ color: 'rgba(255,255,255,0.3)' }}
                        >
                          <span>{doc.origin}</span>
                          {doc.year && <span>{doc.year}</span>}
                        </div>
                      </a>
                    ))}
                    {visibleDocs.length === 0 && (
                      <p className="text-xs text-slate-500 italic">
                        {vendor.docs_status === 'needs_collection'
                          ? 'No archived reference documents yet.'
                          : vendor.docs_status === 'not_applicable'
                            ? 'No reference documents applicable for this entry.'
                            : 'No documents match the current source filter.'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
