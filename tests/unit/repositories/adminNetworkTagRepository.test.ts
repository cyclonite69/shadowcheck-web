export {};

import {
  checkDuplicateObservations,
  addNetworkNote,
  getNetworkSummary,
  getBackupData,
  upsertNetworkTag,
  updateNetworkTagIgnore,
  insertNetworkTagIgnore,
  updateNetworkThreatTag,
  insertNetworkThreatTag,
  updateNetworkTagNotes,
  insertNetworkTagNotes,
  deleteNetworkTag,
  requestWigleLookup,
  markNetworkInvestigate,
  fetchNetworksPendingWigleLookup,
  exportMLTrainingSet,
  getNetworksPendingWigleLookup,
  exportMLTrainingData,
} from '../../../server/src/repositories/adminNetworkTagRepository';

describe('adminNetworkTagRepository', () => {
  let mockExecutor: jest.Mock;

  beforeEach(() => {
    mockExecutor = jest.fn();
  });

  test('checkDuplicateObservations calls queryExecutor and returns first row or null', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ total_observations: 10, unique_networks: 2, bssids: ['AA:BB:CC', 'DD:EE:FF'] }],
    });

    const result = await checkDuplicateObservations(mockExecutor, 'AA:BB:CC', 123456789);
    expect(mockExecutor).toHaveBeenCalled();
    expect(result.total_observations).toBe(10);
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain('WITH target_obs AS');
    expect(sql).toContain('SELECT time, lat, lon, accuracy');
    expect(sql).toContain('FROM app.observations');
    expect(sql).toContain('WHERE bssid = $1 AND time = $2');
    expect(sql).toContain('SELECT');
    expect(sql).toContain('COUNT(*) as total_observations');
    expect(sql).toContain('COUNT(DISTINCT l.bssid) as unique_networks');
    expect(sql).toContain('ARRAY_AGG(DISTINCT l.bssid ORDER BY l.bssid) as bssids');
    expect(sql).toContain('FROM app.observations l');
    expect(sql).toContain('l.time = t.time');
    expect(sql).toContain('AND l.lat = t.lat');
    expect(sql).toContain('AND l.lon = t.lon');
    expect(sql).toContain('AND l.accuracy = t.accuracy');
    expect(sql).toContain('GROUP BY t.lat, t.lon, t.accuracy, t.time');
    expect(params).toEqual(['AA:BB:CC', 123456789]);

    mockExecutor.mockResolvedValueOnce({ rows: [] });
    const nullResult = await checkDuplicateObservations(mockExecutor, 'AA:BB:CC', 123456789);
    expect(nullResult).toBeNull();
  });

  test('addNetworkNote calls queryExecutor and returns note_id', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ note_id: 42 }],
    });

    const noteId = await addNetworkNote(mockExecutor, 'AA:BB:CC', 'Test note content');
    expect(mockExecutor).toHaveBeenCalled();
    expect(noteId).toBe(42);
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toEqual("SELECT app.network_add_note($1, $2, 'general', 'user') as note_id");
    expect(params).toEqual(['AA:BB:CC', 'Test note content']);
  });

  test('getNetworkSummary returns single row or null', async () => {
    const mockSummary = { bssid: 'AA:BB:CC', tags: ['threat'] };
    mockExecutor.mockResolvedValueOnce({
      rows: [mockSummary],
    });

    const summary = await getNetworkSummary(mockExecutor, 'AA:BB:CC');
    expect(mockExecutor).toHaveBeenCalled();
    expect(summary).toEqual(mockSummary);
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain(
      'SELECT bssid, tags, tag_array, is_threat, is_investigate, is_false_positive, is_suspect'
    );
    expect(sql).toContain('FROM app.network_tags_full');
    expect(sql).toContain('WHERE bssid = $1');
    expect(params).toEqual(['AA:BB:CC']);

    mockExecutor.mockResolvedValueOnce({ rows: [] });
    const nullSummary = await getNetworkSummary(mockExecutor, 'AA:BB:CC');
    expect(nullSummary).toBeNull();
  });

  test('getBackupData queries observations, networks, and tags and returns aggregate object', async () => {
    mockExecutor
      .mockResolvedValueOnce({ rows: [{ id: 1, ssid: 'obs1' }] })
      .mockResolvedValueOnce({ rows: [{ bssid: 'net1' }] })
      .mockResolvedValueOnce({ rows: [{ bssid: 'tag1' }] });

    const backup = await getBackupData(mockExecutor);
    expect(mockExecutor).toHaveBeenCalledTimes(3);
    expect(backup.observations).toHaveLength(1);
    expect(backup.networks).toHaveLength(1);
    expect(backup.tags).toHaveLength(1);

    const calls = mockExecutor.mock.calls;
    expect(calls[0][0]).toEqual('SELECT * FROM app.observations ORDER BY observed_at DESC');
    expect(calls[1][0]).toEqual('SELECT * FROM app.networks');
    expect(calls[2][0]).toEqual('SELECT * FROM app.network_tags');
  });

  test('upsertNetworkTag calls queryExecutor and returns row', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ bssid: 'AA:BB:CC', threat_tag: 'THREAT' }],
    });

    const result = await upsertNetworkTag(
      mockExecutor,
      'AA:BB:CC',
      false,
      'test',
      'THREAT',
      95,
      'Upsert note'
    );
    expect(mockExecutor).toHaveBeenCalled();
    expect(result.threat_tag).toBe('THREAT');
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain('INSERT INTO app.network_tags');
    expect(sql).toContain('bssid, is_ignored, ignore_reason, threat_tag, threat_confidence, notes');
    expect(sql).toContain('ON CONFLICT (bssid) DO UPDATE SET');
    expect(sql).toContain('is_ignored = COALESCE($2, app.network_tags.is_ignored)');
    expect(sql).toContain(
      'ignore_reason = CASE WHEN $2 IS NOT NULL THEN $3 ELSE app.network_tags.ignore_reason END'
    );
    expect(sql).toContain('threat_tag = COALESCE($4, app.network_tags.threat_tag)');
    expect(sql).toContain(
      'threat_confidence = CASE WHEN $4 IS NOT NULL THEN $5 ELSE app.network_tags.threat_confidence END'
    );
    expect(sql).toContain('notes = COALESCE($6, app.network_tags.notes)');
    expect(sql).toContain('RETURNING *');
    expect(params).toEqual(['AA:BB:CC', false, 'test', 'THREAT', 95, 'Upsert note']);
  });

  test('upsertNetworkTag handles null ignoreReason and nullable parameters', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ bssid: 'AA:BB:CC', threat_tag: 'THREAT' }],
    });

    const result = await upsertNetworkTag(
      mockExecutor,
      'AA:BB:CC',
      false,
      null,
      'THREAT',
      95,
      'Upsert note'
    );
    expect(mockExecutor).toHaveBeenCalled();
    expect(result.threat_tag).toBe('THREAT');
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain('INSERT INTO app.network_tags');
    expect(params).toEqual(['AA:BB:CC', false, null, 'THREAT', 95, 'Upsert note']);
  });

  test('updateNetworkTagIgnore calls queryExecutor and updates ignore state', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ bssid: 'AA:BB:CC', is_ignored: true }],
    });

    const result = await updateNetworkTagIgnore(mockExecutor, 'AA:BB:CC', true, 'Test reason');
    expect(mockExecutor).toHaveBeenCalled();
    expect(result.is_ignored).toBe(true);
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain('UPDATE app.network_tags');
    expect(sql).toContain('SET is_ignored = $1, ignore_reason = $2, updated_at = NOW()');
    expect(sql).toContain('WHERE bssid = $3 RETURNING *');
    expect(params).toEqual([true, 'Test reason', 'AA:BB:CC']);
  });

  test('insertNetworkTagIgnore inserts ignore row and returns result', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ bssid: 'AA:BB:CC', is_ignored: true }],
    });

    const result = await insertNetworkTagIgnore(mockExecutor, 'AA:BB:CC', true, 'Test reason');
    expect(mockExecutor).toHaveBeenCalled();
    expect(result.is_ignored).toBe(true);
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain('INSERT INTO app.network_tags (bssid, is_ignored, ignore_reason)');
    expect(sql).toContain('VALUES ($1, $2, $3) RETURNING *');
    expect(params).toEqual(['AA:BB:CC', true, 'Test reason']);
  });

  test('updateNetworkThreatTag updates threat tag state', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ bssid: 'AA:BB:CC', threat_tag: 'SUSPECT' }],
    });

    const result = await updateNetworkThreatTag(mockExecutor, 'AA:BB:CC', 'SUSPECT', 80);
    expect(mockExecutor).toHaveBeenCalled();
    expect(result.threat_tag).toBe('SUSPECT');
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain('UPDATE app.network_tags');
    expect(sql).toContain('SET threat_tag = $1, threat_confidence = $2, updated_at = NOW()');
    expect(sql).toContain('WHERE bssid = $3 RETURNING *');
    expect(params).toEqual(['SUSPECT', 80, 'AA:BB:CC']);
  });

  test('insertNetworkThreatTag inserts threat tag state', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ bssid: 'AA:BB:CC', threat_tag: 'THREAT' }],
    });

    const result = await insertNetworkThreatTag(mockExecutor, 'AA:BB:CC', 'THREAT', 90);
    expect(mockExecutor).toHaveBeenCalled();
    expect(result.threat_tag).toBe('THREAT');
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain('INSERT INTO app.network_tags (bssid, threat_tag, threat_confidence)');
    expect(sql).toContain('VALUES ($1, $2, $3) RETURNING *');
    expect(params).toEqual(['AA:BB:CC', 'THREAT', 90]);
  });

  test('updateNetworkTagNotes updates tag notes', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ bssid: 'AA:BB:CC', notes: 'Updated notes' }],
    });

    const result = await updateNetworkTagNotes(mockExecutor, 'AA:BB:CC', 'Updated notes');
    expect(mockExecutor).toHaveBeenCalled();
    expect(result.notes).toBe('Updated notes');
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain('UPDATE app.network_tags');
    expect(sql).toContain('SET notes = $1, updated_at = NOW()');
    expect(sql).toContain('WHERE bssid = $2 RETURNING *');
    expect(params).toEqual(['Updated notes', 'AA:BB:CC']);
  });

  test('insertNetworkTagNotes inserts tag notes', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ bssid: 'AA:BB:CC', notes: 'New notes' }],
    });

    const result = await insertNetworkTagNotes(mockExecutor, 'AA:BB:CC', 'New notes');
    expect(mockExecutor).toHaveBeenCalled();
    expect(result.notes).toBe('New notes');
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain('INSERT INTO app.network_tags (bssid, notes)');
    expect(sql).toContain('VALUES ($1, $2) RETURNING *');
    expect(params).toEqual(['AA:BB:CC', 'New notes']);
  });

  test('deleteNetworkTag deletes row and returns count', async () => {
    mockExecutor.mockResolvedValueOnce({ rowCount: 1 });

    const result = await deleteNetworkTag(mockExecutor, 'AA:BB:CC');
    expect(mockExecutor).toHaveBeenCalled();
    expect(result).toBe(1);
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toEqual('DELETE FROM app.network_tags WHERE bssid = $1');
    expect(params).toEqual(['AA:BB:CC']);
  });

  test('deleteNetworkTag returns 0 if rowCount is missing', async () => {
    mockExecutor.mockResolvedValueOnce({ rowCount: null });

    const result = await deleteNetworkTag(mockExecutor, 'AA:BB:CC');
    expect(result).toBe(0);
  });

  test('requestWigleLookup flags lookup requested', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ bssid: 'AA:BB:CC', wigle_lookup_requested: true }],
    });

    const result = await requestWigleLookup(mockExecutor, 'AA:BB:CC');
    expect(mockExecutor).toHaveBeenCalled();
    expect(result.wigle_lookup_requested).toBe(true);
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain('UPDATE app.network_tags');
    expect(sql).toContain('SET wigle_lookup_requested = true, updated_at = NOW()');
    expect(sql).toContain('WHERE bssid = $1 RETURNING *');
    expect(params).toEqual(['AA:BB:CC']);
  });

  test('markNetworkInvestigate inserts investigate tag with RETURNING *', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ bssid: 'AA:BB:CC', threat_tag: 'INVESTIGATE' }],
    });

    const result = await markNetworkInvestigate(mockExecutor, 'AA:BB:CC');
    expect(mockExecutor).toHaveBeenCalled();
    expect(result.threat_tag).toBe('INVESTIGATE');
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain('INSERT INTO app.network_tags');
    expect(sql).toContain('(bssid, threat_tag, tags, wigle_lookup_requested, updated_at)');
    expect(sql).toContain("VALUES ($1, 'INVESTIGATE', '[\"investigate\"]'::jsonb, TRUE, NOW())");
    expect(sql).toContain('ON CONFLICT (bssid) DO UPDATE SET');
    expect(sql).toContain(
      "WHEN app.network_tags.threat_tag IN ('THREAT', 'SUSPECT', 'FALSE_POSITIVE')"
    );
    expect(sql).toContain('tags = CASE');
    expect(sql).toContain(
      "WHEN COALESCE(app.network_tags.tags, '[]'::jsonb) @> '[\"investigate\"]'::jsonb"
    );
    expect(sql).toContain(
      "ELSE COALESCE(app.network_tags.tags, '[]'::jsonb) || '[\"investigate\"]'::jsonb"
    );
    expect(sql).toContain('RETURNING *');
    expect(params).toEqual(['AA:BB:CC']);
  });

  test('fetchNetworksPendingWigleLookup returns rows', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ bssid: 'AA:BB:CC' }, { bssid: 'DD:EE:FF' }],
    });

    const result = await fetchNetworksPendingWigleLookup(mockExecutor, 5);
    expect(mockExecutor).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain('SELECT bssid FROM app.network_tags');
    expect(sql).toContain('WHERE wigle_lookup_requested = true AND wigle_result IS NULL');
    expect(sql).toContain('ORDER BY updated_at ASC LIMIT $1');
    expect(params).toEqual([5]);
  });

  test('exportMLTrainingSet returns rows', async () => {
    mockExecutor.mockResolvedValueOnce({
      rows: [{ bssid: 'AA:BB:CC', threat_tag: 'THREAT', ssid: 'TargetNet' }],
    });

    const result = await exportMLTrainingSet(mockExecutor);
    expect(mockExecutor).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].ssid).toBe('TargetNet');
    const [sql, params] = mockExecutor.mock.calls[0];
    expect(sql).toContain('SELECT');
    expect(sql).toContain(
      'nt.bssid, nt.threat_tag, nt.threat_confidence, nt.is_ignored, nt.tag_history'
    );
    expect(sql).toContain(
      'n.ssid, n.type as network_type, n.frequency, n.capabilities, n.bestlevel as signal_dbm'
    );
    expect(sql).toContain('COUNT(o.id) as observation_count');
    expect(sql).toContain('COUNT(DISTINCT DATE(o.observed_at)) as unique_days');
    expect(sql).toContain('ST_Distance(');
    expect(sql).toContain('ST_MakePoint(MIN(o.lon), MIN(o.lat))::geography');
    expect(sql).toContain('ST_MakePoint(MAX(o.lon), MAX(o.lat))::geography');
    expect(sql).toContain('/ 1000.0 as distance_range_km');
    expect(sql).toContain('FROM app.network_tags nt');
    expect(sql).toContain('LEFT JOIN app.networks n ON nt.bssid = n.bssid');
    expect(sql).toContain('LEFT JOIN app.observations o ON nt.bssid = o.bssid');
    expect(sql).toContain('WHERE nt.threat_tag IS NOT NULL');
    expect(sql).toContain('GROUP BY nt.bssid, nt.threat_tag, nt.threat_confidence, nt.is_ignored');
    expect(sql).toContain('ORDER BY nt.updated_at DESC');
    expect(params).toBeUndefined();
  });

  test('verifies aliases point to original functions', () => {
    expect(getNetworksPendingWigleLookup).toBe(fetchNetworksPendingWigleLookup);
    expect(exportMLTrainingData).toBe(exportMLTrainingSet);
  });
});
