const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

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

const repoRoot = process.cwd();
const localMode =
  (process.env.DB_HOST || '').trim() === 'postgres' && process.env.NODE_ENV !== 'production';
const composeFile =
  process.env.PGADMIN_COMPOSE_FILE ||
  path.join(repoRoot, 'docker', 'infrastructure', 'docker-compose.postgres.yml');
const composeDir = path.dirname(composeFile);
const serviceName = process.env.PGADMIN_SERVICE_NAME || 'pgadmin';
const containerName =
  process.env.PGADMIN_CONTAINER_NAME ||
  (localMode ? 'shadowcheck_pgadmin_local' : 'shadowcheck_pgadmin');
const volumeName =
  process.env.PGADMIN_VOLUME_NAME ||
  (localMode ? 'shadowcheck_pgadmin_local_data' : 'shadowcheck_pgadmin_data');
const port = Number.parseInt(process.env.PGADMIN_PORT || '5050', 10) || 5050;
const url = process.env.PGADMIN_URL || `${localMode ? 'http' : 'https'}://localhost:${port}`;
const dockerHost = process.env.PGADMIN_DOCKER_HOST_LABEL || os.hostname();
const pgAdminEmail = process.env.PGADMIN_EMAIL || 'admin@example.com';
const pgAdminPassword = process.env.PGADMIN_PASSWORD || 'admin';

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
      child.stdout.on('data', (data: any) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data: any) => {
        stderr += data.toString();
      });
    }

    child.on('error', (err: any) => {
      reject(err);
    });

    child.on('close', (code: any) => {
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
  if (localMode) {
    return true;
  }
  try {
    await fs.access(composeFile);
    return true;
  } catch {
    return false;
  }
};

const runCompose = async (args: string[], options: RunCommandOptions = {}) => {
  if (localMode) {
    throw new Error('docker-compose pgAdmin control is disabled in local mode');
  }

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

const probePgAdminReachable = async () => {
  const probeUrl =
    process.env.PGADMIN_STATUS_PROBE_URL ||
    (localMode ? `http://host.containers.internal:${port}/` : url);

  try {
    const result = await runCommand('curl', ['-sSI', '--max-time', '3', probeUrl], {
      allowFail: true,
    });
    const statusLine = result.stdout
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^HTTP\/\d/.test(line));

    return Boolean(statusLine && /\s(200|301|302|303|307|308)\b/.test(statusLine));
  } catch {
    return false;
  }
};

const enforceRestartPolicy = async () => {
  await runCommand('docker', ['update', '--restart', 'unless-stopped', containerName], {
    allowFail: true,
  });
};

const removePgAdminContainer = async () => {
  if (!localMode) {
    await runCompose(['stop', serviceName], { allowFail: true });
    await runCompose(['rm', '-f', '-s', serviceName], { allowFail: true });
  }

  await runCommand('docker', ['rm', '-f', containerName], { allowFail: true });
};

export {
  composeFile,
  composeFileExists,
  containerName,
  dockerHost,
  enforceRestartPolicy,
  localMode,
  parseDockerStatus,
  pgAdminEmail,
  pgAdminPassword,
  port,
  probePgAdminReachable,
  removePgAdminContainer,
  runCommand,
  runCompose,
  serviceName,
  url,
  volumeName,
};
