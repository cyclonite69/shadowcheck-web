/**
 * Settings Admin Service
 * Administrative operations for system settings
 */

const { adminQuery } = require('../adminDbService');

export async function getAllSettings(): Promise<any[]> {
  const { rows } = await adminQuery(
    'SELECT key, value, description, updated_at FROM app.settings ORDER BY key'
  );
  return rows;
}

export async function getSettingByKey(key: string): Promise<any | null> {
  const { rows } = await adminQuery(
    'SELECT key, value, description, updated_at FROM app.settings WHERE key = $1',
    [key]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function updateSetting(key: string, value: any): Promise<any> {
  const { rows } = await adminQuery(
    'UPDATE app.settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
    [value, key]
  );
  return rows[0];
}

export async function toggleMLBlending(): Promise<boolean> {
  const current = await getSettingByKey('ml_blending_enabled');
  const newValue = current?.value === 'true' ? 'false' : 'true';
  await updateSetting('ml_blending_enabled', newValue);
  return newValue === 'true';
}

export async function saveMLModelConfig(
  modelVersion: string,
  accuracy: number,
  precision: number,
  recall: number,
  f1: number
): Promise<any> {
  await updateSetting('ml_model_version', modelVersion);
  await updateSetting('ml_model_accuracy', accuracy.toString());
  await updateSetting('ml_model_precision', precision.toString());
  await updateSetting('ml_model_recall', recall.toString());
  await updateSetting('ml_model_f1', f1.toString());
  return { modelVersion, accuracy, precision, recall, f1 };
}

module.exports = {
  getAllSettings,
  getSettingByKey,
  updateSetting,
  toggleMLBlending,
  saveMLModelConfig,
};
