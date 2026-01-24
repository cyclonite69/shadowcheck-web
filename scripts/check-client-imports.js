const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const clientPaths = [
  'src/components',
  'src/hooks',
  'src/stores',
  'src/utils',
  'src/App.tsx',
  'src/main.tsx',
];

const excludeFiles = new Set([
  'src/utils/backgroundJobsInit.js',
  'src/utils/credentialsInit.js',
  'src/utils/dashboardInit.js',
  'src/utils/middlewareInit.js',
  'src/utils/serverDependencies.js',
  'src/utils/shutdownHandlers.js',
  'src/utils/staticSetup.js',
  'src/utils/validateSecrets.js',
]);

const restrictedRoots = [
  path.join(repoRoot, 'src', 'api'),
  path.join(repoRoot, 'src', 'services'),
  path.join(repoRoot, 'src', 'repositories'),
  path.join(repoRoot, 'src', 'middleware'),
  path.join(repoRoot, 'src', 'validation'),
];

const importRegex = /(?:import\s+[^'"]*\s+from\s+|require\()\s*['"]([^'"]+)['"]\s*\)?/g;

const isRelative = (specifier) => specifier.startsWith('.');

const listFiles = (entry) => {
  const abs = path.resolve(repoRoot, entry);
  if (!fs.existsSync(abs)) {
    return [];
  }
  const stats = fs.statSync(abs);
  if (stats.isFile()) {
    return [abs];
  }
  const out = [];
  const stack = [abs];
  while (stack.length) {
    const dir = stack.pop();
    const items = fs.readdirSync(dir);
    items.forEach((name) => {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
      } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
        out.push(full);
      }
    });
  }
  return out;
};

const files = clientPaths
  .flatMap(listFiles)
  .filter((file) => !excludeFiles.has(path.relative(repoRoot, file)));
const violations = [];

files.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const specifier = match[1];
    if (!isRelative(specifier)) {
      continue;
    }
    const resolved = path.resolve(path.dirname(file), specifier);
    const isRestricted = restrictedRoots.some((root) => resolved.startsWith(root));
    if (isRestricted) {
      violations.push({ file, specifier });
    }
  }
});

if (violations.length) {
  console.error('Client import boundary violations detected:\n');
  violations.forEach((v) => {
    console.error(`- ${path.relative(repoRoot, v.file)} -> ${v.specifier}`);
  });
  process.exit(1);
}

console.log('Client import boundary check passed.');
