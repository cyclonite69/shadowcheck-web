export {};

jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
}));

import {
  getResolvedJobConfig,
  hasJobConfigChanged,
  loadBackgroundJobConfigs,
} from '../../server/src/services/backgroundJobs/settings';

function getQueryMock(): jest.Mock {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../server/src/config/database').query as jest.Mock;
}

beforeEach(() => {
  getQueryMock().mockReset();
});

describe('background job settings helpers', () => {
  it('parses stringified JSON config rows from app.settings', async () => {
    getQueryMock().mockResolvedValue({
      rows: [
        {
          key: 'backup_job_config',
          value: '{"enabled":true,"cron":"0 1 * * *"}',
        },
      ],
    });

    const configs = await loadBackgroundJobConfigs();

    expect(configs.backup_job_config).toEqual({ enabled: true, cron: '0 1 * * *' });
  });

  it('returns the DB-backed config when present', () => {
    const config = getResolvedJobConfig(
      {
        ml_scoring_job_config: { enabled: false, cron: '15 * * * *' },
      },
      'mlScoring'
    );

    expect(config).toEqual({ enabled: false, cron: '15 * * * *' });
  });

  it('reports config changes when enabled or cron differs', () => {
    const previousConfigs = {
      mv_refresh_job_config: { enabled: true, cron: '30 4 * * *' },
    };

    expect(
      hasJobConfigChanged(previousConfigs, 'mvRefresh', { enabled: false, cron: '30 4 * * *' })
    ).toBe(true);
    expect(
      hasJobConfigChanged(previousConfigs, 'mvRefresh', { enabled: true, cron: '0 5 * * *' })
    ).toBe(true);
    expect(
      hasJobConfigChanged(previousConfigs, 'mvRefresh', { enabled: true, cron: '30 4 * * *' })
    ).toBe(false);
  });
});
