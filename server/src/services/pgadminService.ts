const featureFlagService = require('./featureFlagService');
import { destroyPgAdmin, getPgAdminStatus, startPgAdmin, stopPgAdmin } from './pgadmin/control';

export {};

const isDockerControlEnabled = () => featureFlagService.getFlag('admin_allow_docker');

module.exports = {
  isDockerControlEnabled,
  getPgAdminStatus,
  startPgAdmin,
  stopPgAdmin,
  destroyPgAdmin,
};
