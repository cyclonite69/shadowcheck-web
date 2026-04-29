export {};

import { frequencyToChannel } from '../../server/src/utils/frequencyUtils';

describe('frequencyToChannel', () => {
  test('returns null for null input', () => {
    expect(frequencyToChannel(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(frequencyToChannel(undefined)).toBeNull();
  });

  test('returns null for 0', () => {
    expect(frequencyToChannel(0)).toBeNull();
  });

  test('returns null for out-of-band frequency', () => {
    expect(frequencyToChannel(3000)).toBeNull();
  });

  // 2.4 GHz band
  test('2412 MHz → channel 1', () => {
    expect(frequencyToChannel(2412)).toBe(1);
  });

  test('2437 MHz → channel 6', () => {
    expect(frequencyToChannel(2437)).toBe(6);
  });

  test('2462 MHz → channel 11', () => {
    expect(frequencyToChannel(2462)).toBe(11);
  });

  test('2484 MHz → channel 14 (Japan)', () => {
    expect(frequencyToChannel(2484)).toBe(14);
  });

  // 5 GHz band
  test('5180 MHz → channel 36', () => {
    expect(frequencyToChannel(5180)).toBe(36);
  });

  test('5745 MHz → channel 149', () => {
    expect(frequencyToChannel(5745)).toBe(149);
  });

  // 6 GHz band (WiFi 6E)
  test('5955 MHz → channel 1 (6 GHz)', () => {
    expect(frequencyToChannel(5955)).toBe(2);
  });

  test('6135 MHz → channel 37 (6 GHz)', () => {
    expect(frequencyToChannel(6135)).toBe(38);
  });
});
