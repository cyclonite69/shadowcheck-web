/**
 * Regression test for networks API data integrity
 * Ensures null values are preserved and not converted to 0
 */

import request from 'supertest';
import app from '../../server/server';

interface NetworkResponse {
  networks: Array<{
    signal: number | null;
    frequency: number | null;
    channel: number | null;
    type: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

describe('Networks API Data Integrity', () => {
  test('should preserve null values and not return fake zeros', async () => {
    const response = await request(app)
      .get('/api/networks?limit=5&offset=0&location_mode=latest_observation')
      .expect(200);

    expect(response.body).toHaveProperty('networks');
    expect(Array.isArray(response.body.networks)).toBe(true);

    const body = response.body as NetworkResponse;

    if (body.networks.length > 0) {
      const network = body.networks[0];

      // Signal should be null or a valid negative dBm value, never 0
      if (network.signal !== null) {
        expect(typeof network.signal).toBe('number');
        expect(network.signal).toBeLessThan(0); // dBm values are always negative
        expect(network.signal).not.toBe(0); // 0 dBm is not realistic
      }

      // Frequency should be null or a valid frequency, never 0
      if (network.frequency !== null) {
        expect(typeof network.frequency).toBe('number');
        expect(network.frequency).toBeGreaterThan(0);
        expect(network.frequency).not.toBe(0);
      }

      // Channel should be null or a valid channel number, never 0 for WiFi
      if (network.channel !== null && network.type === 'W') {
        expect(typeof network.channel).toBe('number');
        expect(network.channel).toBeGreaterThan(0);
        expect(network.channel).not.toBe(0);
      }

      // Coordinates should be null or valid lat/lon values
      if ('latitude' in network && network.latitude !== null) {
        expect(typeof network.latitude).toBe('number');
        expect(network.latitude).toBeGreaterThanOrEqual(-90);
        expect(network.latitude).toBeLessThanOrEqual(90);
      }

      if ('longitude' in network && network.longitude !== null) {
        expect(typeof network.longitude).toBe('number');
        expect(network.longitude).toBeGreaterThanOrEqual(-180);
        expect(network.longitude).toBeLessThanOrEqual(180);
      }

      console.log('✓ Data integrity check passed for network:', {
        signal: network.signal,
        frequency: network.frequency,
        channel: network.channel,
        type: network.type,
      });
    }
  });

  test('should return consistent data types across all networks', async () => {
    const response = await request(app).get('/api/networks?limit=10').expect(200);

    const body = response.body as NetworkResponse;
    expect(body.networks.length).toBeGreaterThan(0);

    body.networks.forEach((network, index) => {
      // Signal should always be number or null, never string or undefined
      expect(network.signal === null || typeof network.signal === 'number').toBe(true);

      // Frequency should always be number or null
      expect(network.frequency === null || typeof network.frequency === 'number').toBe(true);

      // Channel should always be number or null
      expect(network.channel === null || typeof network.channel === 'number').toBe(true);

      if (index === 0) {
        console.log('✓ Type consistency check passed for first network');
      }
    });
  });
});
