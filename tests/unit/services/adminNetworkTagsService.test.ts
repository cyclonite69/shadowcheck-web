const service = require('../../../server/src/services/adminNetworkTagsService');
const adminTagRepo = require('../../../server/src/repositories/adminNetworkTagRepository');
const adminOuiRepo = require('../../../server/src/repositories/adminNetworkTagOuiRepository');

jest.mock('../../../server/src/repositories/adminNetworkTagRepository');
jest.mock('../../../server/src/repositories/adminNetworkTagOuiRepository');

describe('adminNetworkTagsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('checkDuplicateObservations calls repo', async () => {
    await service.checkDuplicateObservations();
    expect(adminTagRepo.checkDuplicateObservations).toHaveBeenCalled();
  });

  test('getNetworkSummary calls repo', async () => {
    await service.getNetworkSummary();
    expect(adminTagRepo.getNetworkSummary).toHaveBeenCalled();
  });

  test('getOUIGroups calls repo', async () => {
    await service.getOUIGroups();
    expect(adminOuiRepo.getOUIGroups).toHaveBeenCalled();
  });
});
