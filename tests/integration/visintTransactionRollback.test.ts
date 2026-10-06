import crypto from 'crypto';
import sharp from 'sharp';
import { query } from '../../server/src/config/database';
import { saveVisINTAttachment } from '../../server/src/services/visint/visintPipeline';
import { insertNetworkMedia } from '../../server/src/repositories/adminNetworkMediaRepository';
import { insertNetworkTagWithNotes } from '../../server/src/repositories/adminNetworkTagOuiRepository';

/**
 * Regression: saveVisINTAttachment must be atomic.
 *
 * Failure mode under test: network_media has no FK on bssid, but network_tags has
 * fk_network_tags_bssid -> app.networks(bssid). Attaching to a BSSID absent from
 * app.networks therefore succeeds at the media INSERT and fails at the tag INSERT.
 * Before the fix the media row stayed committed (HTTP 500 + permanent duplicate lockout).
 *
 * Runs only against shadowcheck_test (enforced by tests/setup.ts + globalSetup).
 */
describe('VisINT Transactional Atomicity & Rollback (Regression)', () => {
  const UNSEEDED_BSSID = '02:00:00:00:99:99'; // must NOT exist in app.networks
  const SEEDED_BSSID = '02:00:00:00:99:01'; // created by this suite only
  const runId = crypto.randomUUID();
  const trackedHashes: string[] = [];
  let seededNetwork = false;

  async function uniqueImage(tag: string): Promise<{ buffer: Buffer; hash: string }> {
    const jpeg = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .jpeg()
      .toBuffer();
    const buffer = Buffer.concat([jpeg, Buffer.from(`-${tag}-${runId}`)]);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    trackedHashes.push(hash);
    return { buffer, hash };
  }

  const countMedia = async (hash: string) =>
    (await query('SELECT id FROM app.network_media WHERE image_sha256 = $1', [hash])).rows.length;

  beforeAll(async () => {
    // Never alter pre-existing data: refuse to run if our fixture BSSIDs are already in use.
    const existing = await query(
      `SELECT bssid FROM app.networks WHERE bssid = ANY($1::text[])
       UNION SELECT bssid FROM app.network_tags WHERE bssid = ANY($1::text[])`,
      [[UNSEEDED_BSSID, SEEDED_BSSID]]
    );
    if (existing.rows.length > 0) {
      throw new Error('VisINT rollback fixture BSSIDs already exist; refusing to alter test data.');
    }

    const seeded = await query(
      `INSERT INTO app.networks (
        bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid,
        lasttime_ms, lastlat, lastlon, bestlevel, bestlat, bestlon, is_sentinel
      ) VALUES (
        $1, 'Seeded Test Network', 'W', 2412, '', '', '', 0,
        0, 42.0, -83.0, -50, 42.0, -83.0, false
      ) ON CONFLICT (bssid) DO NOTHING
      RETURNING bssid`,
      [SEEDED_BSSID]
    );
    seededNetwork = seeded.rows.length > 0;
  });

  afterAll(async () => {
    // Hashes are unique per run (random suffix), so this only removes rows created here.
    if (trackedHashes.length > 0) {
      await query('DELETE FROM app.network_media WHERE image_sha256 = ANY($1::text[])', [
        trackedHashes,
      ]);
    }
    if (seededNetwork) {
      await query('DELETE FROM app.network_tags WHERE bssid = $1', [SEEDED_BSSID]);
      await query('DELETE FROM app.networks WHERE bssid = $1', [SEEDED_BSSID]);
    }
  });

  it('A. control: the tag FK failure fires AFTER an autocommitted media insert (documents the pre-fix hazard)', async () => {
    // Non-transactional repository calls (client omitted) autocommit independently.
    // This proves the failure ordering Test B depends on: media INSERT succeeds for an
    // unseeded BSSID, then the tag INSERT fails on fk_network_tags_bssid.
    const { buffer, hash } = await uniqueImage('control');

    await insertNetworkMedia(
      UNSEEDED_BSSID,
      'image',
      'control.jpg',
      buffer.length,
      'image/jpeg',
      buffer,
      'control',
      42.3314,
      -83.0458,
      '2026-05-07T00:29:10.000Z'
    );
    await expect(
      insertNetworkTagWithNotes(UNSEEDED_BSSID, ['VISINT_UNMATCHED'], null)
    ).rejects.toThrow(/fk_network_tags_bssid/);

    expect(await countMedia(hash)).toBe(1); // orphaned: this is the bug the transaction removes
  });

  it('B. saveVisINTAttachment rolls back the media row when the tag insert fails, and a retry is not locked out', async () => {
    const { buffer, hash } = await uniqueImage('rollback');
    expect(await countMedia(hash)).toBe(0);

    const save = (bssid: string) =>
      saveVisINTAttachment(
        buffer,
        'rollback.jpg',
        'image/jpeg',
        bssid,
        'UNMATCHED',
        0,
        null,
        null,
        42.3314,
        -83.0458,
        '2026-05-07T00:29:10.000Z',
        false,
        null,
        null,
        { contentValidated: true }
      );

    await expect(save(UNSEEDED_BSSID)).rejects.toThrow(/fk_network_tags_bssid/);

    // Rollback proof (not just the exception): nothing persisted from the failed attempt.
    expect(await countMedia(hash)).toBe(0);
    const tags = await query('SELECT id FROM app.network_tags WHERE bssid = $1', [UNSEEDED_BSSID]);
    expect(tags.rows.length).toBe(0);

    // Meaningful retry: the same bytes must now be accepted by the real pipeline
    // (previously rejected forever with VISINT_DUPLICATE_MEDIA).
    await expect(save(SEEDED_BSSID)).resolves.toEqual(expect.any(Array));
    expect(await countMedia(hash)).toBe(1);
  });

  it('C. commits media and tags together when the target network exists', async () => {
    const { buffer, hash } = await uniqueImage('success');

    const tagsApplied = await saveVisINTAttachment(
      buffer,
      'success.jpg',
      'image/jpeg',
      SEEDED_BSSID,
      'MATCHED',
      4,
      5.0,
      1.0,
      42.3314,
      -83.0458,
      '2026-05-07T00:29:10.000Z',
      false,
      'FLOCK_SAFETY_CAMERA',
      null,
      { contentValidated: true }
    );
    expect(tagsApplied).toContain('VISINT_VERIFIED');

    const media = await query('SELECT bssid FROM app.network_media WHERE image_sha256 = $1', [
      hash,
    ]);
    expect(media.rows).toHaveLength(1);
    expect(media.rows[0].bssid).toBe(SEEDED_BSSID);

    const tagRow = await query('SELECT tags FROM app.network_tags WHERE bssid = $1', [
      SEEDED_BSSID,
    ]);
    expect(tagRow.rows).toHaveLength(1);
    expect(JSON.stringify(tagRow.rows[0].tags)).toContain('VISINT_VERIFIED');
  });
});
