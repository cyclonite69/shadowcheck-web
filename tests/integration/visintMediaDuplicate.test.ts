import request from 'supertest';
import express from 'express';
import { query } from '../../server/src/config/database';
const adminMediaRouter = require('../../server/src/api/routes/v1/admin/media');

describe('VisINT Media Duplicate Prevention & Deletion (Integration)', () => {
  const BSSID = '11:22:33:44:55:66';
  const IMAGE_CONTENT_1 = Buffer.from('test-image-content-1');
  const IMAGE_CONTENT_2 = Buffer.from('test-image-content-2');
  const VIDEO_CONTENT = Buffer.from('test-video-content');
  const createdMediaIds = new Set<string>();
  const createdObservationIds = new Set<string>();
  let createdNetwork = false;

  let app: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api', adminMediaRouter);

    const existingNetwork = await query('SELECT bssid FROM app.networks WHERE bssid = $1', [BSSID]);
    if (existingNetwork.rows.length === 0) {
      const insertedNetwork = await query(
        `INSERT INTO app.networks
       (bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid, lasttime_ms, lastlat, lastlon, bestlevel, bestlat, bestlon)
       VALUES ($1, 'Test Network', 'W', 2437, '', '', '', 0, ${Date.now()}, 40.7128, -74.0060, -45, 40.7128, -74.0060)
       ON CONFLICT (bssid) DO NOTHING
       RETURNING bssid`,
        [BSSID]
      );
      createdNetwork = insertedNetwork.rows.length > 0;
    }
  });

  afterAll(async () => {
    if (createdMediaIds.size > 0) {
      await query('DELETE FROM app.network_media WHERE id = ANY($1::bigint[])', [
        Array.from(createdMediaIds),
      ]);
    }
    if (createdObservationIds.size > 0) {
      await query('DELETE FROM app.observations WHERE id = ANY($1::bigint[])', [
        Array.from(createdObservationIds),
      ]);
    }
    if (createdNetwork) {
      await query('DELETE FROM app.networks WHERE bssid = $1', [BSSID]);
    }
  });

  // Tests for Requirements 1, 2, 3, 4, 5, 8, 9, 10
  it('1 & 3: Uploads new image successfully, rejects exact duplicate', async () => {
    // 1. Upload new image
    const res1 = await request(app)
      .post('/api/admin/network-media/upload')
      .send({
        bssid: BSSID,
        media_type: 'image',
        filename: 'img1.jpg',
        media_data_base64: IMAGE_CONTENT_1.toString('base64'),
        description: 'Test Image 1',
      });
    expect(res1.status).toBe(200);
    expect(res1.body.ok).toBe(true);
    const mediaId1 = res1.body.media.id;
    createdMediaIds.add(String(mediaId1));

    // 3. Reject duplicate image
    const res2 = await request(app)
      .post('/api/admin/network-media/upload')
      .send({
        bssid: BSSID,
        media_type: 'image',
        filename: 'img1.jpg',
        media_data_base64: IMAGE_CONTENT_1.toString('base64'),
        description: 'Test Image 1 Copy',
      });
    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('VISINT_DUPLICATE_MEDIA');

    // 5. Reject duplicate with different filename
    const res3 = await request(app)
      .post('/api/admin/network-media/upload')
      .send({
        bssid: BSSID,
        media_type: 'image',
        filename: 'different_name.jpg',
        media_data_base64: IMAGE_CONTENT_1.toString('base64'),
        description: 'Test Image 1 Diff Name',
      });
    expect(res3.status).toBe(409);
    expect(res3.body.error.code).toBe('VISINT_DUPLICATE_MEDIA');

    // 8. Attachment can be deleted
    const resDel = await request(app).delete(`/api/admin/network-media/media/${mediaId1}`);
    expect(resDel.status).toBe(200);

    // 9. After deletion, media is no longer attached
    const resGet = await request(app).get(`/api/admin/network-media/download/${mediaId1}`);
    expect(resGet.status).toBe(404);

    // 10. Previously deleted media can be re-attached
    const res4 = await request(app)
      .post('/api/admin/network-media/upload')
      .send({
        bssid: BSSID,
        media_type: 'image',
        filename: 'img1_reupload.jpg',
        media_data_base64: IMAGE_CONTENT_1.toString('base64'),
        description: 'Test Image 1 Re-upload',
      });
    expect(res4.status).toBe(200);
    createdMediaIds.add(String(res4.body.media.id));
  });

  it('2 & 4: Uploads new video successfully, rejects duplicate', async () => {
    // 2. Upload video
    const res1 = await request(app)
      .post('/api/admin/network-media/upload')
      .send({
        bssid: BSSID,
        media_type: 'video',
        filename: 'vid1.mp4',
        media_data_base64: VIDEO_CONTENT.toString('base64'),
        description: 'Test Video',
      });
    expect(res1.status).toBe(200);
    createdMediaIds.add(String(res1.body.media.id));

    // 4. Reject duplicate video
    const res2 = await request(app)
      .post('/api/admin/network-media/upload')
      .send({
        bssid: BSSID,
        media_type: 'video',
        filename: 'vid1.mp4',
        media_data_base64: VIDEO_CONTENT.toString('base64'),
        description: 'Test Video Copy',
      });
    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('VISINT_DUPLICATE_MEDIA');
  });

  it('11. Concurrent attempts to upload the same media cannot create duplicate attachments', async () => {
    const payload = {
      bssid: BSSID,
      media_type: 'image',
      filename: 'concurrent.jpg',
      media_data_base64: IMAGE_CONTENT_2.toString('base64'),
      description: 'Concurrent Test',
    };

    // Fire 3 simultaneous requests
    const p1 = request(app).post('/api/admin/network-media/upload').send(payload);
    const p2 = request(app).post('/api/admin/network-media/upload').send(payload);
    const p3 = request(app).post('/api/admin/network-media/upload').send(payload);

    const results = await Promise.all([p1, p2, p3]);

    const successes = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(2);
    createdMediaIds.add(String(successes[0].body.media.id));
  });

  it('Same filename but different content succeeds', async () => {
    // Upload image with 'vid1.mp4' filename but different content
    const res = await request(app)
      .post('/api/admin/network-media/upload')
      .send({
        bssid: BSSID,
        media_type: 'video',
        filename: 'vid1.mp4',
        media_data_base64: Buffer.from('different-content').toString('base64'),
        description: 'Test Video Different Content',
      });
    expect(res.status).toBe(200);
    createdMediaIds.add(String(res.body.media.id));
  });

  it('Failed deletion returns 404 and does not break', async () => {
    const res = await request(app).delete('/api/admin/network-media/media/99999999');
    expect(res.status).toBe(404);
  });

  it('Duplicate identification works', async () => {
    const res = await request(app).get('/api/admin/network-media-duplicates');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.duplicates)).toBe(true);
  });

  it('Successful deletion removes media but keeps observation', async () => {
    // 1. Create an observation
    const obsResult = await query(
      `INSERT INTO app.observations (bssid, time, device_id, source_pk, source_tag, level, lat, lon, altitude, accuracy, observed_at_ms, external, mfgrid, geom, time_ms)
       VALUES ($1, NOW(), 'j24', 'test-obs', 'test-source', -50, 0, 0, 0, 0, ${Date.now()}, false, 0, ST_SetSRID(ST_MakePoint(0, 0), 4326), ${Date.now()}) RETURNING id`,
      [BSSID]
    );
    const observationId = obsResult.rows[0].id;
    createdObservationIds.add(String(observationId));

    // 2. Create media row associated with the observation manually
    const mediaResult = await query(
      `INSERT INTO app.network_media (bssid, media_type, filename, media_data, observation_id)
       VALUES ($1, 'image', 'test-del.jpg', '\\xdeadbeef', $2) RETURNING id`,
      [BSSID, observationId]
    );
    const mediaId = mediaResult.rows[0].id;
    createdMediaIds.add(String(mediaId));

    // 3. Confirm it exists in listing
    const checkDb1 = await query('SELECT id FROM app.network_media WHERE id = $1', [mediaId]);
    expect(checkDb1.rows.length).toBe(1);

    // 4. Delete it through the API
    const resDel = await request(app).delete(`/api/admin/network-media/media/${mediaId}`);
    expect(resDel.status).toBe(200);
    expect(resDel.body.ok).toBe(true);

    // 5. Verify row no longer exists
    const checkDb2 = await query('SELECT id FROM app.network_media WHERE id = $1', [mediaId]);
    expect(checkDb2.rows.length).toBe(0);

    // 6. Verify observation still exists
    const obsCheck = await query('SELECT id FROM app.observations WHERE id = $1', [observationId]);
    expect(obsCheck.rows.length).toBe(1);

    // 7. Reattach same media successfully
    const resRe = await request(app)
      .post('/api/admin/network-media/upload')
      .send({
        bssid: BSSID,
        media_type: 'image',
        filename: 'test-del.jpg',
        media_data_base64: Buffer.from('different-content-del').toString('base64'),
        description: 'Re-upload test',
      });
    expect(resRe.status).toBe(200);
    createdMediaIds.add(String(resRe.body.media.id));
  });

  it('Duplicate manager deletion path', async () => {
    // Temporarily disable the trigger to insert legacy duplicates
    // This intentionally simulates pre-existing legacy data, not bypassing production behavior.
    await query('ALTER TABLE app.network_media DISABLE TRIGGER network_media_prevent_duplicate');
    let mediaResult1, mediaResult2;
    try {
      // Insert two identical media manually
      mediaResult1 = await query(
        `INSERT INTO app.network_media (bssid, media_type, filename, media_data)
         VALUES ('11:22:33:44:55:66', 'image', 'dup-manager-1.jpg', '\\xbeefbeef') RETURNING id`
      );
      mediaResult2 = await query(
        `INSERT INTO app.network_media (bssid, media_type, filename, media_data)
         VALUES ('11:22:33:44:55:66', 'image', 'dup-manager-2.jpg', '\\xbeefbeef') RETURNING id`
      );
    } finally {
      // Always ensure the trigger is re-enabled even if setup fails
      await query('ALTER TABLE app.network_media ENABLE TRIGGER network_media_prevent_duplicate');
    }

    const id1 = mediaResult1.rows[0].id;
    const id2 = mediaResult2.rows[0].id;
    createdMediaIds.add(String(id1));
    createdMediaIds.add(String(id2));

    // Discover duplicate groups
    const resList = await request(app).get('/api/admin/network-media-duplicates');
    expect(resList.status).toBe(200);
    const dupGroup = resList.body.duplicates.find((g: any) => g.ids.includes(id1));
    expect(dupGroup).toBeDefined();
    expect(dupGroup.ids).toContain(id1);
    expect(dupGroup.ids).toContain(id2);
    expect(Number(dupGroup.count)).toBe(2);

    // Delete one selected duplicate
    const resDel = await request(app).delete(`/api/admin/network-media/media/${id1}`);
    expect(resDel.status).toBe(200);

    // Refresh state and show remaining media correctly
    const resList2 = await request(app).get('/api/admin/network-media-duplicates');
    expect(resList2.status).toBe(200);
    const dupGroup2 = resList2.body.duplicates.find((g: any) => g.ids.includes(id2));
    // Since only 1 remains, it is no longer a duplicate group!
    expect(dupGroup2).toBeUndefined();
  });
});
