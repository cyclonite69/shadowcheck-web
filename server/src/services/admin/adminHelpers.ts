/**
 * Admin service helper functions.
 */
import * as path from 'path';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import multer from 'multer';

export interface KmlImportCounts {
  filesImported: number;
  pointsImported: number;
}

const SQLITE_MAGIC = Buffer.from('53514c69746520666f726d61742033', 'hex');
export const PROJECT_ROOT = process.cwd();

export const upload = multer({
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

export const sqlUpload = multer({
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

export const kmlUpload = multer({
  dest: '/tmp/',
  fileFilter: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.kml') {
      cb(null, true);
    } else {
      cb(new Error('Only .kml files are allowed'));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024, files: 1000 },
});

export async function validateSQLiteMagic(filePath: string): Promise<boolean> {
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(SQLITE_MAGIC.length);
    await fd.read(buffer, 0, SQLITE_MAGIC.length, 0);
    return buffer.equals(SQLITE_MAGIC);
  } finally {
    await fd.close();
  }
}

export function resolveEtlCommand(scriptBase: string, ...scriptArgs: string[]) {
  if (!/^[a-z0-9-]+$/.test(scriptBase)) {
    throw new Error(`Invalid script base name: ${scriptBase}`);
  }

  const compiledCandidates = [
    path.join(PROJECT_ROOT, `dist/server/etl/load/${scriptBase}.js`),
    path.join(PROJECT_ROOT, `etl/load/${scriptBase}.js`),
    path.join(`/app/dist/server/etl/load/${scriptBase}.js`),
  ];
  const tsxCandidates = [
    path.join(PROJECT_ROOT, `etl/load/${scriptBase}.ts`),
  ];

  const candidate = [...compiledCandidates, ...tsxCandidates].find((c) => fs.existsSync(c));
  if (!candidate) {
    throw new Error(`${scriptBase} script not found (checked consolidated tsx and compiled paths)`);
  }
  
  return {
    command: candidate.endsWith('.ts') ? 'tsx' : 'node',
    args: [candidate, ...scriptArgs],
  };
}

export function getImportCommand(sqliteFile: string, sourceTag: string, originalName: string) {
  const scriptBase = originalName.toLowerCase().endsWith('.kismet') ? 'kismet' : 'wigle';
  return resolveEtlCommand(scriptBase, sqliteFile, sourceTag);
}

export function getKmlImportCommand(kmlFile: string, sourceTag: string) {
  return resolveEtlCommand('kml-import', kmlFile, sourceTag);
}

export function getSqlImportCommand(sqlFile: string, sourceTag: string) {
  return resolveEtlCommand('sqlite-import', sqlFile, sourceTag);
}

export function sanitizeRelativePath(pathStr: string): string {
  return path.normalize(pathStr).replace(/^(\.\.(\/|\\|$))+/, '');
}

export function parseRelativePathsPayload(payload: string): string[] {
  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? parsed.map(sanitizeRelativePath) : [];
  } catch {
    return [];
  }
}

export function getKmlImportHistoryContext(filename: string, uploadedFiles: any[], filePaths: string[]) {
  const firstPath = filePaths[0] || '';
  const safeSourceType = filename.toLowerCase().replace(/[^a-z0-9]/g, '_');
  
  return {
    sourceTag: `kml_${safeSourceType}`.slice(0, 50),
    filename:
      uploadedFiles.length <= 1 ? (firstPath || 'batch.kml') : `${firstPath || 'batch.kml'} (+${uploadedFiles.length - 1} more)`,
  };
}

export function parseKmlImportCounts(output: string, fallbackFileCount: number): KmlImportCounts {
  const filesMatch = output.match(/Files:\s+([\d,]+)/);
  const pointsMatch = output.match(/Points:\s+([\d,]+)/);
  
  return {
    filesImported: filesMatch ? parseInt(filesMatch[1].replace(/,/g, ''), 10) : fallbackFileCount,
    pointsImported: pointsMatch ? parseInt(pointsMatch[1].replace(/,/g, ''), 10) : 0,
  };
}

export const buildContextMenuDemoHtml = () => `
<!DOCTYPE html>
<html>
<head>
    <title>Right-Click Context Menu Test</title>
    <style>
        .context-menu {
            position: absolute; background: white; border: 1px solid #ccc;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 1000; display: none;
        }
        .context-menu-item {
            padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #eee;
        }
    </style>
</head>
<body>
    <div id="contextMenu" class="context-menu">
        <div class="context-menu-item" onclick="openNoteModal()">Add Note</div>
    </div>
    <script>
        function openNoteModal() {
            document.getElementById('modalBssid').textContent = currentBssid;
            document.getElementById('noteModal').style.display = 'block';
            closeContextMenu();
        }
    </script>
</body>
</html>
`;
