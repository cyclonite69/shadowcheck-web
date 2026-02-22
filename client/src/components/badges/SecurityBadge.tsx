import { SECURITY_TYPE_COLORS } from '../analytics/utils/chartConstants';

interface SecurityBadgeProps {
  security: string | null | undefined;
}

/** Canonical security label badge aligned to the analytics color palette. */
export const SecurityBadge = ({ security }: SecurityBadgeProps) => {
  const label = security || 'UNKNOWN';
  const color = SECURITY_TYPE_COLORS[label] ?? SECURITY_TYPE_COLORS['UNKNOWN'];
  return (
    <span
      className="px-1.5 py-0.5 rounded text-xs font-medium inline-block"
      style={{
        backgroundColor: color + '20',
        color,
        border: `1px solid ${color}40`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
};
