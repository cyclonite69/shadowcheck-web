export {};

const { createThreatRepository } = require('../../server/src/repositories/threatRepository') as {
  createThreatRepository: Function;
};

describe('threatRepository', () => {
  const createQuery = () => jest.fn();

  it('maps quick threat rows into typed records', async () => {
    const query = createQuery();
    query.mockResolvedValue({
      rows: [
        {
          bssid: '00:11:22:33:44:55',
          ssid: 'ThreatNet',
          radio_type: 'wifi',
          channel: 6,
          signal_dbm: -50,
          encryption: 'WPA2',
          latitude: 45,
          longitude: -75,
          first_seen: '2026-04-01T00:00:00Z',
          last_seen: '2026-04-02T00:00:00Z',
          observations: '10',
          unique_days: '5',
          unique_locations: '8',
          distance_range_km: '1.5',
          threat_score: '85.5',
          threat_level: 'HIGH',
          total_count: '1',
        },
      ],
    });

    const repository = createThreatRepository({ query });
    const result = await repository.getQuickThreats({
      limit: 10,
      offset: 0,
      minObservations: 5,
      minUniqueDays: 3,
      minUniqueLocations: 5,
      minRangeKm: 0.5,
      minThreatScore: 40,
      minTimestamp: 0,
    });

    expect(result).toEqual({
      records: [
        {
          bssid: '00:11:22:33:44:55',
          ssid: 'ThreatNet',
          radioType: 'wifi',
          channel: 6,
          signalDbm: -50,
          encryption: 'WPA2',
          latitude: 45,
          longitude: -75,
          firstSeen: '2026-04-01T00:00:00Z',
          lastSeen: '2026-04-02T00:00:00Z',
          observations: 10,
          uniqueDays: 5,
          uniqueLocations: 8,
          distanceRangeKm: 1.5,
          threatScore: 85.5,
          threatLevel: 'HIGH',
        },
      ],
      totalCount: 1,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM app.api_network_explorer_mv'), [
      0,
      10,
      0,
      5,
      3,
      5,
      0.5,
      40,
    ]);
  });

  it('maps detailed threat rows into typed records', async () => {
    const query = createQuery();
    query.mockResolvedValue({
      rows: [
        {
          bssid: '00:11:22:33:44:55',
          ssid: 'ThreatNet',
          type: 'wifi',
          encryption: 'WPA2',
          frequency: 2437,
          signal_dbm: -50,
          network_latitude: 45,
          network_longitude: -75,
          total_observations: '10',
          final_threat_score: '85.5',
          final_threat_level: 'MED',
          rule_based_flags: { summary: 'Suspicious' },
        },
      ],
    });

    const repository = createThreatRepository({ query });
    const result = await repository.getDetailedThreats();

    expect(result).toEqual([
      {
        bssid: '00:11:22:33:44:55',
        ssid: 'ThreatNet',
        type: 'wifi',
        encryption: 'WPA2',
        frequency: 2437,
        signalDbm: -50,
        latitude: 45,
        longitude: -75,
        totalObservations: 10,
        finalThreatScore: 85.5,
        finalThreatLevel: 'MEDIUM',
        ruleBasedFlags: { summary: 'Suspicious' },
      },
    ]);
  });

  it('returns processed bssids from the rule-based upsert', async () => {
    const query = createQuery();
    query.mockResolvedValue({
      rows: [{ bssid: 'B1' }, { bssid: 'B2' }],
    });

    const repository = createThreatRepository({ query });
    const result = await repository.upsertRuleBasedThreatScores({
      batchSize: 25,
      maxAgeHours: 24,
    });

    expect(result).toEqual({
      processedBssids: ['B1', 'B2'],
      processedCount: 2,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('calculate_threat_score_v5'), [25]);
  });

  it('filters behavioral candidates to the processed bssids', async () => {
    const query = createQuery();
    query.mockResolvedValue({
      rows: [
        {
          bssid: 'B1',
          observation_count: '6',
          unique_days: '4',
          max_distance_km: '2.5',
        },
      ],
    });

    const repository = createThreatRepository({ query });
    const result = await repository.getBehavioralScoringCandidatesByBssids({
      bssids: ['B1', 'B2'],
      minObservations: 2,
      maxBssidLength: 17,
    });

    expect(result).toEqual([
      {
        bssid: 'B1',
        observationCount: 6,
        uniqueDays: 4,
        maxDistanceKm: 2.5,
      },
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE n.bssid = ANY($1)'), [
      ['B1', 'B2'],
      17,
      2,
    ]);
  });

  it('upserts behavioral scores one row at a time', async () => {
    const query = createQuery();
    query.mockResolvedValue({ rows: [] });

    const repository = createThreatRepository({ query });
    const updated = await repository.upsertBehavioralThreatScores([
      {
        bssid: 'B1',
        mlThreatScore: 42,
        mlThreatProbability: 0.42,
        mlPrimaryClass: 'LEGITIMATE',
        modelVersion: '2.0.0',
      },
      {
        bssid: 'B2',
        mlThreatScore: 66,
        mlThreatProbability: 0.66,
        mlPrimaryClass: 'THREAT',
        modelVersion: null,
      },
    ]);

    expect(updated).toBe(2);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO app.network_threat_scores'),
      ['B1', 42, 0.42, 'LEGITIMATE', '2.0.0']
    );
  });
});
