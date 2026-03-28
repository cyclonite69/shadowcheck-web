const {
  fetchAgencyOfficesGeoJSON,
  fetchAgencyOfficeCounts,
  findNearestAgenciesToNetwork,
  findNearestAgenciesBatch,
} = require('../repositories/agencyRepository');

module.exports = {
  getAgencyOfficesGeoJSON: fetchAgencyOfficesGeoJSON,
  getAgencyOfficeCountByType: fetchAgencyOfficeCounts,
  getNearestAgenciesToNetwork: findNearestAgenciesToNetwork,
  getNearestAgenciesToNetworksBatch: findNearestAgenciesBatch,
};
