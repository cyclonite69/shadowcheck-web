// We'll use a shared object to control the mock behavior
const mockState = {
  localMode: false,
  composeFileExists: jest.fn(),
  probePgAdminReachable: jest.fn(),
  removePgAdminContainer: jest.fn(),
  runCommand: jest.fn(),
  runCompose: jest.fn(),
  enforceRestartPolicy: jest.fn(),
};

jest.mock('../../../../server/src/services/pgadmin/runtime', () => {
  const original = jest.requireActual('../../../../server/src/services/pgadmin/runtime');
  return {
    ...original,
    get localMode() {
      return mockState.localMode;
    },
    get composeFileExists() {
      return mockState.composeFileExists;
    },
    get probePgAdminReachable() {
      return mockState.probePgAdminReachable;
    },
    get removePgAdminContainer() {
      return mockState.removePgAdminContainer;
    },
    get runCommand() {
      return mockState.runCommand;
    },
    get runCompose() {
      return mockState.runCompose;
    },
    get enforceRestartPolicy() {
      return mockState.enforceRestartPolicy;
    },
  };
});

// Mock logger
jest.mock('../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

import * as control from '../../../../server/src/services/pgadmin/control';
import {
  containerName,
  volumeName,
  serviceName,
} from '../../../../server/src/services/pgadmin/runtime';

describe('pgAdmin control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.localMode = false;
    mockState.composeFileExists.mockResolvedValue(true);
    mockState.probePgAdminReachable.mockResolvedValue(false);
    mockState.removePgAdminContainer.mockResolvedValue(undefined);
    mockState.runCommand.mockResolvedValue({ stdout: '', stderr: '' });
    mockState.runCompose.mockResolvedValue({ stdout: '', stderr: '' });
    mockState.enforceRestartPolicy.mockResolvedValue(undefined);
  });

  describe('getPgAdminStatus', () => {
    it('should return status when container is running', async () => {
      mockState.runCommand.mockResolvedValue({
        stdout: 'id123||name123||Up 2 hours||0.0.0.0:5050->5050/tcp',
      });

      const status = await control.getPgAdminStatus();

      expect(status.container.running).toBe(true);
      expect(status.container.id).toBe('id123');
      expect(status.dockerAvailable).toBe(true);
    });

    it('should return status when container is not running but reachable via HTTP', async () => {
      mockState.runCommand.mockResolvedValue({
        stdout: '', // Docker says not exists
      });
      mockState.probePgAdminReachable.mockResolvedValue(true);

      const status = await control.getPgAdminStatus();

      expect(status.container.running).toBe(true);
      expect(status.container.status).toContain('Up (HTTP probe)');
    });

    it('should handle docker failure', async () => {
      mockState.runCommand.mockRejectedValue(new Error('Docker not found'));

      const status = await control.getPgAdminStatus();

      expect(status.dockerAvailable).toBe(false);
      expect(status.error).toBe('Docker not found');
    });

    it('should clear error if docker is unavailable but HTTP probe succeeds', async () => {
      mockState.runCommand.mockRejectedValue(new Error('Docker not found'));
      mockState.probePgAdminReachable.mockResolvedValue(true);

      const status = await control.getPgAdminStatus();

      expect(status.dockerAvailable).toBe(false);
      expect(status.container.running).toBe(true);
      expect(status.container.status).toContain('Reachable (HTTP probe)');
      expect(status.error).toBe('');
    });
  });

  describe('destroyPgAdmin', () => {
    it('should call removePgAdminContainer and optionally remove volume', async () => {
      await control.destroyPgAdmin({ removeVolume: true });

      expect(mockState.removePgAdminContainer).toHaveBeenCalled();
      expect(mockState.runCommand).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['volume', 'rm', '-f', volumeName]),
        expect.any(Object)
      );
    });

    it('should work without arguments', async () => {
      await control.destroyPgAdmin();
      expect(mockState.removePgAdminContainer).toHaveBeenCalled();
    });
  });

  describe('startPgAdmin', () => {
    it('should reset if requested', async () => {
      mockState.runCommand.mockResolvedValue({ stdout: 'true' }); // Already running

      await control.startPgAdmin({ reset: true });

      expect(mockState.removePgAdminContainer).toHaveBeenCalled();
    });

    it('should fallback to create if start fails', async () => {
      mockState.runCommand.mockResolvedValueOnce({ stdout: 'false' }); // inspect says not running
      mockState.runCommand.mockRejectedValueOnce(new Error('Start failed')); // start fails

      await control.startPgAdmin();
      expect(mockState.runCompose).toHaveBeenCalledWith(expect.arrayContaining(['up']));
    });

    it('should start existing stopped container', async () => {
      // inspect returns false (not running)
      mockState.runCommand.mockResolvedValueOnce({ stdout: 'false' });
      // start returns success
      mockState.runCommand.mockResolvedValueOnce({ stdout: 'started', stderr: '' });

      const result = await control.startPgAdmin();

      expect(mockState.runCommand).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['start', containerName])
      );
      expect(mockState.enforceRestartPolicy).toHaveBeenCalled();
      expect(result.output).toBe('started');
    });

    it('should use docker run in local mode', async () => {
      mockState.localMode = true;
      mockState.runCommand.mockRejectedValueOnce(new Error('not found')); // inspect fails
      mockState.runCommand.mockResolvedValue({ stdout: 'run success', stderr: '' });

      const result = await control.startPgAdmin();

      expect(mockState.runCommand).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['run', '-d', '--name', containerName])
      );
      expect(result.composeFile).toBe('local-docker-run');
    });

    it('should use docker-compose up in non-local mode', async () => {
      mockState.localMode = false;
      mockState.runCommand.mockRejectedValueOnce(new Error('not found')); // inspect fails
      mockState.runCompose.mockResolvedValue({ stdout: 'compose success', stderr: '' });

      const result = await control.startPgAdmin();

      expect(mockState.runCompose).toHaveBeenCalledWith(expect.arrayContaining(['up', '-d']));
      expect(mockState.enforceRestartPolicy).toHaveBeenCalled();
      expect(result.output).toBe('compose success');
    });
  });

  describe('stopPgAdmin', () => {
    it('should use docker stop in local mode', async () => {
      mockState.localMode = true;
      mockState.runCommand.mockResolvedValue({ stdout: 'stopped', stderr: '' });

      const result = await control.stopPgAdmin();

      expect(mockState.runCommand).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['stop', containerName]),
        expect.any(Object)
      );
      expect(result.composeFile).toBe('local-docker-run');
    });

    it('should use docker-compose stop in non-local mode', async () => {
      mockState.localMode = false;
      mockState.runCompose.mockResolvedValue({ stdout: 'compose stopped', stderr: '' });

      const result = await control.stopPgAdmin();

      expect(mockState.runCompose).toHaveBeenCalledWith(
        expect.arrayContaining(['stop', serviceName])
      );
      expect(result.output).toBe('compose stopped');
    });
  });
});
