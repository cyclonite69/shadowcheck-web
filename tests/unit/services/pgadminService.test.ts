const pgadminServiceLocal = require('../../../server/src/services/pgadminService');
const featureFlagServiceLocal = require('../../../server/src/services/featureFlagService');
const controlLocal = require('../../../server/src/services/pgadmin/control');

jest.mock('../../../server/src/services/featureFlagService');
jest.mock('../../../server/src/services/pgadmin/control');

describe('pgadminService', () => {
  it('should check feature flag for docker control', () => {
    (featureFlagServiceLocal.getFlag as jest.Mock).mockReturnValue(true);
    expect(pgadminServiceLocal.isDockerControlEnabled()).toBe(true);
    expect(featureFlagServiceLocal.getFlag).toHaveBeenCalledWith('admin_allow_docker');
  });

  it('should call control.getPgAdminStatus', async () => {
    (controlLocal.getPgAdminStatus as jest.Mock).mockResolvedValue({ status: 'running' });
    const result = await pgadminServiceLocal.getPgAdminStatus();
    expect(result.status).toBe('running');
    expect(controlLocal.getPgAdminStatus).toHaveBeenCalled();
  });
});
