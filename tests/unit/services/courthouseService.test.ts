const courthouseService = require('../../../server/src/services/courthouseService');
const courthouseRepository = require('../../../server/src/repositories/courthouseRepository');

jest.mock('../../../server/src/repositories/courthouseRepository');

describe('courthouseService', () => {
  it('should call fetchFederalCourthousesGeoJSON from repository', async () => {
    const mockData = { type: 'FeatureCollection', features: [] };
    (courthouseRepository.fetchFederalCourthousesGeoJSON as jest.Mock).mockResolvedValue(mockData);

    const result = await courthouseService.getFederalCourthousesGeoJSON();
    expect(result).toEqual(mockData);
    expect(courthouseRepository.fetchFederalCourthousesGeoJSON).toHaveBeenCalled();
  });
});
