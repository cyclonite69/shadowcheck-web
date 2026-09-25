import React, { useEffect, useRef, useState } from 'react';
import vendorManifest from './vendor_intel_manifest.json';
import type { SourceType, VendorDoc, VendorEntry } from './types';

// ─── Category-aware header config ─────────────────────────────────────────────

const CATEGORY_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> =
  {
    SIGINT_INTERCEPT: {
      label: 'SIGINT / INTERCEPT',
      color: '#dc2626',
      bg: '#dc262615',
      border: '#dc262640',
    },
    BODY_CAMERA: { label: 'BODY CAMERA', color: '#3b82f6', bg: '#3b82f615', border: '#3b82f640' },
    CEW_TASER: { label: 'CEW / TASER', color: '#8b5cf6', bg: '#8b5cf615', border: '#8b5cf640' },
    ALPR_CAMERA: { label: 'ALPR CAMERA', color: '#ef4444', bg: '#ef444415', border: '#ef444440' },
    ACOUSTIC_SENSOR: {
      label: 'ACOUSTIC SENSOR',
      color: '#ef4444',
      bg: '#ef444415',
      border: '#ef444440',
    },
    PUBLIC_SAFETY_MOBILE_ROUTER: {
      label: 'PUBLIC SAFETY ROUTER',
      color: '#10b981',
      bg: '#10b98115',
      border: '#10b98140',
    },
    DEFENSE_C4ISR: {
      label: 'DEFENSE / C4ISR',
      color: '#f97316',
      bg: '#f9731615',
      border: '#f9731640',
    },
    DUAL_USE_INFRASTRUCTURE: {
      label: 'DUAL-USE INFRASTRUCTURE',
      color: '#eab308',
      bg: '#eab30815',
      border: '#eab30840',
    },
    DUAL_USE_PENTEST_GEAR: {
      label: 'DUAL-USE PENTEST',
      color: '#f59e0b',
      bg: '#f59e0b15',
      border: '#f59e0b50',
    },
    UNKNOWN_PRIVATE_OUI: {
      label: 'PRIVATE / UNKNOWN OUI',
      color: '#6b7280',
      bg: '#6b728015',
      border: '#6b728040',
    },
  };

// Legacy tier fallback for SIGINT/defense entries that still carry threat_tier
const TIER_BADGE: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: 'TIER 1 — ACTIVE INTERCEPT', color: '#dc2626', bg: '#dc262615', border: '#dc262640' },
  2: {
    label: 'TIER 2 — PASSIVE SURVEILLANCE',
    color: '#f97316',
    bg: '#f9731615',
    border: '#f9731640',
  },
  3: {
    label: 'TIER 3 — DUAL-USE / TACTICAL',
    color: '#eab308',
    bg: '#eab30815',
    border: '#eab30840',
  },
};

function getHeaderConfig(entry: VendorEntry) {
  if (entry.category && CATEGORY_BADGE[entry.category]) {
    return CATEGORY_BADGE[entry.category];
  }
  if (entry.threat_tier && TIER_BADGE[entry.threat_tier]) {
    return TIER_BADGE[entry.threat_tier];
  }
  return CATEGORY_BADGE.UNKNOWN_PRIVATE_OUI;
}

// ─── Source badge config ───────────────────────────────────────────────────────

const SOURCE_BADGES: Record<
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

const VENDOR_DOCS_BASE = '/vendor-docs/';

// ─── Event bus ────────────────────────────────────────────────────────────────

export const VENDOR_INTEL_EVENT = 'vendor-intel-open';

export function emitVendorIntel(surveillanceType: string): void {
  window.dispatchEvent(new CustomEvent(VENDOR_INTEL_EVENT, { detail: { surveillanceType } }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SourceBadge: React.FC<{ type: SourceType }> = ({ type }) => {
  const b = SOURCE_BADGES[type] ?? SOURCE_BADGES.public;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: '4px',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: b.color,
        background: b.bg,
        border: `1px solid ${b.border}`,
        flexShrink: 0,
      }}
    >
      {b.label}
    </span>
  );
};

const DocCard: React.FC<{ doc: VendorDoc }> = ({ doc }) => {
  const href = `${VENDOR_DOCS_BASE}${doc.file}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '6px',
        textDecoration: 'none',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)')
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')
      }
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '5px' }}>
        <SourceBadge type={doc.source_type} />
        <span
          style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.3, flex: 1 }}
        >
          {doc.title}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
        {doc.summary}
      </p>
      <div style={{ marginTop: '5px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>{doc.origin}</span>
        {doc.year && (
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>{doc.year}</span>
        )}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '9px',
            color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {doc.format === 'pdf' ? '📄 PDF' : '🌐 HTML'}
        </span>
      </div>
    </a>
  );
};

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export const VendorIntelDrawer: React.FC = () => {
  const [vendor, setVendor] = useState<VendorEntry | null>(null);
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { surveillanceType } = (e as CustomEvent).detail as { surveillanceType: string };
      // Match on surveillance_type OR device_class so new entries resolve correctly
      const found = (vendorManifest.vendors as VendorEntry[]).find(
        (v) => v.surveillance_type === surveillanceType || v.device_class === surveillanceType
      );
      if (found) {
        setVendor(found);
        setOpen(true);
      }
    };
    window.addEventListener(VENDOR_INTEL_EVENT, handler);
    return () => window.removeEventListener(VENDOR_INTEL_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!vendor) {
    return null;
  }

  const header = getHeaderConfig(vendor);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 9998,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-label={`Device Intel: ${vendor.display_name}`}
        aria-modal="true"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(420px, 95vw)',
          background: '#0f1117',
          borderLeft: `2px solid ${header.color}40`,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: header.bg,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Category badge */}
              <div
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: header.color,
                  background: header.bg,
                  border: `1px solid ${header.border}`,
                  marginBottom: '6px',
                }}
              >
                {header.label}
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#fff',
                  lineHeight: 1.2,
                }}
              >
                {vendor.display_name}
              </h2>
              <div
                style={{
                  marginTop: '4px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  color: header.color,
                  letterSpacing: '0.05em',
                }}
              >
                {vendor.device_class ?? vendor.surveillance_type}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close device intel drawer"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                padding: '6px 8px',
                fontSize: '14px',
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* Description */}
          <p
            style={{
              margin: '10px 0 0',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.6,
            }}
          >
            {vendor.description}
          </p>

          {/* OUI chips (cap at 8, show overflow count) */}
          {vendor.oui_prefixes.length > 0 && (
            <div
              style={{
                marginTop: '10px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'rgba(255,255,255,0.3)',
                  marginRight: '2px',
                }}
              >
                OUI:
              </span>
              {vendor.oui_prefixes.slice(0, 8).map((oui) => (
                <span
                  key={oui}
                  style={{
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontSize: '9px',
                    fontFamily: 'monospace',
                    color: 'rgba(255,255,255,0.7)',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {oui}
                </span>
              ))}
              {vendor.oui_prefixes.length > 8 && (
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>
                  +{vendor.oui_prefixes.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Doc list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
          <div
            style={{
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.3)',
              marginBottom: '10px',
            }}
          >
            Reference Documents ({vendor.docs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {vendor.docs.map((doc, i) => (
              <DocCard key={i} doc={doc} />
            ))}
          </div>
          {vendor.docs.length === 0 && (
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
              {vendor.docs_status === 'needs_collection'
                ? 'No archived reference documents yet.'
                : vendor.docs_status === 'not_applicable'
                  ? 'No reference documents applicable for this entry.'
                  : 'No reference documents indexed for this entry.'}
            </p>
          )}
        </div>
      </div>
    </>
  );
};
