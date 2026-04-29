export {};

const { query } = require('../config/database');

export async function checkHomeLocationExists(): Promise<boolean> {
  try {
    const home = await query(
      "SELECT 1 FROM app.location_markers WHERE marker_type = 'home' LIMIT 1"
    );
    return home.rowCount > 0;
  } catch (err: any) {
    if (err && err.code === '42P01') {
      throw new Error('Home location markers table is missing (app.location_markers).');
    }
    throw err;
  }
}

export async function executeKeplerQuery(sql: string, params: any[]): Promise<any> {
  await query("SET LOCAL statement_timeout = '120000ms'");
  return query(sql, params);
}

module.exports = { checkHomeLocationExists, executeKeplerQuery };
