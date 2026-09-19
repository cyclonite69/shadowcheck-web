import { EventEmitter } from 'events';

// Mock child_process.spawn
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

// Mock fs
const mockFsPromises = {
  access: jest.fn(),
};
jest.mock('fs', () => ({
  promises: mockFsPromises,
}));

// Mock os
const mockOs = {
  hostname: jest.fn(),
};
jest.mock('os', () => mockOs);

describe('pgAdmin runtime', () => {
  let runtime: any;

  function createMockChild() {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = new EventEmitter();
    return child;
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Default environment for tests
    process.env.DB_HOST = 'localhost';
    process.env.NODE_ENV = 'test';
    process.env.PGADMIN_PORT = '5050';

    mockOs.hostname.mockReturnValue('test-host');
    mockFsPromises.access.mockResolvedValue(undefined);

    // Default mock for spawn to prevent hangs
    mockSpawn.mockImplementation(() => {
      const child = createMockChild();
      setImmediate(() => child.emit('close', 0));
      return child;
    });

    // Import runtime after setting env
    runtime = require('../../../../server/src/services/pgadmin/runtime');
  });

  const mockSpawnProcess = (code: number, stdout = '', stderr = '') => {
    const child = createMockChild();
    mockSpawn.mockReturnValueOnce(child);

    setImmediate(() => {
      if (stdout) child.stdout.emit('data', Buffer.from(stdout));
      if (stderr) child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', code);
    });

    return child;
  };

  describe('runCommand', () => {
    it('should resolve on success (code 0)', async () => {
      mockSpawnProcess(0, 'success output', '');
      const result = await runtime.runCommand('test-cmd', ['arg1']);

      expect(result).toEqual({
        code: 0,
        stdout: 'success output',
        stderr: '',
      });
      expect(mockSpawn).toHaveBeenCalledWith('test-cmd', ['arg1'], expect.any(Object));
    });

    it('should reject on non-zero code', async () => {
      mockSpawnProcess(1, '', 'error message');
      await expect(runtime.runCommand('test-cmd', [])).rejects.toThrow('error message');
    });

    it('should resolve on non-zero code if allowFail is true', async () => {
      mockSpawnProcess(1, 'partial output', 'error message');
      const result = await runtime.runCommand('test-cmd', [], { allowFail: true });

      expect(result).toEqual({
        code: 1,
        stdout: 'partial output',
        stderr: 'error message',
      });
    });

    it('should reject on process error event', async () => {
      const child = createMockChild();
      mockSpawn.mockReturnValueOnce(child);
      const promise = runtime.runCommand('test-cmd', []);
      child.emit('error', new Error('Spawn error'));
      await expect(promise).rejects.toThrow('Spawn error');
    });

    it('should use generic error message if stderr is empty on non-zero exit', async () => {
      mockSpawnProcess(1, '', '');
      await expect(runtime.runCommand('test-cmd', [])).rejects.toThrow(
        'test-cmd exited with code 1'
      );
    });
  });

  describe('composeFileExists', () => {
    it('should return true if fs.access succeeds', async () => {
      mockFsPromises.access.mockResolvedValueOnce(undefined);
      const exists = await runtime.composeFileExists();
      expect(exists).toBe(true);
    });

    it('should return false if fs.access fails', async () => {
      mockFsPromises.access.mockRejectedValueOnce(new Error('ENOENT'));
      const exists = await runtime.composeFileExists();
      expect(exists).toBe(false);
    });

    it('should return true in local mode without checking fs', async () => {
      process.env.DB_HOST = 'postgres';
      process.env.NODE_ENV = 'development';
      jest.resetModules();
      runtime = require('../../../../server/src/services/pgadmin/runtime');

      const exists = await runtime.composeFileExists();
      expect(exists).toBe(true);
      expect(mockFsPromises.access).not.toHaveBeenCalled();
    });
  });

  describe('runCompose', () => {
    it('should throw error if compose file missing', async () => {
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
      await expect(runtime.runCompose(['up'])).rejects.toThrow(/Compose file not found/);
    });

    it('should call docker-compose by default', async () => {
      mockFsPromises.access.mockResolvedValue(undefined);
      mockSpawnProcess(0, 'compose output', '');

      const result = await runtime.runCompose(['up']);
      expect(result.stdout).toBe('compose output');
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker-compose',
        expect.arrayContaining(['up']),
        expect.any(Object)
      );
    });

    it('should fall back to "docker compose" if "docker-compose" is missing', async () => {
      mockFsPromises.access.mockResolvedValue(undefined);

      // First call to runCommand (docker-compose) fails with ENOENT
      const childEnoent = createMockChild();
      mockSpawn.mockReturnValueOnce(childEnoent);
      setImmediate(() => childEnoent.emit('error', { code: 'ENOENT' }));

      // Second call (docker compose) succeeds
      mockSpawnProcess(0, 'docker compose output', '');

      const result = await runtime.runCompose(['up']);
      expect(result.stdout).toBe('docker compose output');
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['compose']),
        expect.any(Object)
      );
    });

    it('should throw if in local mode', async () => {
      process.env.DB_HOST = 'postgres';
      process.env.NODE_ENV = 'development';
      jest.resetModules();
      runtime = require('../../../../server/src/services/pgadmin/runtime');

      await expect(runtime.runCompose(['up'])).rejects.toThrow(
        /docker-compose pgAdmin control is disabled in local mode/
      );
    });
  });

  describe('parseDockerStatus', () => {
    it('should return exists:false if stdout is empty', () => {
      const status = runtime.parseDockerStatus('');
      expect(status.exists).toBe(false);
    });

    it('should parse running container correctly', () => {
      const stdout = 'id123||name123||Up 2 hours||0.0.0.0:5050->5050/tcp';
      const status = runtime.parseDockerStatus(stdout);
      expect(status.running).toBe(true);
      expect(status.id).toBe('id123');
    });

    it('should handle missing status or other fields', () => {
      const stdout = 'id123||name123||||';
      const status = runtime.parseDockerStatus(stdout);
      expect(status.exists).toBe(true);
      expect(status.running).toBe(false);
      expect(status.status).toBe('');
      expect(status.ports).toBe('');
    });

    it('should handle missing name and status fields (empty string cases)', () => {
      // id||||||ports
      const stdout = 'id123||||||ports123';
      const status = runtime.parseDockerStatus(stdout);
      expect(status.exists).toBe(true);
      expect(status.status).toBe('');
      expect(status.name).toBe('shadowcheck_pgadmin'); // falls back to containerName constant
    });
  });

  describe('probePgAdminReachable', () => {
    it('should return true if curl returns HTTP 200', async () => {
      mockSpawnProcess(0, 'HTTP/1.1 200 OK', '');
      const reachable = await runtime.probePgAdminReachable();
      expect(reachable).toBe(true);
    });

    it('should probe container hostname in local mode', async () => {
      process.env.DB_HOST = 'postgres';
      process.env.NODE_ENV = 'development';
      jest.resetModules();
      runtime = require('../../../../server/src/services/pgadmin/runtime');

      mockSpawnProcess(0, 'HTTP/1.1 200 OK', '');
      const reachable = await runtime.probePgAdminReachable();
      expect(reachable).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        'curl',
        expect.arrayContaining(['http://shadowcheck_pgadmin_local:5050/']),
        expect.any(Object)
      );
    });

    it('should return false if curl fails or returns non-2xx', async () => {
      mockSpawnProcess(0, 'HTTP/1.1 500 Error', '');
      let reachable = await runtime.probePgAdminReachable();
      expect(reachable).toBe(false);

      mockSpawnProcess(1, '', 'connection refused');
      reachable = await runtime.probePgAdminReachable();
      expect(reachable).toBe(false);
    });
  });

  describe('removePgAdminContainer', () => {
    it('should stop and rm container in non-local mode', async () => {
      mockFsPromises.access.mockResolvedValue(undefined);
      mockSpawnProcess(0); // stop
      mockSpawnProcess(0); // rm compose
      mockSpawnProcess(0); // rm docker

      await runtime.removePgAdminContainer();

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker-compose',
        expect.arrayContaining(['stop']),
        expect.any(Object)
      );
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['rm', '-f']),
        expect.any(Object)
      );
    });
  });

  describe('repairSavedServerHost', () => {
    it('should use DB_HOST (postgres) in local mode', async () => {
      process.env.DB_HOST = 'postgres';
      process.env.NODE_ENV = 'development';
      jest.resetModules();
      runtime = require('../../../../server/src/services/pgadmin/runtime');

      mockSpawnProcess(0, '1', '');

      const count = await runtime.repairSavedServerHost();
      expect(count).toBe(1);
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          'exec',
          '-e',
          'TARGET_HOST=postgres',
          'shadowcheck_pgadmin_local',
          'python3',
          '-c',
          expect.stringContaining('UPDATE server SET host = ? WHERE host != ?'),
        ]),
        expect.any(Object)
      );
    });

    it('should consume custom DB_HOST when provided', async () => {
      process.env.DB_HOST = 'custom-db-host';
      process.env.NODE_ENV = 'development';
      jest.resetModules();
      runtime = require('../../../../server/src/services/pgadmin/runtime');

      mockSpawnProcess(0, '2', '');

      const count = await runtime.repairSavedServerHost();
      expect(count).toBe(2);
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['exec', '-e', 'TARGET_HOST=custom-db-host']),
        expect.any(Object)
      );
    });

    it('should use 127.0.0.1 in non-local EC2 mode when DB_HOST is unset', async () => {
      delete process.env.DB_HOST;
      process.env.NODE_ENV = 'production';
      jest.resetModules();
      runtime = require('../../../../server/src/services/pgadmin/runtime');

      mockSpawnProcess(0, '0', '');

      const count = await runtime.repairSavedServerHost();
      expect(count).toBe(0);
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['exec', '-e', 'TARGET_HOST=127.0.0.1', 'shadowcheck_pgadmin']),
        expect.any(Object)
      );
    });

    it('should use explicit DB_HOST (127.0.0.1) in EC2 mode', async () => {
      process.env.DB_HOST = '127.0.0.1';
      process.env.NODE_ENV = 'production';
      jest.resetModules();
      runtime = require('../../../../server/src/services/pgadmin/runtime');

      mockSpawnProcess(0, '1', '');

      const count = await runtime.repairSavedServerHost();
      expect(count).toBe(1);
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['exec', '-e', 'TARGET_HOST=127.0.0.1', 'shadowcheck_pgadmin']),
        expect.any(Object)
      );
    });
  });

  describe('ensureLocalDatabaseNetwork', () => {
    it('should connect network in local mode', async () => {
      process.env.DB_HOST = 'postgres';
      process.env.NODE_ENV = 'development';
      jest.resetModules();
      runtime = require('../../../../server/src/services/pgadmin/runtime');

      mockSpawnProcess(0, '', '');

      await runtime.ensureLocalDatabaseNetwork();
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        ['network', 'connect', 'shadowcheck-web_default', 'shadowcheck_pgadmin_local'],
        expect.any(Object)
      );
    });

    it('should not connect network in non-local mode', async () => {
      process.env.DB_HOST = '127.0.0.1';
      process.env.NODE_ENV = 'production';
      jest.resetModules();
      runtime = require('../../../../server/src/services/pgadmin/runtime');

      await runtime.ensureLocalDatabaseNetwork();
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });
});
