const { query } = require('../../config/database');
const logger = require('../../logging/logger');

export {};

const getHomeLocation = async (): Promise<{ lat: number; lon: number } | null> => {
  try {
    const result = await query(
      "SELECT latitude, longitude FROM app.location_markers WHERE marker_type = 'home' LIMIT 1"
    );
    if (result.rows.length > 0) {
      const { latitude, longitude } = result.rows[0];
      if (latitude !== null && longitude !== null) {
        return { lat: parseFloat(latitude), lon: parseFloat(longitude) };
      }
    }
    return null;
  } catch (err: any) {
    logger.warn('Could not fetch home location:', err.message);
    return null;
  }
};

export { getHomeLocation };
