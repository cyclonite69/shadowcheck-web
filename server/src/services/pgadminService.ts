const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../logging/logger');

type RunCommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  allowFail?: boolean;
};

type RunCommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

export {};

const repoRoot = process.cwd();
const composeFile =
  process.env.PGADMIN_COMPOSE_FILE ||
  path.join(repoRoot, 'docker', 'infrastructure', 'docker-compose.postgres.yml');
const composeDir = path.dirname(composeFile);
const serviceName = process.env.PGADMIN_SERVICE_NAME || 'pgadmin';
const containerName = process.env.PGADMIN_CONTAINER_NAME || 'shadowcheck_pgadmin';
const volumeName = process.env.PGADMIN_VOLUME_NAME || 'shadowcheck_pgadmin_data';
const port = Number.parseInt(process.env.PGADMIN_PORT, 10) || 5050;
const url = process.env.PGADMIN_URL || `http://localhost:${port}`;
const dockerHost = process.env.PGADMIN_DOCKER_HOST_LABEL || os.hostname();

const isDockerControlEnabled = () =>
  String(process.env.ADMIN_ALLOW_DOCKER || '').toLowerCase() === 'true';

const runCommand = (
  command: string,
  args: string[],
  options: RunCommandOptions = {}
): Promise<RunCommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0 || options.allowFail) {
        resolve({
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
        return;
      }

      reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });

const composeFileExists = async () => {
  try {
    await fs.access(composeFile);
    return true;
  } catch {
    return false;
  }
};

const runCompose = async (args: string[], options: RunCommandOptions = {}) => {
  if (!(await composeFileExists())) {
    throw new Error(`Compose file not found at ${composeFile}`);
  }

  try {
    return await runCommand('docker-compose', ['-f', composeFile, ...args], {
      cwd: composeDir,
      ...options,
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException | null)?.code === 'ENOENT') {
      return await runCommand('docker', ['compose', '-f', composeFile, ...args], {
        cwd: composeDir,
        ...options,
      });
    }
    throw err;
  }
};

const parseDockerStatus = (stdout: string) => {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return {
      exists: false,
      running: false,
      status: '',
      ports: '',
      id: '',
      name: containerName,
    };
  }

  const [id, name, status, ports] = lines[0].split('||');
  const normalizedStatus = status ? status.trim() : '';
  const running = normalizedStatus.toLowerCase().startsWith('up');

  return {
    exists: true,
    running,
    status: normalizedStatus,
    ports: ports ? ports.trim() : '',
    id: id ? id.trim() : '',
    name: name ? name.trim() : containerName,
  };
};

const getPgAdminStatus = async () => {
  const status = {
    dockerHost,
    composeFile,
    composeFileExists: await composeFileExists(),
    serviceName,
    containerName,
    volumeName,
    port,
    url,
    dockerAvailable: true,
    container: {
      exists: false,
      running: false,
      status: '',
      ports: '',
      id: '',
      name: containerName,
    },
    error: '',
  };

  try {
    const result = await runCommand('docker', [
      'ps',
      '-a',
      '--filter',
      `name=${containerName}`,
      '--format',
      '{{.ID}}||{{.Names}}||{{.Status}}||{{.Ports}}',
    ]);

    status.container = parseDockerStatus(result.stdout);
  } catch (err) {
    status.dockerAvailable = false;
    status.error = err?.message || 'Docker CLI not available';
  }

  return status;
};

const enforceRestartPolicy = async () => {
  await runCommand('docker', ['update', '--restart', 'unless-stopped', containerName], {
    allowFail: true,
  });
};

const removePgAdminContainer = async () => {
  await runCompose(['stop', serviceName], { allowFail: true });
  await runCompose(['rm', '-f', '-s', serviceName], { allowFail: true });
  await runCommand('docker', ['rm', '-f', containerName], { allowFail: true });
};

const destroyPgAdmin = async ({ removeVolume = false }: { removeVolume?: boolean } = {}) => {
  logger.info('[PgAdmin] Destroy requested', { removeVolume });
  await removePgAdminContainer();

  if (removeVolume && volumeName) {
    await runCommand('docker', ['volume', 'rm', '-f', volumeName], { allowFail: true });
  }

  return {
    composeFile,
    serviceName,
    volumeRemoved: removeVolume,
  };
};

const startPgAdmin = async ({ reset }: { reset?: boolean } = {}) => {
  if (reset) {
    logger.warn('[PgAdmin] Reset requested. Removing container and volume.');
    await destroyPgAdmin({ removeVolume: true });
  }

  // Check if container exists but is stopped
  try {
    const inspectResult = await runCommand(
      'docker',
      ['inspect', '--format', '{{.State.Running}}', containerName],
      { allowFail: true }
    );
    if (inspectResult.stdout.trim() === 'false') {
      logger.info('[PgAdmin] Container exists but stopped, starting it');
      const startResult = await runCommand('docker', ['start', containerName]);
      await enforceRestartPolicy();
      return {
        output: startResult.stdout,
        warnings: startResult.stderr,
        composeFile,
        serviceName,
      };
    }
  } catch (err) {
    // Container doesn't exist, proceed with compose up
  }

  logger.info('[PgAdmin] Starting PgAdmin via docker-compose');
  const result = await runCompose(['up', '-d', '--no-deps', serviceName]);
  await enforceRestartPolicy();

  return {
    output: result.stdout,
    warnings: result.stderr,
    composeFile,
    serviceName,
  };
};

const stopPgAdmin = async () => {
  logger.info('[PgAdmin] Stopping PgAdmin via docker-compose');
  const result = await runCompose(['stop', serviceName]);
  return {
    output: result.stdout,
    warnings: result.stderr,
    composeFile,
    serviceName,
  };
};

module.exports = {
  isDockerControlEnabled,
  getPgAdminStatus,
  startPgAdmin,
  stopPgAdmin,
  destroyPgAdmin,
};
