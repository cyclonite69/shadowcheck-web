/**
 * Test WiGLE import admin protection
 */

export {};

const { runIntegration } = require('./helpers/integrationEnv');

const describeIfIntegration = runIntegration ? describe : describe.skip;

let request: any;
let app: any;

if (runIntegration) {
  request = require('supertest');
  app = require('../server/server');
}

describeIfIntegration('WiGLE Import Admin Protection', () => {
  test('should require admin access for WiGLE import', async () => {
    const response = await request(app).post('/api/import/wigle').expect(401);

    expect(response.body).toHaveProperty('error');
  });

  test('should return proper error message for unauthorized access', async () => {
    const response = await request(app).post('/api/import/wigle');

    expect(response.status).toBeGreaterThanOrEqual(401);
    expect(response.body.error).toBeDefined();
  });
});
