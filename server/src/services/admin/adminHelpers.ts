export {};

const multer = require('multer');
const path = require('path');
const fsNative = require('fs');
const fs = fsNative.promises;

interface KmlImportCounts {
  filesImported: number;
  pointsImported: number;
}

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
  limits: { fileSize: 500 * 1024 * 1024, files: 1000 },
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

function resolveEtlCommand(scriptBase: string, ...scriptArgs: string[]) {
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

  const compiledScript = compiledCandidates.find((candidate) => fsNative.existsSync(candidate));
  const tsxBin = tsxCandidates.find((candidate) => fsNative.existsSync(candidate));
  const tsScript = tsScriptCandidates.find((candidate) => fsNative.existsSync(candidate));

  if (tsxBin && tsScript && process.env.NODE_ENV !== 'production') {
    return { cmd: tsxBin, args: [tsScript, ...scriptArgs] };
  }
  if (compiledScript) {
    return { cmd: 'node', args: [compiledScript, ...scriptArgs] };
  }
  if (tsxBin && tsScript) {
    return { cmd: tsxBin, args: [tsScript, ...scriptArgs] };
  }

  throw new Error(`${scriptBase} script not found (checked consolidated tsx and compiled paths)`);
}

function getImportCommand(sqliteFile: string, sourceTag: string, originalName: string) {
  const scriptBase = originalName.toLowerCase().endsWith('.kismet')
    ? 'kismet-import'
    : 'sqlite-import';
  return resolveEtlCommand(scriptBase, sqliteFile, sourceTag);
}

function getKmlImportCommand(inputPath: string, sourceType: string) {
  return resolveEtlCommand('kml-import', inputPath, sourceType);
}

function getSecretsManager() {
  return require('../../config/container').secretsManager;
}

function getSqlImportCommand(sqlFile: string) {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME || 'shadowcheck_db';
  const dbUser = process.env.DB_ADMIN_USER || 'shadowcheck_admin';
  const dbPassword =
    getSecretsManager().get('db_admin_password') || getSecretsManager().get('db_password') || '';

  return {
    cmd: 'psql',
    args: [
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
    ],
    env: {
      ...process.env,
      PGPASSWORD: dbPassword,
    },
  };
}

function sanitizeRelativePath(input: string): string {
  return input
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/');
}

function parseRelativePathsPayload(rawRelativePaths: unknown): string[] {
  if (typeof rawRelativePaths !== 'string' || !rawRelativePaths.trim()) {
    return [];
  }

  const parsed = JSON.parse(rawRelativePaths);
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid relative_paths payload');
  }

  return parsed.map((value) => String(value || ''));
}

function getKmlImportHistoryContext(
  sourceType: string,
  uploadedFiles: Array<{ originalname?: string }>,
  relativePaths: string[]
): { sourceTag: string; filename: string } {
  const safeSourceType =
    (sourceType || 'kml')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_') || 'kml';
  const firstPath = sanitizeRelativePath(
    relativePaths[0] || uploadedFiles[0]?.originalname || 'batch.kml'
  );
  const filename = firstPath || 'batch.kml';

  return {
    sourceTag: `kml_${safeSourceType}`.slice(0, 50),
    filename:
      uploadedFiles.length === 1 ? filename : `${filename} (+${uploadedFiles.length - 1} more)`,
  };
}

function parseKmlImportCounts(output: string, fallbackFileCount: number): KmlImportCounts {
  const filesMatch = output.match(/Files:\s+([\d,]+)/);
  const pointsMatch = output.match(/Points:\s+([\d,]+)/);

  return {
    filesImported: filesMatch ? parseInt(filesMatch[1].replace(/,/g, ''), 10) : fallbackFileCount,
    pointsImported: pointsMatch ? parseInt(pointsMatch[1].replace(/,/g, ''), 10) : 0,
  };
}

const buildContextMenuDemoHtml = () => `
<!DOCTYPE html>
<html>
<head>
    <title>Right-Click Context Menu Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
        th { background: #f5f5f5; }
        .network-row { cursor: context-menu; }
        .network-row:hover { background: #f9f9f9; }
        .context-menu {
            position: absolute; background: white; border: 1px solid #ccc;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 1000; display: none;
        }
        .context-menu-item {
            padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #eee;
        }
        .context-menu-item:hover { background: #f0f0f0; }
        .modal {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 2000;
        }
        .modal-content {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: white; padding: 20px; border-radius: 5px; width: 400px;
        }
        .form-group { margin: 10px 0; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
        .form-group input, .form-group textarea, .form-group select {
            width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;
        }
        .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 3px; cursor: pointer; }
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
    </style>
</head>
<body>
    <h1>🛡️ Right-Click Context Menu Test</h1>
    <p><strong>Instructions:</strong> Right-click on any network row below to see the context menu.</p>

    <table>
        <thead>
            <tr><th>BSSID</th><th>SSID</th><th>Threat Level</th><th>Notes</th></tr>
        </thead>
        <tbody>
            <tr class="network-row" data-bssid="00:00:00:00:6E:36">
                <td>00:00:00:00:6E:36</td><td>TestNetwork</td><td>HIGH</td><td id="notes-00:00:00:00:6E:36">0</td>
            </tr>
            <tr class="network-row" data-bssid="AA:BB:CC:DD:EE:FF">
                <td>AA:BB:CC:DD:EE:FF</td><td>(hidden)</td><td>MED</td><td id="notes-AA:BB:CC:DD:EE:FF">0</td>
            </tr>
            <tr class="network-row" data-bssid="11:22:33:44:55:66">
                <td>11:22:33:44:55:66</td><td>CoffeeShop_WiFi</td><td>LOW</td><td id="notes-11:22:33:44:55:66">0</td>
            </tr>
        </tbody>
    </table>

    <!-- Context Menu -->
    <div id="contextMenu" class="context-menu">
        <div class="context-menu-item" onclick="openNoteModal()">📝 Add Note</div>
        <div class="context-menu-item" onclick="attachMedia()">📎 Attach Media</div>
        <div class="context-menu-item" onclick="closeContextMenu()">❌ Close</div>
    </div>

    <!-- Note Modal -->
    <div id="noteModal" class="modal">
        <div class="modal-content">
            <h3>Add Note</h3>
            <div class="form-group">
                <label>BSSID: <span id="modalBssid" style="font-family: monospace; color: blue;"></span></label>
            </div>
            <div class="form-group">
                <label>Note Type:</label>
                <select id="noteType">
                    <option value="general">General</option>
                    <option value="threat">Threat</option>
                    <option value="location">Location</option>
                    <option value="device_info">Device Info</option>
                </select>
            </div>
            <div class="form-group">
                <label>Note:</label>
                <textarea id="noteContent" rows="4" placeholder="Enter your note..."></textarea>
            </div>
            <div class="form-group">
                <label>Attach File:</label>
                <input type="file" id="fileInput" multiple accept="image/*,video/*,.pdf">
            </div>
            <div>
                <button class="btn btn-primary" onclick="saveNote()">Save Note</button>
                <button class="btn btn-secondary" onclick="closeNoteModal()">Cancel</button>
            </div>
        </div>
    </div>

    <script>
        let currentBssid = null;

        document.addEventListener('contextmenu', function(e) {
            const row = e.target.closest('.network-row');
            if (row) {
                e.preventDefault();
                currentBssid = row.dataset.bssid;

                const menu = document.getElementById('contextMenu');
                menu.style.display = 'block';
                menu.style.left = e.pageX + 'px';
                menu.style.top = e.pageY + 'px';
            }
        });

        document.addEventListener('click', function() {
            document.getElementById('contextMenu').style.display = 'none';
        });

        function openNoteModal() {
            document.getElementById('modalBssid').textContent = currentBssid;
            document.getElementById('noteModal').style.display = 'block';
            closeContextMenu();
        }

        function closeNoteModal() {
            document.getElementById('noteModal').style.display = 'none';
            document.getElementById('noteContent').value = '';
        }

        function closeContextMenu() {
            document.getElementById('contextMenu').style.display = 'none';
        }

        function attachMedia() {
            document.getElementById('fileInput').click();
            closeContextMenu();
        }

        async function saveNote() {
            const content = document.getElementById('noteContent').value.trim();
            const noteType = document.getElementById('noteType').value;

            if (!content) {
                alert('Please enter a note');
                return;
            }

            try {
                const response = await fetch('/api/admin/network-notes/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bssid: currentBssid,
                        content: content,
                        note_type: noteType,
                        user_id: 'demo_user'
                    })
                });

                if (response.ok) {
                    const data = await response.json();

                    const fileInput = document.getElementById('fileInput');
                    if (fileInput.files.length > 0) {
                        for (const file of fileInput.files) {
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('bssid', currentBssid);

                            await fetch('/api/admin/network-notes/' + data.note_id + '/media', {
                                method: 'POST',
                                body: formData
                            });
                        }
                    }

                    const noteCell = document.getElementById('notes-' + currentBssid);
                    const currentCount = parseInt(noteCell.textContent) || 0;
                    noteCell.textContent = currentCount + 1;

                    alert('Note saved successfully!');
                    closeNoteModal();
                } else {
                    alert('Failed to save note');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error saving note');
            }
        }
    </script>
</body>
</html>
`;

module.exports = {
  upload,
  sqlUpload,
  kmlUpload,
  validateSQLiteMagic,
  getImportCommand,
  getKmlImportCommand,
  getSqlImportCommand,
  sanitizeRelativePath,
  parseRelativePathsPayload,
  getKmlImportHistoryContext,
  parseKmlImportCounts,
  buildContextMenuDemoHtml,
  PROJECT_ROOT,
};
