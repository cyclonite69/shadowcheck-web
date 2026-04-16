import type { NetworkRow } from '../../types/network';
import { NETWORK_TYPE_CONFIG } from '../../constants/network';

interface TypeBadgeProps {
  type: NetworkRow['type'];
}

const NETWORK_TYPE_DESCRIPTIONS: Partial<Record<string, string>> = {
  W: 'WiFi 802.11 wireless network',
  E: 'Bluetooth Low Energy device',
  B: 'Classic Bluetooth device',
  G: 'GSM 2G cellular network',
  C: 'CDMA cellular network',
  D: 'UMTS/WCDMA 3G cellular network',
  L: 'LTE 4G cellular network',
  N: '5G NR cellular network',
  F: 'Near-Field Communication',
};

export const TypeBadge = ({ type }: TypeBadgeProps) => {
  const config = NETWORK_TYPE_CONFIG[type || '?'] || NETWORK_TYPE_CONFIG['?'];
  const description = type ? NETWORK_TYPE_DESCRIPTIONS[type] : undefined;
  return (
    <span
      className="px-1.5 py-0.5 rounded text-xs font-medium inline-block"
      style={{
        backgroundColor: config.color + '20',
        color: config.color,
        border: `1px solid ${config.color}40`,
      }}
      title={description}
    >
      {config.label}
    </span>
  );
};
