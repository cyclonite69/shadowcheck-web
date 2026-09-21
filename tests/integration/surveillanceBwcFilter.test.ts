/**
 * Real-database regression coverage for the BWC Networks Explorer filter.
 *
 * Requires RUN_INTEGRATION_TESTS=true and the configured test database.
 */

export {};

const { runIntegration } = require('../helpers/integrationEnv');
const describeIfIntegration = runIntegration ? describe : describe.skip;

let UniversalFilterQueryBuilder: any;
let v2Service: any;

if (runIntegration) {
  ({ UniversalFilterQueryBuilder } = require('../../server/src/services/filterQueryBuilder'));
  v2Service = require('../../server/src/services/v2Service');
}

describeIfIntegration('BWC filter integration', () => {
  if (!runIntegration) {
    test.skip('requires RUN_INTEGRATION_TESTS=true', () => {});
    return;
  }

  test('returns the known active BWC detection without observation rows', async () => {
    const candidates = await v2Service.executeV2Query(`
      SELECT sd.bssid
      FROM app.surveillance_detections sd
      JOIN app.api_network_explorer_mv ne ON ne.bssid = sd.bssid
      WHERE sd.false_positive = FALSE
        AND sd.device_type IN (
          'AXON_BODY_CAMERA',
          'MOTOROLA_BWC',
          'AXON_SIGNAL_PERIPHERAL',
          'DEI_BWC',
          'BT_IMAGING_DEVICE'
        )
      ORDER BY sd.bssid
      LIMIT 1
    `);
    const targetBssid = candidates.rows[0]?.bssid;
    if (!targetBssid) {
      console.warn('BWC integration fixture absent; no active BWC detection to exercise');
      return;
    }

    const builder = new UniversalFilterQueryBuilder(
      { surveillance: true, bwc: true },
      { surveillance: true, bwc: true }
    );
    const query = builder.buildNetworkListQuery({ limit: 5000, offset: 0 });

    expect(query.sql).toContain('FROM app.api_network_explorer_mv ne');
    expect(query.sql).not.toContain('WITH filtered_obs AS');

    const result = await v2Service.executeV2Query(query.sql, query.params);
    expect(result.rows.some((row: { bssid: string }) => row.bssid === targetBssid)).toBe(true);
  });
});
