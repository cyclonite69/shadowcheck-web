import { adminQuery } from './adminDbService';
import { query } from '../config/database';

/**
 * Get all settings
 */
export async function getAllSettings(): Promise<any[]> {
  const result = await query(
    'SELECT key, value, description, updated_at FROM app.settings ORDER BY key'
  );
  return result.rows;
}

/**
 * Get setting by key
 */
export async function getSettingByKey(key: string): Promise<any | null> {
  const result = await query(
    'SELECT value, description, updated_at FROM app.settings WHERE key = $1',
    [key]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Update setting
 */
export async function updateSetting(key: string, value: any): Promise<any> {
  const result = await adminQuery(
    'UPDATE app.settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
    [JSON.stringify(value), key]
  );
  return result.rows[0];
}

/**
 * Toggle ML blending setting
 */
export async function toggleMLBlending(): Promise<boolean> {
  const result = await adminQuery(`
    UPDATE app.settings
    SET value = CASE WHEN value::text = 'true' THEN 'false' ELSE 'true' END,
        updated_at = NOW()
    WHERE key = 'ml_blending_enabled'
    RETURNING value
  `);
  return result.rows[0]?.value;
}

/**
 * Save ML model configuration
 */
export async function saveMLModelConfig(
  modelType: string,
  coefficients: any,
  intercept: number,
  featureNames: string[]
): Promise<boolean> {
  const result = await adminQuery(
    `INSERT INTO app.ml_model_config (model_type, coefficients, intercept, feature_names, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (model_type) DO UPDATE
     SET coefficients = $2, intercept = $3, feature_names = $4, updated_at = NOW()`,
    [modelType, JSON.stringify(coefficients), intercept, JSON.stringify(featureNames)]
  );
  return result.rowCount !== null && result.rowCount > 0;
}
