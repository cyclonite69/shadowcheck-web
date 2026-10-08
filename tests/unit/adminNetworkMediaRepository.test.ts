export {};

jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));

const { query } = require('../../server/src/config/database');
const { adminQuery } = require('../../server/src/services/adminDbService');
const repository = require('../../server/src/repositories/adminNetworkMediaRepository');

describe('adminNetworkMediaRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  it('inserts network media with EXIF and thumbnail fields', async () => {
    const row = { id: 5, filename: 'evidence.jpg' };
    adminQuery.mockResolvedValueOnce({ rows: [row] });
    query.mockResolvedValueOnce({ rows: [] });
    const media = Buffer.from('full');
    const thumbnail = Buffer.from('thumb');

    await expect(
      repository.insertNetworkMedia(
        'AA:BB:CC:DD:EE:FF',
        'image',
        'evidence.jpg',
        2048,
        'image/jpeg',
        media,
        'front door',
        40.1,
        -75.2,
        '2026-06-13T00:00:00Z',
        thumbnail
      )
    ).resolves.toEqual(row);
    expect(adminQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO app.network_media'),
      [
        'AA:BB:CC:DD:EE:FF',
        'image',
        'evidence.jpg',
        2048,
        'image/jpeg',
        media,
        'front door',
        40.1,
        -75.2,
        '2026-06-13T00:00:00Z',
        thumbnail,
        null,
        require('crypto').createHash('sha256').update(media).digest('hex'),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]
    );
  });

  it('inserts network media with observation_id', async () => {
    const row = { id: 6, filename: 'evidence2.jpg' };
    adminQuery.mockResolvedValueOnce({ rows: [row] });
    const media = Buffer.from('full');
    const thumbnail = Buffer.from('thumb');

    await expect(
      repository.insertNetworkMedia(
        'AA:BB:CC:DD:EE:FF',
        'image',
        'evidence2.jpg',
        2048,
        'image/jpeg',
        media,
        'front door',
        40.1,
        -75.2,
        '2026-06-13T00:00:00Z',
        thumbnail,
        12345
      )
    ).resolves.toEqual(row);
    expect(adminQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO app.network_media'),
      [
        'AA:BB:CC:DD:EE:FF',
        'image',
        'evidence2.jpg',
        2048,
        'image/jpeg',
        media,
        'front door',
        40.1,
        -75.2,
        '2026-06-13T00:00:00Z',
        thumbnail,
        12345,
        require('crypto').createHash('sha256').update(media).digest('hex'),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]
    );
  });

  it('throws VISINT_DUPLICATE_MEDIA if media hash already exists prior to insert', async () => {
    const media = Buffer.from('duplicate-content');
    const hash = require('crypto').createHash('sha256').update(media).digest('hex');

    // Mock the duplicate SELECT query returning an existing record
    query.mockResolvedValueOnce({ rows: [{ id: 999 }] });

    await expect(
      repository.insertNetworkMedia(
        'AA:BB:CC:DD:EE:FF',
        'image',
        'evidence.jpg',
        2048,
        'image/jpeg',
        media
      )
    ).rejects.toMatchObject({
      code: 'VISINT_DUPLICATE_MEDIA',
      existingId: 999,
      message: 'Duplicate media content',
    });

    // Ensure the insert query is skipped
    expect(adminQuery).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(
      'SELECT id FROM app.network_media WHERE image_sha256 = $1 LIMIT 1',
      [hash]
    );
  });

  it('translates 23505 unique_violation from concurrent insert into VISINT_DUPLICATE_MEDIA', async () => {
    const media = Buffer.from('race-content');

    // 1. Initial select returns empty (not found yet)
    query.mockResolvedValueOnce({ rows: [] });

    // 2. Insert throws 23505
    const duplicateError: any = new Error('duplicate key value');
    duplicateError.code = '23505';
    adminQuery.mockRejectedValueOnce(duplicateError);

    // 3. Follow-up select finds the concurrently inserted row
    query.mockResolvedValueOnce({ rows: [{ id: 1000 }] });

    await expect(
      repository.insertNetworkMedia(
        'AA:BB:CC:DD:EE:FF',
        'image',
        'evidence.jpg',
        2048,
        'image/jpeg',
        media
      )
    ).rejects.toMatchObject({
      code: 'VISINT_DUPLICATE_MEDIA',
      existingId: 1000,
      message: 'Duplicate media content',
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(adminQuery).toHaveBeenCalledTimes(1);
  });

  describe('insertNetworkMedia with a transactional client', () => {
    const args = ['AA:BB:CC:DD:EE:FF', 'image', 'evidence.jpg', 2048, 'image/jpeg'] as const;

    it('uses a unique savepoint per invocation and releases it after each successful INSERT', async () => {
      const client = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // first duplicate pre-check
          .mockResolvedValueOnce({ rows: [] }) // first SAVEPOINT
          .mockResolvedValueOnce({ rows: [{ id: 7 }] }) // first INSERT
          .mockResolvedValueOnce({ rows: [] }) // first RELEASE SAVEPOINT
          .mockResolvedValueOnce({ rows: [] }) // second duplicate pre-check
          .mockResolvedValueOnce({ rows: [] }) // second SAVEPOINT
          .mockResolvedValueOnce({ rows: [{ id: 8 }] }) // second INSERT
          .mockResolvedValueOnce({ rows: [] }), // second RELEASE SAVEPOINT
      };

      await expect(
        repository.insertNetworkMedia(
          ...args,
          Buffer.from('tx-media'),
          'd',
          ...Array(13).fill(null), // exifLat..timestampSource
          client
        )
      ).resolves.toEqual({ id: 7 });
      await expect(
        repository.insertNetworkMedia(
          ...args,
          Buffer.from('tx-media-second'),
          'd',
          ...Array(13).fill(null),
          client
        )
      ).resolves.toEqual({ id: 8 });

      const sql = client.query.mock.calls.map((c: any[]) => c[0] as string);
      expect(sql[0]).toContain('SELECT id FROM app.network_media');
      expect(sql[1]).toMatch(/^SAVEPOINT insert_network_media_[a-f0-9]{32}$/);
      expect(sql[2]).toContain('INSERT INTO app.network_media');
      expect(sql[3]).toBe(`RELEASE SAVEPOINT ${sql[1].slice('SAVEPOINT '.length)}`);
      expect(sql[5]).toMatch(/^SAVEPOINT insert_network_media_[a-f0-9]{32}$/);
      expect(sql[5]).not.toBe(sql[1]);
      expect(sql[6]).toContain('INSERT INTO app.network_media');
      expect(sql[7]).toBe(`RELEASE SAVEPOINT ${sql[5].slice('SAVEPOINT '.length)}`);
      expect(query).not.toHaveBeenCalled();
      expect(adminQuery).not.toHaveBeenCalled();
    });

    it('rolls back before duplicate recovery SELECT, releases the savepoint, and preserves duplicate details', async () => {
      const duplicateError: any = new Error('duplicate key value');
      duplicateError.code = '23505';
      const client = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // duplicate pre-check
          .mockResolvedValueOnce({ rows: [] }) // SAVEPOINT
          .mockRejectedValueOnce(duplicateError) // INSERT
          .mockResolvedValueOnce({ rows: [] }) // ROLLBACK TO SAVEPOINT
          .mockResolvedValueOnce({ rows: [{ id: 1000 }] }) // recovery SELECT
          .mockResolvedValueOnce({ rows: [] }), // RELEASE SAVEPOINT
      };

      await expect(
        repository.insertNetworkMedia(
          ...args,
          Buffer.from('tx-race'),
          'd',
          ...Array(13).fill(null), // exifLat..timestampSource
          client
        )
      ).rejects.toMatchObject({
        code: 'VISINT_DUPLICATE_MEDIA',
        existingId: 1000,
        message: 'Duplicate media content',
      });

      const sql = client.query.mock.calls.map((c: any[]) => c[0] as string);
      expect(sql[1]).toMatch(/^SAVEPOINT insert_network_media_[a-f0-9]{32}$/);
      const savepoint = sql[1].slice('SAVEPOINT '.length);
      expect(sql[3]).toBe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      expect(sql[4]).toContain('SELECT id FROM app.network_media');
      expect(sql[5]).toBe(`RELEASE SAVEPOINT ${savepoint}`);
      expect(query).not.toHaveBeenCalled();
      expect(adminQuery).not.toHaveBeenCalled();
    });

    it('preserves duplicate-media behavior when rollback to savepoint fails', async () => {
      const duplicateError: any = new Error('duplicate key value');
      duplicateError.code = '23505';
      const client = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // duplicate pre-check
          .mockResolvedValueOnce({ rows: [] }) // SAVEPOINT
          .mockRejectedValueOnce(duplicateError) // INSERT
          .mockRejectedValueOnce(new Error('rollback failed')), // ROLLBACK TO SAVEPOINT
      };

      await expect(
        repository.insertNetworkMedia(
          ...args,
          Buffer.from('tx-rollback-failure'),
          'd',
          ...Array(13).fill(null),
          client
        )
      ).rejects.toMatchObject({
        code: 'VISINT_DUPLICATE_MEDIA',
        message: 'Duplicate media content',
      });

      expect(client.query).toHaveBeenCalledTimes(4);
      expect(query).not.toHaveBeenCalled();
      expect(adminQuery).not.toHaveBeenCalled();
    });

    it('does not let savepoint release failure replace the duplicate-media error', async () => {
      const duplicateError: any = new Error('duplicate key value');
      duplicateError.code = '23505';
      const client = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // duplicate pre-check
          .mockResolvedValueOnce({ rows: [] }) // SAVEPOINT
          .mockRejectedValueOnce(duplicateError) // INSERT
          .mockResolvedValueOnce({ rows: [] }) // ROLLBACK TO SAVEPOINT
          .mockResolvedValueOnce({ rows: [{ id: 1001 }] }) // recovery SELECT
          .mockRejectedValueOnce(new Error('release failed')), // RELEASE SAVEPOINT
      };

      await expect(
        repository.insertNetworkMedia(
          ...args,
          Buffer.from('tx-release-failure'),
          'd',
          ...Array(13).fill(null),
          client
        )
      ).rejects.toMatchObject({
        code: 'VISINT_DUPLICATE_MEDIA',
        existingId: 1001,
        message: 'Duplicate media content',
      });

      const sql = client.query.mock.calls.map((c: any[]) => c[0] as string);
      expect(sql[3]).toMatch(/^ROLLBACK TO SAVEPOINT insert_network_media_[a-f0-9]{32}$/);
      expect(sql[4]).toContain('SELECT id FROM app.network_media');
      expect(sql[5]).toBe(`RELEASE SAVEPOINT ${sql[3].slice('ROLLBACK TO SAVEPOINT '.length)}`);
      expect(query).not.toHaveBeenCalled();
      expect(adminQuery).not.toHaveBeenCalled();
    });
  });

  it('lists network media rows', async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    query.mockResolvedValueOnce({ rows });

    await expect(repository.selectNetworkMediaList('AA:BB:CC:DD:EE:FF')).resolves.toEqual(rows);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at DESC'), [
      'AA:BB:CC:DD:EE:FF',
    ]);
  });

  it('selects full media and returns null when it is missing', async () => {
    const row = {
      filename: 'evidence.jpg',
      mime_type: 'image/jpeg',
      media_data: Buffer.from('full'),
      thumbnail: Buffer.from('thumb'),
    };
    query.mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rows: [] });

    await expect(repository.selectNetworkMediaFile('42')).resolves.toEqual(row);
    await expect(repository.selectNetworkMediaFile('43')).resolves.toBeNull();
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('media_data, thumbnail'), [
      '42',
    ]);
  });

  it('selects thumbnail-only data and returns null when absent', async () => {
    const row = { mime_type: 'image/jpeg', thumbnail: Buffer.from('thumb') };
    query.mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rows: [] });

    await expect(repository.selectNetworkMediaThumbnail('42')).resolves.toEqual(row);
    await expect(repository.selectNetworkMediaThumbnail('43')).resolves.toBeNull();
    expect(query).toHaveBeenNthCalledWith(
      1,
      'SELECT mime_type, thumbnail FROM app.network_media WHERE id = $1',
      ['42']
    );
  });

  it('selects unmatched media only when both EXIF coordinates are present', async () => {
    const rows = [
      {
        id: '42',
        bssid: 'VISINT_UNMATCHED',
        filename: 'field.jpg',
        exif_lat: '43.02',
        exif_lon: '-83.69',
      },
    ];
    query.mockResolvedValueOnce({ rows });

    await expect(repository.selectUnmatchedMediaPoints()).resolves.toBe(rows);

    const [sql, params] = query.mock.calls[0];
    expect(params).toBeUndefined();
    expect(sql).toContain("WHERE bssid = 'VISINT_UNMATCHED'");
    expect(sql).toContain('AND exif_lat IS NOT NULL');
    expect(sql).toContain('AND exif_lon IS NOT NULL');
    expect(sql).toContain('ORDER BY exif_captured_at DESC, id DESC');
  });

  it('inserts and selects legacy network notations', async () => {
    adminQuery.mockResolvedValueOnce({ rows: [{ notation: { text: 'seen' } }] });
    query
      .mockResolvedValueOnce({ rows: [{ detailed_notes: [{ text: 'seen' }] }] })
      .mockResolvedValueOnce({ rows: [{ detailed_notes: null }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      repository.insertNetworkNotation('AA:BB:CC:DD:EE:FF', 'seen', 'investigation')
    ).resolves.toEqual({ text: 'seen' });
    await expect(repository.selectNetworkNotations('AA:BB:CC:DD:EE:FF')).resolves.toEqual([
      { text: 'seen' },
    ]);
    await expect(repository.selectNetworkNotations('AA:BB:CC:DD:EE:00')).resolves.toEqual([]);
    await expect(repository.selectNetworkNotations('AA:BB:CC:DD:EE:01')).resolves.toEqual([]);
  });

  it('upserts a normalized network note and returns its id', async () => {
    adminQuery.mockResolvedValueOnce({ rows: [{ note_id: '17' }] });

    await expect(
      repository.insertNetworkNote('aa:bb:cc:dd:ee:ff', 'content', 'general', 'admin')
    ).resolves.toBe('17');
    expect(adminQuery).toHaveBeenCalledWith(expect.stringContaining('WITH latest AS'), [
      'AA:BB:CC:DD:EE:FF',
      'content',
      'general',
      'admin',
    ]);
  });

  it('selects notes with attachment aggregates', async () => {
    const rows = [{ id: 17, attachment_count: 2, image_count: 1 }];
    query.mockResolvedValueOnce({ rows });

    await expect(repository.selectNetworkNotes('AA:BB:CC:DD:EE:FF')).resolves.toEqual(rows);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN LATERAL'), [
      'AA:BB:CC:DD:EE:FF',
    ]);
  });

  it('hard-deletes a note and returns its BSSID or null', async () => {
    adminQuery
      .mockResolvedValueOnce({ rows: [{ bssid: 'AA:BB:CC:DD:EE:FF' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(repository.deleteNetworkNote('17')).resolves.toBe('AA:BB:CC:DD:EE:FF');
    await expect(repository.deleteNetworkNote('18')).resolves.toBeNull();
    expect(adminQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DELETE FROM app.network_notes'),
      ['17']
    );
    expect(adminQuery.mock.calls[0][0]).not.toContain('is_deleted');
  });

  it('returns an updated note or null', async () => {
    const row = { id: 17, content: 'updated' };
    adminQuery.mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rows: [] });

    await expect(repository.updateNetworkNoteContent('17', 'updated')).resolves.toEqual(row);
    await expect(repository.updateNetworkNoteContent('18', 'updated')).resolves.toBeNull();
  });

  it('returns a note by id or null', async () => {
    const row = { id: 17, bssid: 'AA:BB:CC:DD:EE:FF' };
    query.mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rows: [] });

    await expect(repository.selectNetworkNoteById('17')).resolves.toEqual(row);
    await expect(repository.selectNetworkNoteById('18')).resolves.toBeNull();
  });

  it('inserts database-resident note media bytes', async () => {
    const row = { id: 21, note_id: 17 };
    adminQuery.mockResolvedValueOnce({ rows: [row] });
    const mediaData = Buffer.from('image bytes');

    await expect(
      repository.insertNoteMedia(
        '17',
        'AA:BB:CC:DD:EE:FF',
        'file.jpg',
        128,
        'image',
        mediaData,
        'image/jpeg'
      )
    ).resolves.toEqual(row);
    const [sql, params] = adminQuery.mock.calls[0];
    expect(sql).toContain('media_data');
    expect(sql).not.toMatch(/file_path|storage_backend/);
    expect(params).toEqual([
      '17',
      'AA:BB:CC:DD:EE:FF',
      'file.jpg',
      128,
      'image',
      mediaData,
      'image/jpeg',
    ]);
    expect(adminQuery.mock.invocationCallOrder[0]).toBeGreaterThan(0);
  });

  it('selects note media records and lists note attachments', async () => {
    const media = { id: 21, note_id: 17 };
    const list = [media, { id: 22, note_id: 17 }];
    query
      .mockResolvedValueOnce({ rows: [media] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: list });

    await expect(repository.selectNoteMediaById('21')).resolves.toEqual(media);
    await expect(repository.selectNoteMediaById('99')).resolves.toBeNull();
    await expect(repository.selectNoteMediaList('17')).resolves.toEqual(list);
    await expect(repository.selectNoteMediaList('18')).resolves.toEqual([]);
    expect(query).toHaveBeenNthCalledWith(4, expect.stringContaining('FROM app.note_media'), [
      '18',
    ]);
    expect(query).toHaveBeenNthCalledWith(3, expect.stringContaining('ORDER BY created_at DESC'), [
      '17',
    ]);
  });

  it('returns an empty attachment list for the current empty-table state', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(repository.selectNoteMediaList('18')).resolves.toEqual([]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM app.note_media'), ['18']);
  });

  it('returns deleted note media metadata or null', async () => {
    const deleted = { id: 21, note_id: 17, file_name: 'file.jpg' };
    adminQuery.mockResolvedValueOnce({ rows: [deleted] }).mockResolvedValueOnce({ rows: [] });

    await expect(repository.deleteNoteMedia('21')).resolves.toEqual(deleted);
    await expect(repository.deleteNoteMedia('99')).resolves.toBeNull();
  });

  describe('selectRelatedNetworkMediaForBssid', () => {
    const BSSID = 'AA:BB:CC:DD:EE:FF';
    const directRow = {
      id: 11,
      requested_bssid: BSSID,
      source_bssid: BSSID,
      observation_id: null,
      media_type: 'image',
      filename: 'photo.jpg',
      mime_type: 'image/jpeg',
      file_size: 1024,
      created_at: new Date('2026-06-12'),
      exif_captured_at: null,
      is_direct: true,
      source_kind: 'direct',
    };

    test('returns direct media when view does not exist (singleton fallback)', async () => {
      // to_regclass returns null → view absent
      query
        .mockResolvedValueOnce({ rows: [{ oid: null }] }) // to_regclass check
        .mockResolvedValueOnce({ rows: [directRow] }); // direct query

      const result = await repository.selectRelatedNetworkMediaForBssid(BSSID);
      expect(result).toEqual([directRow]);
      // First query is the guard; second is the direct-only SELECT
      expect(query).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("to_regclass('app.v_sibling_group_media')"),
        []
      );
      expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('FROM app.network_media'), [
        BSSID,
      ]);
    });

    test('returns direct media for singleton BSSID when view exists but has no component rows', async () => {
      // to_regclass returns non-null → view present
      query
        .mockResolvedValueOnce({ rows: [{ oid: 'app.v_sibling_group_media' }] })
        .mockResolvedValueOnce({ rows: [directRow] }); // combined CTE returns direct only

      const result = await repository.selectRelatedNetworkMediaForBssid(BSSID);
      expect(result).toEqual([directRow]);
    });

    test('component media uses record_type = media filter (not notes)', async () => {
      const componentRow = {
        id: 42,
        requested_bssid: BSSID,
        source_bssid: 'BB:CC:DD:EE:FF:00',
        observation_id: 7,
        media_type: 'image',
        filename: 'sibling.jpg',
        mime_type: 'image/jpeg',
        file_size: 2048,
        created_at: new Date('2026-06-11'),
        exif_captured_at: null,
        is_direct: false,
        source_kind: 'component',
      };

      query
        .mockResolvedValueOnce({ rows: [{ oid: 'app.v_sibling_group_media' }] })
        .mockResolvedValueOnce({ rows: [directRow, componentRow] });

      const result = await repository.selectRelatedNetworkMediaForBssid(BSSID);
      expect(result).toHaveLength(2);
      // Verify the query includes record_type = 'media' guard
      expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("record_type = 'media'"), [
        BSSID,
      ]);
    });

    test('note rows from v_sibling_group_media cannot collide — record_type filter excludes them', async () => {
      // The query filters sgm.record_type = 'media', so a note row with the same id
      // as a media row can never appear in results. We verify this by checking the SQL
      // contains the guard — not by simulating a note row leaking through, which the
      // DB itself would prevent.
      query
        .mockResolvedValueOnce({ rows: [{ oid: 'app.v_sibling_group_media' }] })
        .mockResolvedValueOnce({ rows: [directRow] });

      await repository.selectRelatedNetworkMediaForBssid(BSSID);
      const combinedSql = (query as jest.Mock).mock.calls[1][0] as string;
      expect(combinedSql).toContain("record_type = 'media'");
      // Confirm notes are not referenced in the component CTE
      expect(combinedSql).not.toContain('note_content');
      expect(combinedSql).not.toContain('app.network_notes');
    });

    test('direct rows win deduplication — is_direct DESC ordering', async () => {
      // When the same media id appears in both direct and component CTEs,
      // the ranked CTE keeps the direct row (rn = 1 on is_direct DESC).
      // Mock returns only the direct row (DB already de-duped via ranked CTE).
      query
        .mockResolvedValueOnce({ rows: [{ oid: 'app.v_sibling_group_media' }] })
        .mockResolvedValueOnce({ rows: [directRow] });

      const result = await repository.selectRelatedNetworkMediaForBssid(BSSID);
      expect(result).toHaveLength(1);
      expect(result[0].is_direct).toBe(true);
      expect(result[0].source_kind).toBe('direct');
      // Verify dedup mechanism is in the SQL
      const sql = (query as jest.Mock).mock.calls[1][0] as string;
      expect(sql).toContain('ORDER BY is_direct DESC');
      expect(sql).toContain('PARTITION BY id');
    });

    test('normalises BSSID to uppercase before querying', async () => {
      query.mockResolvedValueOnce({ rows: [{ oid: null }] }).mockResolvedValueOnce({ rows: [] });

      await repository.selectRelatedNetworkMediaForBssid('aa:bb:cc:dd:ee:ff');
      expect(query).toHaveBeenNthCalledWith(2, expect.any(String), ['AA:BB:CC:DD:EE:FF']);
    });
  });

  describe('selectMatchedMediaPoints', () => {
    it('uses sibling component grouping and component_location provenance when mv_sibling_groups exists', async () => {
      const mockRows = [
        {
          component_id: 'AA:BB:CC:DD:EE:FF',
          lat: '43.02',
          lon: '-83.69',
          media_count: 3,
          media_ids: ['10', '11', '12'],
          member_bssids: ['AA:BB:CC:DD:EE:FF', 'AA:BB:CC:DD:EE:FE'],
          location_provenance: 'component_location',
          marker_location_source: 'observation',
          observation_id: 123,
          capture_lat: '43.01',
          capture_lon: '-83.68',
          observation_lat: '43.02',
          observation_lon: '-83.69',
          network_lat: '43.03',
          network_lon: '-83.70',
        },
      ];
      query
        .mockResolvedValueOnce({ rows: [{ oid: 'app.mv_sibling_groups' }] })
        .mockResolvedValueOnce({ rows: mockRows });

      const result = await repository.selectMatchedMediaPoints();
      expect(result).toEqual(mockRows);

      expect(query).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("to_regclass('app.mv_sibling_groups')"),
        []
      );
      const combinedSql = (query as jest.Mock).mock.calls[1][0] as string;
      expect(combinedSql).toContain("nm.bssid != 'VISINT_UNMATCHED'");
      expect(combinedSql).toContain('LEFT JOIN app.mv_sibling_groups');
      expect(combinedSql).toContain('location_provenance');
      expect(combinedSql).toContain('LEFT JOIN app.observations o ON o.id = nm.observation_id');
      expect(combinedSql).not.toContain('COALESCE(o.lat, nm.exif_lat, ne.lat)');
      expect(combinedSql).toContain('WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN o.lat');
      expect(combinedSql).toContain('WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN o.lon');
      expect(combinedSql).toContain(
        "WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN 'observation'"
      );
      expect(combinedSql).toContain('WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN 1');
      expect(combinedSql).toContain('priority_score');
      expect(combinedSql).toContain('ROW_NUMBER() OVER (');
      expect(combinedSql).toContain('PARTITION BY component_id');
      expect(combinedSql).toContain('ORDER BY priority_score ASC');
      expect(combinedSql).toContain('rc.rn = 1');
    });

    it('falls back to linked_network_location provenance when mv_sibling_groups is absent', async () => {
      const mockRows = [
        {
          component_id: 'AA:BB:CC:DD:EE:FF',
          lat: '43.02',
          lon: '-83.69',
          media_count: 1,
          media_ids: ['10'],
          member_bssids: ['AA:BB:CC:DD:EE:FF'],
          location_provenance: 'linked_network_location',
          marker_location_source: 'exif',
          observation_id: null,
          capture_lat: '43.02',
          capture_lon: '-83.69',
          observation_lat: null,
          observation_lon: null,
          network_lat: '43.03',
          network_lon: '-83.70',
        },
      ];
      query
        .mockResolvedValueOnce({ rows: [{ oid: null }] })
        .mockResolvedValueOnce({ rows: mockRows });

      const result = await repository.selectMatchedMediaPoints();
      expect(result).toEqual(mockRows);

      expect(query).toHaveBeenCalledTimes(2);
      const combinedSql = (query as jest.Mock).mock.calls[1][0] as string;
      expect(combinedSql).toContain("nm.bssid != 'VISINT_UNMATCHED'");
      expect(combinedSql).not.toContain('LEFT JOIN app.mv_sibling_groups');
      expect(combinedSql).toContain('location_provenance');
      expect(combinedSql).toContain('LEFT JOIN app.observations o ON o.id = nm.observation_id');
      expect(combinedSql).not.toContain('COALESCE(o.lat, nm.exif_lat, ne.lat)');
      expect(combinedSql).toContain('WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN o.lat');
      expect(combinedSql).toContain('WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN o.lon');
      expect(combinedSql).toContain(
        "WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN 'observation'"
      );
      expect(combinedSql).toContain('WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN 1');
      expect(combinedSql).toContain('priority_score');
      expect(combinedSql).toContain('ROW_NUMBER() OVER (');
      expect(combinedSql).toContain('PARTITION BY component_id');
      expect(combinedSql).toContain('ORDER BY priority_score ASC');
      expect(combinedSql).toContain('rc.rn = 1');
    });
  });
});
