const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');
const configPath = path.join(repoRoot, 'scripts', 'modularity-rules.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const globToRegex = (pattern) => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = escaped.replace(/\*\*/g, '::DOUBLE_STAR::').replace(/\*/g, '[^/]*');
  return new RegExp(`^${regex.replace(/::DOUBLE_STAR::/g, '.*')}$`);
};

const listCodeFiles = (baseDir) => {
  const results = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
          continue;
        }
        walk(fullPath);
        continue;
      }

      if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        results.push(path.relative(repoRoot, fullPath));
      }
    }
  };

  walk(path.join(repoRoot, baseDir));
  return results.sort();
};

const allFiles = Array.from(
  new Set([...listCodeFiles('client/src'), ...listCodeFiles('server/src')])
);

const getNodeLineSpan = (sourceFile, node) => {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
  return end - start + 1;
};

const isRequireCall = (node) =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === 'require' &&
  node.arguments.length === 1 &&
  ts.isStringLiteral(node.arguments[0]);

const collectExportsFromModuleExports = (node) => {
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isPropertyAccessExpression(node.left) &&
    ts.isIdentifier(node.left.expression) &&
    node.left.expression.text === 'module' &&
    node.left.name.text === 'exports'
  ) {
    if (ts.isObjectLiteralExpression(node.right)) {
      return node.right.properties.length;
    }
    return 1;
  }
  return 0;
};

const analyzeFile = (relativePath) => {
  const absolutePath = path.join(repoRoot, relativePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    absolutePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  let importCount = 0;
  let exportCount = 0;
  let functionCount = 0;
  let maxFunctionLines = 0;

  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
      importCount += 1;
    }
    if (isRequireCall(node)) {
      importCount += 1;
    }

    if (
      (ts.canHaveModifiers(node) &&
        (ts.getModifiers(node) || []).some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
        )) ||
      ts.isExportAssignment(node) ||
      ts.isExportDeclaration(node)
    ) {
      exportCount += 1;
    }

    exportCount += collectExportsFromModuleExports(node);

    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      functionCount += 1;
      maxFunctionLines = Math.max(maxFunctionLines, getNodeLineSpan(sourceFile, node));
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return {
    lineCount: content.split(/\r?\n/).length,
    importCount,
    exportCount,
    functionCount,
    maxFunctionLines,
  };
};

const failures = [];
const rows = [];

const checkFile = (relativePath, rules) => {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) {
    failures.push(`ERROR: File ${relativePath} not found`);
    return;
  }

  const metrics = analyzeFile(relativePath);
  const checks = [
    ['lines', 'lineCount', rules.maxLines],
    ['imports', 'importCount', rules.maxImports],
    ['exports', 'exportCount', rules.maxExports],
    ['functions', 'functionCount', rules.maxFunctions],
    ['largest-fn', 'maxFunctionLines', rules.maxFunctionLines],
  ];

  for (const [label, key, threshold] of checks) {
    if (threshold === undefined) {
      continue;
    }
    const current = metrics[key];
    rows.push({ file: relativePath, metric: label, current, threshold });
    if (current > threshold) {
      failures.push(`${relativePath} exceeds ${label}: ${current} > ${threshold}`);
    }
  }
};

for (const [file, rules] of Object.entries(config.files || {})) {
  checkFile(file, rules);
}

for (const entry of config.globs || []) {
  const regex = globToRegex(entry.pattern);
  const matches = allFiles.filter((file) => regex.test(file));
  if (matches.length === 0) {
    failures.push(`ERROR: Pattern ${entry.pattern} matched no files`);
    continue;
  }
  for (const file of matches) {
    if (entry.rules) {
      checkFile(file, entry.rules);
    }
  }
}

console.log('=== Structural Modularity Check ===');
console.log('------------------------------------------------------------');
console.log('File | Metric | Current | Threshold');
console.log('------------------------------------------------------------');
for (const row of rows) {
  console.log(`${row.file} | ${row.metric} | ${row.current} | ${row.threshold}`);
}
console.log('------------------------------------------------------------');

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log('SUCCESS: Structural modularity checks passed.');
