import { Pool } from 'pg';
import { OfficeLoader } from './loader';
import { normalizeState } from './transformer';
import { fetchPage, getFieldOfficesIndex } from './scraper';
import { OfficeRecord } from './types';

export class FBIImporter {
  private loader: OfficeLoader;

  constructor(pool: Pool) {
    this.loader = new OfficeLoader(pool);
  }

  async importAll() {
    console.log('🚀 Starting FBI location import...');

    const offices = await getFieldOfficesIndex();
    for (const officePath of offices) {
      console.log(`Processing ${officePath}...`);
      // Here we would parse HTML -> OfficeRecord
      // const record = parseOfficePage(await fetchPage(BASE_URL + officePath));
      // record.state = normalizeState(record.state || '');
      // await this.loader.upsertOffice(record);
    }

    console.log('✅ FBI import complete.');
  }
}
