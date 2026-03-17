/**
 * MAC Address Utility Functions
 */

/**
 * Determines if a MAC address is locally administered (randomized).
 * In a MAC address (XX:XX:XX:XX:XX:XX), if the second-least significant bit
 * of the first octet is 1, it's a locally administered address.
 */
export function isRandomizedMAC(bssid: string): boolean {
  if (!bssid || typeof bssid !== 'string') return false;

  // Clean separators
  const clean = bssid.replace(/[:-]/g, '');
  if (clean.length < 2) return false;

  try {
    const firstOctet = parseInt(clean.substring(0, 2), 16);
    return (firstOctet & 0x02) !== 0;
  } catch (e) {
    return false;
  }
}

/**
 * Returns the classification type of the MAC address.
 */
export function getMACType(bssid: string): 'randomized' | 'oui' {
  return isRandomizedMAC(bssid) ? 'randomized' : 'oui';
}
