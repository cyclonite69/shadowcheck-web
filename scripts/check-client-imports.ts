import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const clientPaths = [
  'client/src/components',
  'client/src/hooks',
  'client/src/stores',
  'client/src/utils',
  'client/src/App.tsx',
  'client/src/main.tsx',
];

const excludeFiles = new Set<string>();

const restrictedRoots = [
  path.join(repoRoot, 'server', 'src', 'api'),
  path.join(repoRoot, 'server', 'src', 'services'),
  path.join(repoRoot, 'server', 'src', 'repositories'),
  path.join(repoRoot, 'server', 'src', 'middleware'),
  path.join(repoRoot, 'server', 'src', 'validation'),
];

const importRegex = /(?:import\s+[^'"]*\s+from\s+|require\()\s*['"]([^'"]+)['"]\s*\)?/g;

const isRelative = (specifier: string): boolean => specifier.startsWith('.');

const listFiles = (entry: string): string[] => {
  const abs = path.resolve(repoRoot, entry);
  if (!fs.existsSync(abs)) {
    return [];
  }

  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    return [abs];
  }

  if (stat.isDirectory()) {
    const files: string[] = [];
    const entries = fs.readdirSync(abs);
    for (const subEntry of entries) {
      files.push(...listFiles(path.join(entry, subEntry)));
    }
    return files;
  }

  return [];
};

const checkFile = (filePath: string): void => {
  if (excludeFiles.has(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    const specifier = match[1];
    if (!isRelative(specifier)) {
      continue;
    }

    const resolvedPath = path.resolve(path.dirname(filePath), specifier);

    // Check if import points to restricted server paths
    for (const restrictedRoot of restrictedRoots) {
      if (resolvedPath.startsWith(restrictedRoot)) {
        console.error(`❌ VIOLATION: ${path.relative(repoRoot, filePath)}`);
        console.error(`   Imports: ${specifier} → ${path.relative(repoRoot, resolvedPath)}`);
        console.error('   Client code cannot import from server paths\n');
        process.exit(1);
      }
    }
  }
};

// Main execution
console.log('🔍 Checking client import boundaries...\n');

const allFiles: string[] = [];
for (const clientPath of clientPaths) {
  allFiles.push(...listFiles(clientPath));
}

const jstsFiles = allFiles.filter(
  (f) => f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.tsx')
);

console.log(`📁 Found ${jstsFiles.length} JS/TS files in client paths`);

for (const file of jstsFiles) {
  checkFile(file);
}

console.log('✅ All client imports are valid - no server boundary violations found');
