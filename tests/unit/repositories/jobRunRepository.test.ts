const jobRunRepository = require('../../../server/src/repositories/jobRunRepository');
const dbConfigJobRun = require('../../../server/src/config/database');

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

describe('jobRunRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a job run', async () => {
    (dbConfigJobRun.query as jest.Mock).mockResolvedValue({ rows: [{ id: '123' }] });

    const result = await jobRunRepository.createJobRun('test-job', '* * * * *');

    expect(dbConfigJobRun.query).toHaveBeenCalled();
    expect(result).toBe(123);
  });

  it('should complete a job run', async () => {
    (dbConfigJobRun.query as jest.Mock).mockResolvedValue({});

    await jobRunRepository.completeJobRun(123, { success: true }, 100);

    expect(dbConfigJobRun.query).toHaveBeenCalled();
  });

  it('should fail a job run', async () => {
    (dbConfigJobRun.query as jest.Mock).mockResolvedValue({});

    await jobRunRepository.failJobRun(123, 'error', 100);

    expect(dbConfigJobRun.query).toHaveBeenCalled();
  });
});
