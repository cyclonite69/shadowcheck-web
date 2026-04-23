import { Pool } from 'pg';
import { OfficeRecord } from './types';

export class OfficeLoader {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async upsertOffice(office: OfficeRecord): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO app.agency_offices (
        agency, office_type, name, parent_office, address_line_1, address_line_2,
        city, state, postal_code, phone, website, jurisdiction, geom,
        source_url, source_retrieved_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        ST_SetSRID(ST_MakePoint($14, $13), 4326), $15, $16
      )
      ON CONFLICT (agency, name) DO UPDATE SET
        address_line_1 = EXCLUDED.address_line_1,
        address_line_2 = EXCLUDED.address_line_2,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        postal_code = EXCLUDED.postal_code,
        phone = EXCLUDED.phone,
        website = EXCLUDED.website,
        jurisdiction = EXCLUDED.jurisdiction,
        geom = EXCLUDED.geom,
        source_url = EXCLUDED.source_url,
        source_retrieved_at = EXCLUDED.source_retrieved_at
      `,
      [
        office.agency,
        office.officeType,
        office.name,
        office.parentOffice,
        office.addressLine1,
        office.addressLine2,
        office.city,
        office.state,
        office.postalCode,
        office.phone,
        office.website,
        office.jurisdiction,
        office.longitude,
        office.latitude,
        office.sourceUrl,
        office.sourceRetrievedAt,
      ]
    );
  }
}
