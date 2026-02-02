const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../logging/logger');

export {};

const repoRoot = path.resolve(__dirname, '../../..');
const composeFile =
  process.env.PGADMIN_COMPOSE_FILE ||
  path.join(repoRoot, 'docker', 'infrastructure', 'docker-compose.postgres.yml');
const composeDir = path.dirname(composeFile);
const serviceName = process.env.PGADMIN_SERVICE_NAME || 'pgadmin';
const containerName = process.env.PGADMIN_CONTAINER_NAME || 'shadowcheck_pgadmin';
const volumeName = process.env.PGADMIN_VOLUME_NAME || 'shadowcheck_pgadmin_data';
const port = Number.parseInt(process.env.PGADMIN_PORT, 10) || 5050;
const url = process.env.PGADMIN_URL || `http://localhost:${port}`;

const isDockerControlEnabled = () =>
  String(process.env.ADMIN_ALLOW_DOCKER || '').toLowerCase() === 'true';

const runCommand = (command, args, options = {}) =>
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

const runCompose = async (args, options = {}) => {
  if (!(await composeFileExists())) {
    throw new Error(`Compose file not found at ${composeFile}`);
  }

  try {
    return await runCommand('docker-compose', ['-f', composeFile, ...args], {
      cwd: composeDir,
      ...options,
    });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return await runCommand('docker', ['compose', '-f', composeFile, ...args], {
        cwd: composeDir,
        ...options,
      });
    }
    throw err;
  }
};

const parseDockerStatus = (stdout) => {
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

const startPgAdmin = async ({ reset } = {}) => {
  if (reset) {
    logger.warn('[PgAdmin] Reset requested. Removing container and volume.');
    await runCompose(['stop', serviceName], { allowFail: true });
    await runCompose(['rm', '-f', '-s', serviceName], { allowFail: true });
    if (volumeName) {
      await runCommand('docker', ['volume', 'rm', volumeName], { allowFail: true });
    }
  }

  logger.info('[PgAdmin] Starting PgAdmin via docker-compose');
  const result = await runCompose(['up', '-d', serviceName]);

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
};
