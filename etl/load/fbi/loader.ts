import { Pool } from 'pg';
import { OfficeRecord } from './types';

export class OfficeLoader {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async upsertOffice(office: OfficeRecord): Promise<void> {
    const sql = `
      INSERT INTO app.agency_offices (
        agency,
        office_type,
        name,
        parent_office,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        phone,
        website,
        jurisdiction,
        latitude,
        longitude,
        geom,
        source_url,
        source_retrieved_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        CASE
          WHEN $13::double precision IS NULL OR $14::double precision IS NULL THEN NULL::geography
          ELSE ST_SetSRID(ST_MakePoint($14::double precision, $13::double precision), 4326)::geography
        END,
        $15, $16, NOW()
      )
      ON CONFLICT (agency, name) DO UPDATE SET
        parent_office = EXCLUDED.parent_office,
        address_line_1 = EXCLUDED.address_line_1,
        address_line_2 = EXCLUDED.address_line_2,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        postal_code = EXCLUDED.postal_code,
        phone = EXCLUDED.phone,
        website = EXCLUDED.website,
        jurisdiction = EXCLUDED.jurisdiction,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        geom = EXCLUDED.geom,
        source_url = EXCLUDED.source_url,
        source_retrieved_at = EXCLUDED.source_retrieved_at,
        updated_at = NOW();
    `;

    await this.pool.query(sql, [
      office.agency,
      office.officeType,
      office.name,
      office.parentOffice ?? null,
      office.addressLine1 ?? null,
      office.addressLine2 ?? null,
      office.city ?? null,
      office.state ?? null,
      office.postalCode ?? null,
      office.phone ?? null,
      office.website ?? null,
      office.jurisdiction ?? null,
      office.latitude ?? null,
      office.longitude ?? null,
      office.sourceUrl,
      office.sourceRetrievedAt,
    ]);
  }
}
