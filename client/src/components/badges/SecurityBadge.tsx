import { SECURITY_TYPE_COLORS } from '../../constants/colors';

interface SecurityBadgeProps {
  security: string | null | undefined;
  networkType?: string | null | undefined;
}

/** Canonical security label badge aligned to the analytics color palette. */
export const SecurityBadge = ({ security, networkType }: SecurityBadgeProps) => {
  const normalizedSecurity = String(security || '')
    .trim()
    .toUpperCase();
  const normalizedType = String(networkType || '')
    .trim()
    .toUpperCase();
  const isBluetoothType = normalizedType === 'B' || normalizedType === 'E';
  const shouldShowDash =
    !normalizedSecurity ||
    normalizedSecurity === 'UNKNOWN' ||
    normalizedSecurity === '—' ||
    (isBluetoothType && normalizedSecurity === 'OPEN');
  const label = shouldShowDash ? '—' : normalizedSecurity;
  const color = shouldShowDash
    ? SECURITY_TYPE_COLORS['UNKNOWN']
    : (SECURITY_TYPE_COLORS[label as string] ?? SECURITY_TYPE_COLORS['UNKNOWN']);

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
