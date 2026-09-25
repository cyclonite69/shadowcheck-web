import React from 'react';
import type { ColumnBadgeConfig } from '../../types/badgeConfig';
import type { NetworkRow } from '../../types/network';
import { resolveBadgeColors, matchesRule } from './colorUtils';
import { formatDeviceType, hasVendorIntelForDeviceClass } from '../../utils/deviceClassUtils';

interface BadgeRendererProps {
  value: unknown;
  config: ColumnBadgeConfig;
  /** Optional row context for hoverAction (Phase 2 vendor-intel drawer) */
  row?: NetworkRow;
}

/** Resolve the first matching rule's color and label for a given value. */
function resolveRule(
  config: ColumnBadgeConfig,
  value: unknown
): {
  color: import('../../types/badgeConfig').BadgeColor;
  label?: string;
} {
  for (const rule of config.rules) {
    if (matchesRule(rule.match, value)) {
      return { color: rule.color, label: rule.label };
    }
  }
  return { color: config.defaultColor };
}

/** Size → padding/fontSize map */
const SIZE_STYLES: Record<ColumnBadgeConfig['size'], { padding: string; fontSize: string }> = {
  compact: { padding: '1px 5px', fontSize: '10px' },
  normal: { padding: '2px 7px', fontSize: '11px' },
  prominent: { padding: '4px 10px', fontSize: '13px' },
};

/** Shape → borderRadius (and layout hints used below) */
function shapeStyle(shape: ColumnBadgeConfig['shape']): React.CSSProperties {
  switch (shape) {
    case 'pill':
      return { borderRadius: '9999px' };
    case 'tag':
      return { borderRadius: '3px 8px 8px 3px' };
    case 'chip':
      return { borderRadius: '4px' };
    case 'square':
      return { borderRadius: '2px' };
    case 'dot-label':
      return { borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '5px' };
    case 'icon-only':
      return {
        borderRadius: '50%',
        width: '18px',
        height: '18px',
        padding: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      };
    default:
      return { borderRadius: '4px' };
  }
}

const BadgeRendererComponent: React.FC<BadgeRendererProps> = ({ value, config, row: _row }) => {
  const { color, label } = resolveRule(config, value);
  const resolved = resolveBadgeColors(color, config.fill);
  const sizeStyle = SIZE_STYLES[config.size];
  const shape = shapeStyle(config.shape);

  // Display text: rule label override → raw value string → em dash
  const displayValue =
    label !== undefined
      ? label
      : config.column === 'device_class' && value !== null && value !== undefined && value !== ''
        ? formatDeviceType(String(value))
        : value !== null && value !== undefined && value !== ''
          ? String(value)
          : '—';
  const vendorIntelValue =
    config.hoverAction === 'vendor-intel-drawer' && value ? String(value) : undefined;
  const gatedVendorIntelValue =
    config.column === 'device_class' && !hasVendorIntelForDeviceClass(vendorIntelValue)
      ? undefined
      : vendorIntelValue;

  const baseStyle: React.CSSProperties = {
    display: 'inline-block',
    fontWeight: 500,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
    color: resolved.text,
    background: resolved.background,
    border: resolved.border !== 'transparent' ? `1px solid ${resolved.border}` : 'none',
    ...sizeStyle,
    ...shape,
  };

  if (config.shape === 'dot-label') {
    const dotStyle: React.CSSProperties = {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      flexShrink: 0,
      background: color.accentColor,
      display: 'inline-block',
    };
    return (
      <span
        style={{ ...baseStyle, background: 'transparent', border: 'none', padding: '0' }}
        title={
          config.showRawValueAsTooltip && value !== null && value !== undefined
            ? String(value)
            : undefined
        }
        data-vendor-intel={gatedVendorIntelValue}
      >
        <span style={dotStyle} />
        <span style={{ color: resolved.text, fontSize: sizeStyle.fontSize }}>{displayValue}</span>
      </span>
    );
  }

  if (config.shape === 'icon-only') {
    // Renders a colored dot as a stand-in; icon support added in Phase 2.
    return <span style={{ ...baseStyle, background: color.accentColor }} title={displayValue} />;
  }

  return (
    <span
      style={baseStyle}
      title={
        config.showRawValueAsTooltip && value !== null && value !== undefined
          ? String(value)
          : undefined
      }
      data-vendor-intel={gatedVendorIntelValue}
    >
      {displayValue}
    </span>
  );
};

export const BadgeRenderer = React.memo(BadgeRendererComponent);
