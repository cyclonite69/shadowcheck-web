import { processSuccessfulPage } from '../../../../server/src/services/wigleImport/pageProcessor';
const { pool } = require('../../../../server/src/config/database');
const wigleService = require('../../../../server/src/services/wigleService');
const logger = require('../../../../server/src/logging/logger');

jest.mock('../../../../server/src/config/database', () => ({
  pool: {
    connect: jest.fn(),
  },
}));

jest.mock('../../../../server/src/services/wigleService', () => ({
  importWigleV2SearchResult: jest.fn(),
}));

jest.mock('../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('pageProcessor', () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
  });

  it('should process a successful page with valid total results and markCompleted false', async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1, status: 'running' }] });
    wigleService.importWigleV2SearchResult.mockResolvedValue(1);

    const result = await processSuccessfulPage(
      1, // runId
      1, // pageNumber
      'req_cursor',
      'next_cursor',
      [{ netid: '12:34' }], // results
      100, // apiTotalResults
      50, // pageSize
      false // markCompleted
    );

    expect(result).toEqual({ id: 1, status: 'running' });
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should process empty results array', async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1, status: 'running' }] });

    const result = await processSuccessfulPage(
      1,
      1,
      null,
      null,
      [], // empty arrays branch
      null, // apiTotalResults null branch
      50
    );

    expect(result).toEqual({ id: 1, status: 'running' });
    expect(wigleService.importWigleV2SearchResult).not.toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });

  it('should process apiTotalResults < 0 (fallback branch)', async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1, status: 'running' }] });

    await processSuccessfulPage(
      1,
      1,
      null,
      null,
      [],
      -5, // < 0 branch
      50
    );

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });

  it('should rollback transaction and throw if an error occurs', async () => {
    mockClient.query.mockImplementation((text: string) => {
      if (text === 'BEGIN') return Promise.resolve();
      throw new Error('DB Error');
    });

    await expect(
      processSuccessfulPage(1, 1, null, null, [{ netid: '1' }], 100, 50)
    ).rejects.toThrow('DB Error');

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should process markCompleted true branch', async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1, status: 'completed' }] });

    const result = await processSuccessfulPage(
      1,
      2,
      'req',
      'next',
      [],
      100,
      50,
      true // markCompleted = true
    );

    expect(result).toEqual({ id: 1, status: 'completed' });
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });
});