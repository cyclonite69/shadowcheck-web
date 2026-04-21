import type { NetworkRow } from '../../../../types/network';

export const isBluetoothLookupTarget = (network: NetworkRow | null): boolean => {
  if (!network) return false;

  const normalizedType = String(network.type ?? '')
    .trim()
    .toUpperCase();
  const bluetoothTypes = [
    'B',
    'E',
    'BT',
    'BLE',
    'BTLE',
    'BLUETOOTH',
    'BLUETOOTHLE',
    'BLUETOOTH_LOW_ENERGY',
  ];

  if (bluetoothTypes.includes(normalizedType)) {
    return true;
  }

  const ssidUpper = String(network.ssid ?? '').toUpperCase();
  const securityUpper = String(network.security ?? '').toUpperCase();
  const bluetoothKeywords = ['BLE', 'BTLE', 'BLUETOOTH'];

  return (
    bluetoothKeywords.some((kw) => ssidUpper.includes(kw)) ||
    bluetoothKeywords.some((kw) => securityUpper.includes(kw))
  );
};
