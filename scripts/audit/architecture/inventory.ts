import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import type {
  ArchitectureAuditConfig,
  ImportReference,
  PackageManifest,
  RepositoryInventory,
  SourceMetrics,
  SourceRecord,
} from './types';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

const toPosix = (value: string): string => value.split(path.sep).join('/');

export const globToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const wildcarded = escaped.replace(/\*\*/g, '::DOUBLE::').replace(/\*/g, '[^/]*');
  return new RegExp(`^${wildcarded.replace(/::DOUBLE::/g, '.*')}$`);
};

const shouldExclude = (relativePath: string, config: ArchitectureAuditConfig): boolean =>
  config.excludes.some((entry) => relativePath === entry || relativePath.startsWith(`${entry}/`));

const walkFiles = (
  repoRoot: string,
  relativeDir: string,
  config: ArchitectureAuditConfig,
  results: string[]
): void => {
  const absoluteDir = path.join(repoRoot, relativeDir);
  if (!fs.existsSync(absoluteDir) || shouldExclude(relativeDir, config)) {
    return;
  }
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = toPosix(path.join(relativeDir, entry.name));
    if (shouldExclude(relativePath, config)) {
      continue;
    }
    if (entry.isDirectory()) {
      walkFiles(repoRoot, relativePath, config, results);
    } else if (entry.isFile()) {
      results.push(relativePath);
    }
  }
};

const getNodeLineSpan = (sourceFile: ts.SourceFile, node: ts.Node): number => {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
  return end - start + 1;
};

const hasExportModifier = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));

const collectBindingNames = (name: ts.BindingName): string[] => {
  if (ts.isIdentifier(name)) {
    return [name.text];
  }
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : collectBindingNames(element.name)
  );
};

const getRequireSpecifier = (node: ts.Node): string | null => {
  if (
    !ts.isCallExpression(node) ||
    !ts.isIdentifier(node.expression) ||
    node.expression.text !== 'require' ||
    node.arguments.length !== 1 ||
    !ts.isStringLiteralLike(node.arguments[0])
  ) {
    return null;
  }
  return node.arguments[0].text;
};

const collectModuleExports = (node: ts.Node, exportedNames: Set<string>): number => {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
    return 0;
  }
  if (
    ts.isPropertyAccessExpression(node.left) &&
    ts.isIdentifier(node.left.expression) &&
    node.left.expression.text === 'exports'
  ) {
    exportedNames.add(node.left.name.text);
  }
  if (
    ts.isPropertyAccessExpression(node.left) &&
    ts.isIdentifier(node.left.expression) &&
    node.left.expression.text === 'module' &&
    node.left.name.text === 'exports'
  ) {
    if (ts.isObjectLiteralExpression(node.right)) {
      for (const property of node.right.properties) {
        if (property.name && ts.isIdentifier(property.name)) {
          exportedNames.add(property.name.text);
        }
      }
      return node.right.properties.length;
    } else {
      exportedNames.add('default');
      return 1;
    }
  }
  return 0;
};

export const analyzeSourceText = (relativePath: string, content: string): SourceRecord => {
  const scriptKind = relativePath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : relativePath.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : relativePath.endsWith('.js')
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    relativePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );
  const imports: ImportReference[] = [];
  const exportedNames = new Set<string>();
  let exportCount = 0;
  let functionCount = 0;
  let maxFunctionLines = 0;
  let sideEffectCallCount = 0;
  let sqlStatementCount = 0;

  const addImport = (specifier: string, names: string[], wholeModule: boolean): void => {
    imports.push({ specifier, names, wholeModule, resolvedPath: null });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const clause = node.importClause;
      const names: string[] = [];
      let wholeModule = !clause;
      if (clause?.name) {
        names.push('default');
      }
      if (clause?.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          wholeModule = true;
        } else {
          names.push(
            ...clause.namedBindings.elements.map(
              (element) => element.propertyName?.text ?? element.name.text
            )
          );
        }
      }
      addImport(node.moduleSpecifier.text, names, wholeModule);
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const names =
        node.exportClause && ts.isNamedExports(node.exportClause)
          ? node.exportClause.elements.map(
              (element) => element.propertyName?.text ?? element.name.text
            )
          : [];
      addImport(node.moduleSpecifier.text, names, names.length === 0);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      addImport(node.arguments[0].text, [], true);
    }

    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      addImport(node.argument.literal.text, [], true);
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'jest' &&
      ['mock', 'doMock', 'requireActual'].includes(node.expression.name.text) &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      addImport(node.arguments[0].text, [], true);
    }

    const requireSpecifier = getRequireSpecifier(node);
    if (requireSpecifier) {
      let names: string[] = [];
      let wholeModule = true;
      if (ts.isCallExpression(node) && ts.isVariableDeclaration(node.parent)) {
        if (ts.isObjectBindingPattern(node.parent.name)) {
          names = node.parent.name.elements.flatMap((element) => collectBindingNames(element.name));
          wholeModule = false;
        }
      }
      addImport(requireSpecifier, names, wholeModule);
    }

    if (hasExportModifier(node)) {
      if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
        exportedNames.add(node.name.text);
      }
      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          collectBindingNames(declaration.name).forEach((name) => exportedNames.add(name));
        }
      }
    }
    if (ts.isExportAssignment(node)) {
      exportedNames.add('default');
    }
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      node.exportClause.elements.forEach((element) => exportedNames.add(element.name.text));
    }
    if (hasExportModifier(node) || ts.isExportAssignment(node) || ts.isExportDeclaration(node)) {
      exportCount += 1;
    }
    exportCount += collectModuleExports(node, exportedNames);

    if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
      const literalText = ts.isTemplateExpression(node) ? node.getText(sourceFile) : node.text;
      sqlStatementCount += (
        literalText.match(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/gi) || []
      ).length;
    }

    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      functionCount += 1;
      maxFunctionLines = Math.max(maxFunctionLines, getNodeLineSpan(sourceFile, node));
    }

    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(sourceFile);
      if (/\b(fetch|query|adminQuery|writeFile|unlink|rename|exec|spawn)\b/.test(expression)) {
        sideEffectCallCount += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const metrics: SourceMetrics = {
    lineCount:
      content.length === 0
        ? 0
        : (content.match(/\n/g) || []).length + (content.endsWith('\n') ? 0 : 1),
    importCount: imports.length,
    exportCount,
    functionCount,
    maxFunctionLines,
    sqlStatementCount,
    sideEffectCallCount,
  };
  return { path: relativePath, content, imports, exports: [...exportedNames].sort(), metrics };
};

export const resolveRelativeImport = (
  fromPath: string,
  specifier: string,
  sourcePaths: Set<string>
): string | null => {
  const isProjectAbsolute = /^(?:client|server|etl|scripts|tests)\//.test(specifier);
  if (!specifier.startsWith('.') && !isProjectAbsolute) {
    return null;
  }
  const base = isProjectAbsolute
    ? specifier
    : toPosix(path.normalize(path.join(path.dirname(fromPath), specifier)));
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => `${base}/index${extension}`),
  ];
  return candidates.find((candidate) => sourcePaths.has(candidate)) ?? null;
};

const readEnvExampleKeys = (repoRoot: string): string[] => {
  const files = ['.env.example', '.env.local.example', '.env.production.example'];
  const keys = new Set<string>();
  for (const file of files) {
    const absolute = path.join(repoRoot, file);
    if (!fs.existsSync(absolute)) {
      continue;
    }
    for (const line of fs.readFileSync(absolute, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/);
      if (match) {
        keys.add(match[1]);
      }
    }
  }
  return [...keys].sort();
};

const collectUsedEnvKeys = (records: SourceRecord[]): string[] => {
  const keys = new Set<string>();
  for (const record of records) {
    for (const match of record.content.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      keys.add(match[1]);
    }
    for (const match of record.content.matchAll(/process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g)) {
      keys.add(match[1]);
    }
  }
  return [...keys].sort();
};

export const loadAuditConfig = (repoRoot: string): ArchitectureAuditConfig =>
  JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'scripts/audit/architecture-audit.config.json'), 'utf8')
  ) as ArchitectureAuditConfig;

export const buildRepositoryInventory = (
  repoRoot: string,
  generatedDate: string,
  config = loadAuditConfig(repoRoot)
): RepositoryInventory => {
  const allFiles: string[] = [];
  for (const root of config.roots) {
    walkFiles(repoRoot, root, config, allFiles);
  }
  for (const entry of fs.readdirSync(repoRoot, { withFileTypes: true })) {
    if (entry.isFile() && SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
      allFiles.push(entry.name);
    }
  }
  for (const extra of [
    'package.json',
    'tsconfig.json',
    'tsconfig.server.json',
    'tsconfig.test.json',
    'client/tsconfig.json',
    '.env.example',
  ]) {
    if (fs.existsSync(path.join(repoRoot, extra))) {
      allFiles.push(extra);
    }
  }
  const uniqueFiles = [...new Set(allFiles)].sort();
  const sourceRecords = uniqueFiles
    .filter((file) => SOURCE_EXTENSIONS.includes(path.extname(file)))
    .map((file) => analyzeSourceText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')));
  const sourcePaths = new Set(sourceRecords.map((record) => record.path));
  for (const record of sourceRecords) {
    for (const reference of record.imports) {
      reference.resolvedPath = resolveRelativeImport(record.path, reference.specifier, sourcePaths);
    }
  }
  const inboundReferences = new Map<string, string[]>();
  for (const record of sourceRecords) {
    inboundReferences.set(record.path, []);
  }
  for (const record of sourceRecords) {
    for (const reference of record.imports) {
      if (!reference.resolvedPath) {
        continue;
      }
      inboundReferences.get(reference.resolvedPath)?.push(record.path);
    }
  }
  const packageManifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  ) as PackageManifest;
  let head = 'unknown';
  try {
    head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    // A report remains useful outside a Git checkout.
  }
  return {
    repoRoot,
    head,
    generatedDate,
    allFiles: uniqueFiles,
    sourceRecords,
    sourceByPath: new Map(sourceRecords.map((record) => [record.path, record])),
    inboundReferences,
    packageManifest,
    documentedEnvKeys: readEnvExampleKeys(repoRoot),
    usedEnvKeys: collectUsedEnvKeys(sourceRecords),
  };
};
