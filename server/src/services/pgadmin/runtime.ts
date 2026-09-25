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
const localDatabaseNetwork =
  process.env.PGADMIN_LOCAL_DATABASE_NETWORK || 'shadowcheck-web_default';
const dockerHost = process.env.PGADMIN_DOCKER_HOST_LABEL || os.hostname();
const pgAdminEmail = process.env.PGADMIN_EMAIL || 'admin@example.com';
const pgAdminPassword = process.env.PGADMIN_PASSWORD || 'admin';
const databaseHost = (process.env.DB_HOST || '').trim() || (localMode ? 'postgres' : '127.0.0.1');

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
      return runCommand('docker', ['compose', '-f', composeFile, ...args], {
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
    process.env.PGADMIN_STATUS_PROBE_URL || (localMode ? `http://${containerName}:${port}/` : url);

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

const repairSavedServerHost = async () => {
  const targetHost = databaseHost;
  const repairScript = [
    'import os, sqlite3',
    "db = sqlite3.connect('/var/lib/pgadmin/pgadmin4.db')",
    'db.execute("PRAGMA busy_timeout = 5000")',
    'try:',
    "    cursor = db.execute(\"UPDATE server SET host = ? WHERE host != ? AND host IN ('host.containers.internal', '169.254.1.2', 'shadowcheck_postgres_local', 'shadowcheck_postgres', 'postgres', '127.0.0.1', 'localhost')\", (os.environ['TARGET_HOST'], os.environ['TARGET_HOST']))",
    'except sqlite3.OperationalError as error:',
    "    if 'no such table' not in str(error): raise",
    '    cursor = None',
    'db.commit()',
    'print(cursor.rowcount if cursor else 0)',
    'db.close()',
  ].join('\n');

  const result = await runCommand('docker', [
    'exec',
    '-e',
    `TARGET_HOST=${targetHost}`,
    containerName,
    'python3',
    '-c',
    repairScript,
  ]);

  return Number.parseInt(result.stdout.trim(), 10) || 0;
};

const ensureLocalDatabaseNetwork = async () => {
  if (!localMode) {
    return;
  }
  await runCommand('docker', ['network', 'connect', localDatabaseNetwork, containerName], {
    allowFail: true,
  });
};

export {
  composeFile,
  composeFileExists,
  containerName,
  databaseHost,
  dockerHost,
  enforceRestartPolicy,
  localMode,
  localDatabaseNetwork,
  parseDockerStatus,
  pgAdminEmail,
  pgAdminPassword,
  port,
  probePgAdminReachable,
  removePgAdminContainer,
  ensureLocalDatabaseNetwork,
  repairSavedServerHost,
  runCommand,
  runCompose,
  serviceName,
  url,
  volumeName,
};
