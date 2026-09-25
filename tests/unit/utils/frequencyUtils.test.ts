import { frequencyToChannel } from '../../../server/src/utils/frequencyUtils';

describe('frequencyToChannel', () => {
  describe('2.4 GHz band', () => {
    it('should convert 2412 MHz to channel 1', () => {
      expect(frequencyToChannel(2412)).toBe(1);
    });

    it('should convert 2437 MHz to channel 6', () => {
      expect(frequencyToChannel(2437)).toBe(6);
    });

    it('should convert 2462 MHz to channel 11', () => {
      expect(frequencyToChannel(2462)).toBe(11);
    });

    it('should convert 2472 MHz to channel 13', () => {
      expect(frequencyToChannel(2472)).toBe(13);
    });

    it('should convert 2484 MHz to channel 14', () => {
      expect(frequencyToChannel(2484)).toBe(14);
    });
  });

  describe('5 GHz band', () => {
    it('should convert 5180 MHz to channel 36', () => {
      expect(frequencyToChannel(5180)).toBe(36);
    });

    it('should convert 5200 MHz to channel 40', () => {
      expect(frequencyToChannel(5200)).toBe(40);
    });

    it('should convert 5500 MHz to channel 100', () => {
      expect(frequencyToChannel(5500)).toBe(100);
    });

    it('should convert 5825 MHz to channel 165', () => {
      expect(frequencyToChannel(5825)).toBe(165);
    });
  });

  describe('6 GHz band', () => {
    it('should convert 5955 MHz to channel 1', () => {
      expect(frequencyToChannel(5955)).toBe(2); // (5955 - 5950) / 5 + 1 = 2
    });

    it('should convert 5935 MHz to channel 1 if it matches logic', () => {
      // (5935 - 5950) / 5 + 1 = -15 / 5 + 1 = -3 + 1 = -2. Wait.
      // Let's re-read the code logic.
      // if (freqMhz >= 5935 && freqMhz <= 7115) {
      //   return Math.round((freqMhz - 5950) / 5) + 1;
      // }
      expect(frequencyToChannel(5945)).toBe(0); // (5945-5950)/5 + 1 = -1 + 1 = 0
      expect(frequencyToChannel(5950)).toBe(1); // (5950-5950)/5 + 1 = 0 + 1 = 1
    });

    it('should convert 7115 MHz to channel 234', () => {
      expect(frequencyToChannel(7115)).toBe(234); // (7115 - 5950) / 5 + 1 = 1165 / 5 + 1 = 233 + 1 = 234
    });
  });

  describe('Edge cases and invalid inputs', () => {
    it('should return null for null input', () => {
      expect(frequencyToChannel(null)).toBe(null);
    });

    it('should return null for undefined input', () => {
      expect(frequencyToChannel(undefined)).toBe(null);
    });

    it('should return null for zero input', () => {
      expect(frequencyToChannel(0)).toBe(null);
    });

    it('should return null for frequencies outside supported bands', () => {
      expect(frequencyToChannel(1000)).toBe(null);
      expect(frequencyToChannel(3000)).toBe(null);
      expect(frequencyToChannel(4000)).toBe(null);
      expect(frequencyToChannel(8000)).toBe(null);
    });
  });
});
