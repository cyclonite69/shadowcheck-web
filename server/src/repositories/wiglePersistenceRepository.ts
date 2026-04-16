export {};

type QueryExecutor = {
  query: (text: string, params?: any[]) => Promise<any>;
};

const insertWigleV2SearchResult = async (
  executor: QueryExecutor,
  network: any
): Promise<number> => {
  const trilat = network.trilat ? parseFloat(network.trilat) : null;
  const trilong = network.trilong ? parseFloat(network.trilong) : null;

  // WiGLE occasionally returns rows without usable coordinates. Skip them
  // rather than aborting the entire page transaction.
  if (!Number.isFinite(trilat) || !Number.isFinite(trilong)) {
    return 0;
  }

  const result = await executor.query(
    `INSERT INTO app.wigle_v2_networks_search (
      bssid, ssid, trilat, trilong, location, firsttime, lasttime, lastupdt,
      type, encryption, channel, frequency, qos, wep, bcninterval, freenet,
      dhcp, paynet, transid, rcois, name, comment, userfound, source,
      country, region, city, road, housenumber, postalcode
    ) VALUES (
      $1, $2, $3::numeric, $4::numeric, ST_SetSRID(ST_MakePoint($5::numeric, $3::numeric), 4326),
      $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22, $23, 'wigle_api_search',
      $24, $25, $26, $27, $28, $29
    ) ON CONFLICT (bssid, trilat, trilong, lastupdt) DO NOTHING`,
    [
      network.netid || network.bssid,
      network.ssid,
      trilat,
      trilong,
      trilong,
      network.firsttime,
      network.lasttime,
      network.lastupdt,
      network.type || 'wifi',
      network.encryption,
      network.channel,
      network.frequency,
      network.qos || 0,
      network.wep,
      network.bcninterval,
      network.freenet,
      network.dhcp,
      network.paynet,
      network.transid,
      network.rcois,
      network.name,
      network.comment,
      network.userfound === true,
      network.country,
      network.region,
      network.city,
      network.road,
      network.housenumber,
      network.postalcode,
    ]
  );
  return result.rowCount || 0;
};

const importWigleV3NetworkDetail = async (executor: QueryExecutor, data: any): Promise<void> => {
  await executor.query(
    `INSERT INTO app.wigle_v3_network_details (
      netid, name, type, comment, ssid, trilat, trilon, encryption, channel,
      bcninterval, freenet, dhcp, paynet, qos, first_seen, last_seen, last_update,
      street_address, location_clusters
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (netid) DO UPDATE SET
      name = EXCLUDED.name, type = EXCLUDED.type, comment = EXCLUDED.comment,
      ssid = EXCLUDED.ssid, trilat = EXCLUDED.trilat, trilon = EXCLUDED.trilon,
      encryption = EXCLUDED.encryption, channel = EXCLUDED.channel,
      bcninterval = EXCLUDED.bcninterval, freenet = EXCLUDED.freenet,
      dhcp = EXCLUDED.dhcp, paynet = EXCLUDED.paynet, qos = EXCLUDED.qos,
      first_seen = LEAST(EXCLUDED.first_seen, first_seen), last_seen = GREATEST(EXCLUDED.last_seen, last_seen),
      last_update = EXCLUDED.last_update, street_address = EXCLUDED.street_address,
      location_clusters = EXCLUDED.location_clusters, imported_at = NOW()`,
    [
      data.netid,
      data.name,
      data.type,
      data.comment,
      data.ssid,
      data.trilat,
      data.trilon,
      data.encryption,
      data.channel,
      data.bcninterval,
      data.freenet,
      data.dhcp,
      data.paynet,
      data.qos,
      data.first_seen,
      data.last_seen,
      data.last_update,
      data.street_address,
      data.location_clusters,
    ]
  );
};

const importWigleV3Observation = async (
  executor: QueryExecutor,
  netid: string,
  loc: any,
  ssid: string | null
): Promise<number> => {
  const result = await executor.query(
    `INSERT INTO app.wigle_v3_observations (
      netid, latitude, longitude, altitude, accuracy,
      signal, observed_at, last_update, ssid,
      frequency, channel, encryption, noise, snr, month, location
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
      ST_SetSRID(ST_MakePoint($3, $2), 4326)
    ) ON CONFLICT DO NOTHING`,
    [
      netid,
      parseFloat(loc.latitude),
      parseFloat(loc.longitude),
      parseFloat(loc.alt) || null,
      parseFloat(loc.accuracy) || null,
      parseInt(loc.signal) || null,
      loc.time,
      loc.lastupdt,
      ssid,
      parseInt(loc.frequency) || null,
      parseInt(loc.channel) || null,
      loc.encryptionValue,
      parseInt(loc.noise) || null,
      parseInt(loc.snr) || null,
      loc.month,
    ]
  );
  return result.rowCount || 0;
};

const getWigleDetail = async (executor: QueryExecutor, netid: string): Promise<any[]> => {
  const { rows } = await executor.query(
    `SELECT
       nd.netid, nd.ssid, nd.type, nd.encryption, nd.channel,
       nd.trilat, nd.trilon, nd.first_seen, nd.last_seen,
       nd.street_address, nd.location_clusters,
       nd.name, nd.comment, nd.qos,
       obs.latitude  AS last_lat,
       obs.longitude AS last_lon,
       obs.observed_at AS last_observed_at,
       ne.threat_score, ne.threat_level, ne.manufacturer,
       ne.geocoded_address, ne.geocoded_city, ne.geocoded_state, ne.geocoded_poi_name,
       ne.observations AS local_observations,
       ne.first_seen AS local_first_seen,
       ne.last_seen AS local_last_seen,
       (ne.bssid IS NOT NULL) AS wigle_match
     FROM app.wigle_v3_network_details nd
     LEFT JOIN LATERAL (
       SELECT latitude, longitude, observed_at
       FROM app.wigle_v3_observations
       WHERE netid = nd.netid
       ORDER BY observed_at DESC
       LIMIT 1
     ) obs ON true
     LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(nd.netid)
     WHERE nd.netid = $1
     LIMIT 1`,
    [netid]
  );

  return rows;
};

const getWigleV3Observations = async (executor: QueryExecutor, netid: string): Promise<any[]> => {
  const { rows } = await executor.query(
    `SELECT id, netid, latitude, longitude, altitude, accuracy,
            signal, observed_at, last_update, ssid,
            frequency, channel, encryption, noise, snr, month
     FROM app.wigle_v3_observations
     WHERE netid = $1
     ORDER BY observed_at DESC`,
    [netid]
  );
  return rows;
};

export {
  getWigleDetail,
  getWigleV3Observations,
  insertWigleV2SearchResult,
  importWigleV3NetworkDetail,
  importWigleV3Observation,
};
