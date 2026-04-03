export {};
const multer = require('multer');
const path = require('path');
const fsNative = require('fs');
const fs = fsNative.promises;
const configContainer = require('../../../../config/container');
const secretsManager = configContainer.secretsManager;

const SQLITE_MAGIC = Buffer.from('53514c69746520666f726d61742033', 'hex');
const PROJECT_ROOT = process.cwd();

const upload = multer({
  dest: '/tmp/',
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowedExts = ['.sqlite', '.db', '.sqlite3', '.kismet'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only SQLite files (.sqlite, .db, .sqlite3, .kismet) are allowed'));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 },
});

const sqlUpload = multer({
  dest: '/tmp/',
  fileFilter: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.sql') {
      cb(null, true);
    } else {
      cb(new Error('Only .sql files are allowed'));
    }
  },
  limits: { fileSize: 200 * 1024 * 1024 },
});

const kmlUpload = multer({
  dest: '/tmp/',
  fileFilter: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.kml') {
      cb(null, true);
    } else {
      cb(new Error('Only .kml files are allowed'));
    }
  },
  limits: { fileSize: 200 * 1024 * 1024, files: 1000 },
});

async function validateSQLiteMagic(filePath: string): Promise<boolean> {
  const fd = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(15);
    const { bytesRead } = await fd.read(buf, 0, 15, 0);
    return bytesRead === 15 && buf.equals(SQLITE_MAGIC);
  } finally {
    await fd.close();
  }
}

function getImportCommand(sqliteFile: string, sourceTag: string, originalName: string) {
  const isKismet = originalName.toLowerCase().endsWith('.kismet');
  const scriptBase = isKismet ? 'kismet-import' : 'sqlite-import';

  const compiledCandidates = [
    path.join(PROJECT_ROOT, `dist/server/etl/load/${scriptBase}.js`),
    path.join(PROJECT_ROOT, `etl/load/${scriptBase}.js`),
    path.join(`/app/dist/server/etl/load/${scriptBase}.js`),
  ];
  const tsxCandidates = [
    path.join(PROJECT_ROOT, 'node_modules/.bin/tsx'),
    path.join('/app/node_modules/.bin/tsx'),
  ];
  const tsScriptCandidates = [
    path.join(PROJECT_ROOT, `etl/load/${scriptBase}.ts`),
    path.join(`/app/etl/load/${scriptBase}.ts`),
  ];

  const compiledScript = compiledCandidates.find((p) => fsNative.existsSync(p));
  const tsxBin = tsxCandidates.find((p) => fsNative.existsSync(p));
  const tsScript = tsScriptCandidates.find((p) => fsNative.existsSync(p));

  if (tsxBin && tsScript && process.env.NODE_ENV !== 'production') {
    return { cmd: tsxBin, args: [tsScript, sqliteFile, sourceTag] };
  }
  if (compiledScript) {
    return { cmd: 'node', args: [compiledScript, sqliteFile, sourceTag] };
  }
  if (tsxBin && tsScript) {
    return { cmd: tsxBin, args: [tsScript, sqliteFile, sourceTag] };
  }

  throw new Error(`${scriptBase} script not found (checked consolidated tsx and compiled paths)`);
}

function getKmlImportCommand(inputPath: string, sourceType: string) {
  const scriptBase = 'kml-import';

  const compiledCandidates = [
    path.join(PROJECT_ROOT, `dist/server/etl/load/${scriptBase}.js`),
    path.join(PROJECT_ROOT, `etl/load/${scriptBase}.js`),
    path.join(`/app/dist/server/etl/load/${scriptBase}.js`),
  ];
  const tsxCandidates = [
    path.join(PROJECT_ROOT, 'node_modules/.bin/tsx'),
    path.join('/app/node_modules/.bin/tsx'),
  ];
  const tsScriptCandidates = [
    path.join(PROJECT_ROOT, `etl/load/${scriptBase}.ts`),
    path.join(`/app/etl/load/${scriptBase}.ts`),
  ];

  const compiledScript = compiledCandidates.find((p) => fsNative.existsSync(p));
  const tsxBin = tsxCandidates.find((p) => fsNative.existsSync(p));
  const tsScript = tsScriptCandidates.find((p) => fsNative.existsSync(p));

  if (tsxBin && tsScript && process.env.NODE_ENV !== 'production') {
    return { cmd: tsxBin, args: [tsScript, inputPath, sourceType] };
  }
  if (compiledScript) {
    return { cmd: 'node', args: [compiledScript, inputPath, sourceType] };
  }
  if (tsxBin && tsScript) {
    return { cmd: tsxBin, args: [tsScript, inputPath, sourceType] };
  }

  throw new Error(`${scriptBase} script not found (checked consolidated tsx and compiled paths)`);
}

function getSqlImportCommand(sqlFile: string) {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME || 'shadowcheck_db';
  const dbUser = process.env.DB_ADMIN_USER || 'shadowcheck_admin';
  const dbPassword =
    secretsManager.get('db_admin_password') || secretsManager.get('db_password') || '';

  const args = [
    '-h',
    dbHost,
    '-p',
    dbPort,
    '-U',
    dbUser,
    '-d',
    dbName,
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    sqlFile,
  ];

  return {
    cmd: 'psql',
    args,
    env: {
      ...process.env,
      PGPASSWORD: dbPassword,
    },
  };
}

module.exports = {
  upload,
  sqlUpload,
  kmlUpload,
  validateSQLiteMagic,
  getImportCommand,
  getKmlImportCommand,
  getSqlImportCommand,
  PROJECT_ROOT,
};
