/**
 * Read-only, mount-aware Express API route audit.
 *
 * This tool statically resolves production route mounts without loading the
 * server, connecting to a database, or invoking route handlers.
 *
 * Usage:
 *   npx tsx scripts/audit/api-route-audit.ts
 *   npx tsx scripts/audit/api-route-audit.ts \
 *     --markdown-out /tmp/shadowcheck-api-audit.md \
 *     --json-out /tmp/shadowcheck-api-audit.json
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import ts from 'typescript';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL';
type AuthGate = 'public' | 'authenticated-user' | 'admin-only' | 'api-key';

interface ImportedBinding {
  file: string;
  importedName?: string;
}

interface DeclaredRoute {
  method: HttpMethod;
  routePath: string;
  sourceFile: string;
  sourceLine: number;
  directAuth?: AuthGate;
  generatedBy?: string;
  ownerFunction?: string;
}

interface ChildMount {
  prefixes: string[];
  childFile: string;
  sourceFile: string;
  sourceLine: number;
  description: string;
  selectedFunction?: string;
}

interface ModuleInfo {
  file: string;
  routes: DeclaredRoute[];
  children: ChildMount[];
  moduleAuth?: AuthGate;
  unresolved: string[];
}

interface RootMount {
  prefixes: string[];
  moduleFile: string;
  dependencyName: string;
  auth: AuthGate;
  sourceFile: string;
  sourceLine: number;
}

interface ResolvedRouteOccurrence {
  method: HttpMethod;
  fullPath: string;
  sourceFile: string;
  sourceLine: number;
  mountSource: string;
  auth: AuthGate;
  generatedBy?: string;
}

interface RegistryEntry {
  method: HttpMethod;
  path: string;
  comparisonPath: string;
  category?: string;
  label?: string;
  manualOnly: boolean;
  isDestructive: boolean;
  sourceLine: number;
}

interface DocsEntry {
  method: HttpMethod;
  path: string;
  comparisonPath: string;
  sourceLine: number;
  raw: string;
}

interface RuntimeRoute {
  method: HttpMethod;
  path: string;
  sources: string[];
  mountSources: string[];
  auth: AuthGate;
  authVariants: AuthGate[];
  riskCategories: string[];
  registryEntries: RegistryEntry[];
  duplicateOccurrences: number;
}

interface AuditReport {
  generatedAt: string;
  gitHead: string;
  counts: {
    runtimeRoutes: number;
    routeOccurrences: number;
    duplicateRuntimeKeys: number;
    registryEntries: number;
    registryRouteKeys: number;
    generatedRouteOccurrences: number;
    registryMissingRuntime: number;
    runtimeMissingRegistry: number;
    routeInventoryEntries: number;
    apiReferenceEntries: number;
    runtimeMissingRouteInventory: number;
    runtimeMissingApiReference: number;
    routeInventoryMissingRuntime: number;
    apiReferenceMissingRuntime: number;
  };
  runtimeRoutes: RuntimeRoute[];
  registryParity: {
    runtimeMissingRegistry: Array<RuntimeRoute & { intentionalOmission?: string }>;
    registryMissingRuntime: RegistryEntry[];
  };
  docsParity: {
    runtimeMissingRouteInventory: RuntimeRoute[];
    runtimeMissingApiReference: RuntimeRoute[];
    routeInventoryMissingRuntime: DocsEntry[];
    apiReferenceMissingRuntime: DocsEntry[];
  };
  warnings: string[];
  limitations: string[];
}

const ROUTE_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all']);
const AUTH_ORDER: Record<AuthGate, number> = {
  public: 0,
  'authenticated-user': 1,
  'api-key': 1,
  'admin-only': 2,
};

const args = process.argv.slice(2);
const repoRoot = path.resolve(readArg('--root') ?? process.cwd());
const routeRoot = path.join(repoRoot, 'server/src/api/routes');
const moduleCache = new Map<string, ModuleInfo>();
const sourceCache = new Map<string, ts.SourceFile>();
const warnings = new Set<string>();

function readArg(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function relative(file: string): string {
  return path.relative(repoRoot, file).split(path.sep).join('/');
}

function readSource(file: string): ts.SourceFile {
  const cached = sourceCache.get(file);
  if (cached) {
    return cached;
  }

  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS
  );
  sourceCache.set(file, source);
  return source;
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function propertyName(node: ts.PropertyName | undefined): string | undefined {
  if (!node) {
    return undefined;
  }
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function stringValues(node: ts.Expression | undefined): string[] {
  if (!node) {
    return [];
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return [node.text];
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.flatMap((element) =>
      ts.isExpression(element) ? stringValues(element) : []
    );
  }
  return [];
}

function booleanValue(node: ts.Expression | undefined): boolean | undefined {
  if (!node) {
    return undefined;
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  return undefined;
}

function objectProperties(node: ts.ObjectLiteralExpression): Map<string, ts.Expression> {
  const result = new Map<string, ts.Expression>();
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }
    const name = propertyName(property.name);
    if (name) {
      result.set(name, property.initializer);
    }
  }
  return result;
}

function normalizePath(value: string): string {
  let result = value.trim().split('?')[0].replace(/\\/g, '/');
  result = result.replace(/\{([A-Za-z0-9_]+)\}/g, ':$1');
  result = result.replace(/:([A-Za-z0-9_]+)\(\*\)/g, ':$1');
  result = result.replace(/\/+/g, '/');
  if (!result.startsWith('/')) {
    result = `/${result}`;
  }
  if (result.length > 1) {
    result = result.replace(/\/+$/, '');
  }
  return result || '/';
}

function joinPaths(prefix: string, fragment: string): string {
  if (prefix === '/') {
    return normalizePath(fragment);
  }
  if (fragment === '/') {
    return normalizePath(prefix);
  }
  return normalizePath(`${prefix}/${fragment}`);
}

function routeKey(method: HttpMethod, routePath: string): string {
  return `${method} ${normalizePath(routePath)}`;
}

function findRequireSpecifier(node: ts.Node): string | undefined {
  let result: string | undefined;
  const visit = (current: ts.Node): void => {
    if (result) {
      return;
    }
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === 'require'
    ) {
      result = stringValues(current.arguments[0] as ts.Expression | undefined)[0];
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return result;
}

function resolveLocalModule(fromFile: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) {
    return undefined;
  }
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.js`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.js'),
  ];
  return candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  );
}

function collectImportedBindings(source: ts.SourceFile): Map<string, ImportedBinding> {
  const bindings = new Map<string, ImportedBinding>();

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = stringValues(statement.moduleSpecifier as ts.Expression)[0];
      const resolved = specifier ? resolveLocalModule(source.fileName, specifier) : undefined;
      if (!resolved || !statement.importClause) {
        continue;
      }

      if (statement.importClause.name) {
        bindings.set(statement.importClause.name.text, { file: resolved, importedName: 'default' });
      }
      const named = statement.importClause.namedBindings;
      if (named && ts.isNamedImports(named)) {
        for (const element of named.elements) {
          bindings.set(element.name.text, {
            file: resolved,
            importedName: element.propertyName?.text ?? element.name.text,
          });
        }
      }
      continue;
    }

    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (!declaration.initializer) {
        continue;
      }
      const specifier = findRequireSpecifier(declaration.initializer);
      const resolved = specifier ? resolveLocalModule(source.fileName, specifier) : undefined;
      if (!resolved) {
        continue;
      }

      if (ts.isIdentifier(declaration.name)) {
        bindings.set(declaration.name.text, { file: resolved });
      } else if (ts.isObjectBindingPattern(declaration.name)) {
        for (const element of declaration.name.elements) {
          if (!ts.isIdentifier(element.name)) {
            continue;
          }
          bindings.set(element.name.text, {
            file: resolved,
            importedName: element.propertyName
              ? propertyName(element.propertyName)
              : element.name.text,
          });
        }
      }
    }
  }

  return bindings;
}

function authFromText(text: string): AuthGate | undefined {
  if (/\brequireAdmin\b/.test(text)) {
    return 'admin-only';
  }
  if (/\bvalidateApiKey\b/.test(text)) {
    return 'api-key';
  }
  if (/\brequireAuth\b/.test(text)) {
    return 'authenticated-user';
  }
  if (/\bvalidateSession\s*\(/.test(text)) {
    return 'authenticated-user';
  }
  return undefined;
}

function enclosingFunctionName(node: ts.Node): string | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return current.name.text;
    }
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      current.parent &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
    current = current.parent;
  }
  return undefined;
}

function combineAuth(...values: Array<AuthGate | undefined>): AuthGate {
  const defined = values.filter((value): value is AuthGate => Boolean(value));
  if (defined.includes('admin-only')) {
    return 'admin-only';
  }
  if (defined.includes('api-key')) {
    return 'api-key';
  }
  if (defined.includes('authenticated-user')) {
    return 'authenticated-user';
  }
  return 'public';
}

function effectiveAuth(values: AuthGate[]): AuthGate {
  return [...values].sort((a, b) => AUTH_ORDER[a] - AUTH_ORDER[b])[0] ?? 'public';
}

function methodValues(method: string, callText: string): HttpMethod[] {
  if (method !== 'all') {
    return [method.toUpperCase() as HttpMethod];
  }
  const explicit = [
    ...callText.matchAll(/req\.method\s*!==?\s*['"](GET|POST|PUT|PATCH|DELETE)['"]/g),
  ]
    .map((match) => match[1] as HttpMethod)
    .filter((value, index, all) => all.indexOf(value) === index);
  return explicit.length > 0 ? explicit : ['ALL'];
}

function parseDynamicRouteFactories(source: ts.SourceFile): DeclaredRoute[] {
  const routes: DeclaredRoute[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'registerSingleSecretRoutes' &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      const properties = objectProperties(node.arguments[0]);
      const getPath = stringValues(properties.get('getPath'))[0];
      const postPath = stringValues(properties.get('postPath'))[0];
      const postRequiresAuth = booleanValue(properties.get('requireAuthForPost')) !== false;
      const sourceLine = lineOf(source, node);

      if (getPath) {
        routes.push({
          method: 'GET',
          routePath: getPath,
          sourceFile: source.fileName,
          sourceLine,
          directAuth: 'authenticated-user',
          generatedBy: 'registerSingleSecretRoutes',
          ownerFunction: enclosingFunctionName(node),
        });
      }
      if (postPath) {
        routes.push({
          method: 'POST',
          routePath: postPath,
          sourceFile: source.fileName,
          sourceLine,
          directAuth: postRequiresAuth ? 'authenticated-user' : undefined,
          generatedBy: 'registerSingleSecretRoutes',
          ownerFunction: enclosingFunctionName(node),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return routes;
}

function parseRouteModule(file: string): ModuleInfo {
  const cached = moduleCache.get(file);
  if (cached) {
    return cached;
  }

  const source = readSource(file);
  const bindings = collectImportedBindings(source);
  const routes: DeclaredRoute[] = [];
  const children: ChildMount[] = [];
  const unresolved: string[] = [];
  let moduleAuth: AuthGate | undefined;

  const addChild = (
    prefixes: string[],
    binding: ImportedBinding,
    node: ts.Node,
    description: string,
    selectedFunction?: string
  ): void => {
    if (!binding.file.startsWith(routeRoot)) {
      return;
    }
    children.push({
      prefixes,
      childFile: binding.file,
      sourceFile: file,
      sourceLine: lineOf(source, node),
      description,
      selectedFunction,
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = node.left.getText(source);
      if (left === 'module.exports') {
        const specifier = findRequireSpecifier(node.right);
        const resolved = specifier ? resolveLocalModule(file, specifier) : undefined;
        if (resolved?.startsWith(routeRoot)) {
          children.push({
            prefixes: ['/'],
            childFile: resolved,
            sourceFile: file,
            sourceLine: lineOf(source, node),
            description: 'module.exports alias',
          });
        }
      }
    }

    if (!ts.isCallExpression(node)) {
      ts.forEachChild(node, visit);
      return;
    }

    if (ts.isPropertyAccessExpression(node.expression)) {
      const receiver = node.expression.expression.getText(source);
      const method = node.expression.name.text.toLowerCase();

      if (receiver === 'router' && ROUTE_METHODS.has(method)) {
        const paths = stringValues(node.arguments[0] as ts.Expression | undefined);
        const callText = node.getText(source);
        if (paths.length === 0) {
          const dynamicName = node.arguments[0]?.getText(source) ?? '<missing>';
          unresolved.push(
            `${relative(file)}:${lineOf(source, node)} dynamic route path ${dynamicName}`
          );
        } else {
          for (const routePath of paths) {
            for (const routeMethod of methodValues(method, callText)) {
              routes.push({
                method: routeMethod,
                routePath,
                sourceFile: file,
                sourceLine: lineOf(source, node),
                directAuth: authFromText(callText),
                ownerFunction: enclosingFunctionName(node),
              });
            }
          }
        }
      }

      if (receiver === 'router' && method === 'use') {
        const firstArg = node.arguments[0] as ts.Expression | undefined;
        const prefixes = stringValues(firstArg);
        const childStart = prefixes.length > 0 ? 1 : 0;
        const middlewareText = node.arguments.slice(childStart).map((arg) => arg.getText(source));

        if (prefixes.length === 0 && middlewareText.length === 1) {
          const gate = authFromText(middlewareText[0]);
          if (gate) {
            moduleAuth = combineAuth(moduleAuth, gate);
          }
        }

        for (const argument of node.arguments.slice(childStart)) {
          const bindingName = ts.isIdentifier(argument)
            ? argument.text
            : ts.isPropertyAccessExpression(argument) && ts.isIdentifier(argument.expression)
              ? argument.expression.text
              : undefined;
          const binding = bindingName ? bindings.get(bindingName) : undefined;
          if (binding) {
            addChild(prefixes.length > 0 ? prefixes : ['/'], binding, node, 'router.use');
          }
        }
      }
    }

    if (ts.isIdentifier(node.expression)) {
      const callee = node.expression.text;
      const imported = bindings.get(callee);
      if (imported && /^register[A-Za-z0-9_]*Routes$/.test(callee)) {
        addChild(
          ['/'],
          imported,
          node,
          `${callee} registration helper`,
          imported.importedName ?? callee
        );
      }

      if (/^appendRoutes?$/.test(callee)) {
        const argument = node.arguments[0];
        const binding =
          argument && ts.isIdentifier(argument) ? bindings.get(argument.text) : undefined;
        if (binding) {
          addChild(['/'], binding, node, `${callee} stack composition`);
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(source);
  routes.push(...parseDynamicRouteFactories(source));

  const result = { file, routes, children, moduleAuth, unresolved };
  moduleCache.set(file, result);
  return result;
}

function parseRouteDependencies(): Map<string, string> {
  const file = path.join(repoRoot, 'server/src/utils/serverDependencies.ts');
  const source = readSource(file);
  const result = new Map<string, string>();

  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name);
      const specifier = findRequireSpecifier(node.initializer);
      const resolved = specifier ? resolveLocalModule(file, specifier) : undefined;
      if (name && resolved?.startsWith(routeRoot)) {
        result.set(name, resolved);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}

function parseRootMounts(dependencies: Map<string, string>): RootMount[] {
  const file = path.join(repoRoot, 'server/src/utils/routeMounts.ts');
  const source = readSource(file);
  const mounts: RootMount[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(source) === 'app' &&
      node.expression.name.text === 'use'
    ) {
      const prefixes = stringValues(node.arguments[0] as ts.Expression | undefined);
      if (prefixes.length === 0) {
        warnings.add(`${relative(file)}:${lineOf(source, node)} unresolved app.use mount path`);
        return;
      }

      let dependencyName: string | undefined;
      for (let index = node.arguments.length - 1; index >= 1; index -= 1) {
        const argument = node.arguments[index];
        if (ts.isIdentifier(argument) && dependencies.has(argument.text)) {
          dependencyName = argument.text;
          break;
        }
        if (
          ts.isPropertyAccessExpression(argument) &&
          ts.isIdentifier(argument.expression) &&
          dependencies.has(argument.expression.text)
        ) {
          dependencyName = argument.expression.text;
          break;
        }
      }
      if (!dependencyName) {
        return;
      }

      const middlewareText = node.arguments
        .slice(1, -1)
        .map((arg) => arg.getText(source))
        .join(' ');
      const auth = /\badminGate\b/.test(middlewareText)
        ? 'admin-only'
        : /\buserGate\b/.test(middlewareText)
          ? 'authenticated-user'
          : 'public';
      const moduleFile = dependencies.get(dependencyName);
      if (!moduleFile) {
        return;
      }

      mounts.push({
        prefixes,
        moduleFile,
        dependencyName,
        auth,
        sourceFile: file,
        sourceLine: lineOf(source, node),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return mounts;
}

function resolveRuntimeRoutes(rootMounts: RootMount[]): ResolvedRouteOccurrence[] {
  const occurrences: ResolvedRouteOccurrence[] = [];

  const walk = (
    file: string,
    prefix: string,
    inheritedAuth: AuthGate,
    mountChain: string[],
    stack: string[],
    selectedFunction?: string
  ): void => {
    const cycleKey = `${file}|${prefix}`;
    if (stack.includes(cycleKey)) {
      warnings.add(`Router composition cycle stopped at ${relative(file)} mounted on ${prefix}`);
      return;
    }

    const module = parseRouteModule(file);
    const moduleAuth = combineAuth(inheritedAuth, module.moduleAuth);
    for (const route of module.routes) {
      if (selectedFunction && route.ownerFunction !== selectedFunction) {
        continue;
      }
      occurrences.push({
        method: route.method,
        fullPath: joinPaths(prefix, route.routePath),
        sourceFile: route.sourceFile,
        sourceLine: route.sourceLine,
        mountSource: mountChain.join(' -> '),
        auth: combineAuth(moduleAuth, route.directAuth),
        generatedBy: route.generatedBy,
      });
    }

    for (const child of module.children) {
      for (const childPrefix of child.prefixes) {
        walk(
          child.childFile,
          joinPaths(prefix, childPrefix),
          moduleAuth,
          [
            ...mountChain,
            `${relative(child.sourceFile)}:${child.sourceLine} (${child.description})`,
          ],
          [...stack, cycleKey],
          child.selectedFunction
        );
      }
    }

    for (const unresolved of module.unresolved) {
      if (!unresolved.includes('getPath') && !unresolved.includes('postPath')) {
        warnings.add(unresolved);
      }
    }
  };

  for (const mount of rootMounts) {
    for (const prefix of mount.prefixes) {
      walk(
        mount.moduleFile,
        prefix,
        mount.auth,
        [
          `${relative(mount.sourceFile)}:${mount.sourceLine} (${mount.dependencyName} at ${prefix})`,
        ],
        [],
        undefined
      );
    }
  }

  return occurrences;
}

function parseRegistry(): RegistryEntry[] {
  const file = path.join(repoRoot, 'client/src/config/apiTestEndpoints.ts');
  const source = readSource(file);
  const entries: RegistryEntry[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'API_ENDPOINTS' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const element of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(element)) {
          continue;
        }
        const properties = objectProperties(element);
        const method = stringValues(properties.get('method'))[0]?.toUpperCase() as
          | HttpMethod
          | undefined;
        const routePath = stringValues(properties.get('path'))[0];
        if (!method || !routePath) {
          continue;
        }
        entries.push({
          method,
          path: routePath,
          comparisonPath: normalizePath(routePath),
          category: stringValues(properties.get('category'))[0],
          label: stringValues(properties.get('label'))[0],
          manualOnly: booleanValue(properties.get('manualOnly')) === true,
          isDestructive: booleanValue(properties.get('isDestructive')) === true,
          sourceLine: lineOf(source, element),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return entries;
}

function parseDocs(fileName: string): DocsEntry[] {
  const file = path.join(repoRoot, fileName);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const entries = new Map<string, DocsEntry>();

  lines.forEach((raw, index) => {
    const heading = raw.match(/^#{2,6}\s+(GET|POST|PUT|PATCH|DELETE)\s+`?([^`\s]+)`?/i);
    const table = raw.match(/^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`\s*\|/i);
    const match = heading ?? table;
    if (!match) {
      return;
    }

    const method = match[1].toUpperCase() as HttpMethod;
    const routePath = normalizePath(match[2]);
    const key = routeKey(method, routePath);
    if (!entries.has(key)) {
      entries.set(key, {
        method,
        path: match[2],
        comparisonPath: routePath,
        sourceLine: index + 1,
        raw,
      });
    }
  });

  return [...entries.values()];
}

function riskCategories(
  method: HttpMethod,
  routePath: string,
  auth: AuthGate,
  registryEntries: RegistryEntry[],
  inventoryEntry?: DocsEntry
): string[] {
  const categories = [
    auth === 'public'
      ? 'public unauthenticated'
      : auth === 'admin-only'
        ? 'admin-only'
        : 'authenticated user',
  ];
  const registryText = registryEntries
    .map((entry) => `${entry.label ?? ''} ${entry.category ?? ''}`)
    .join(' ');
  const inventoryText = inventoryEntry?.raw ?? '';

  if (
    method === 'DELETE' ||
    registryEntries.some((entry) => entry.isDestructive) ||
    /\/(restore|terminate|destroy|cleanup|purge)(\/|$)/i.test(routePath)
  ) {
    categories.push('destructive');
  }
  if (/\b(internal|test-only|helper)\b/i.test(inventoryText)) {
    categories.push('internal/helper');
  }
  if (
    /\b(legacy|deprecated)\b/i.test(`${registryText} ${inventoryText}`) ||
    /\/legacy(\/|$)/i.test(routePath)
  ) {
    categories.push('deprecated/legacy');
  }
  return categories;
}

function aggregateRuntimeRoutes(
  occurrences: ResolvedRouteOccurrence[],
  registry: RegistryEntry[],
  routeInventory: DocsEntry[]
): RuntimeRoute[] {
  const grouped = new Map<string, ResolvedRouteOccurrence[]>();
  for (const occurrence of occurrences) {
    const key = routeKey(occurrence.method, occurrence.fullPath);
    grouped.set(key, [...(grouped.get(key) ?? []), occurrence]);
  }

  const inventoryByKey = new Map(
    routeInventory.map((entry) => [routeKey(entry.method, entry.comparisonPath), entry])
  );

  return [...grouped.entries()]
    .map(([key, values]) => {
      const [method, ...pathParts] = key.split(' ');
      const routePath = pathParts.join(' ');
      const matchingRegistry = registry.filter(
        (entry) => routeKey(entry.method, entry.comparisonPath) === key
      );
      const authVariants = [...new Set(values.map((value) => value.auth))].sort(
        (a, b) => AUTH_ORDER[a] - AUTH_ORDER[b]
      );
      const auth = effectiveAuth(authVariants);
      return {
        method: method as HttpMethod,
        path: routePath,
        sources: [
          ...new Set(values.map((value) => `${relative(value.sourceFile)}:${value.sourceLine}`)),
        ],
        mountSources: [...new Set(values.map((value) => value.mountSource))],
        auth,
        authVariants,
        riskCategories: riskCategories(
          method as HttpMethod,
          routePath,
          auth,
          matchingRegistry,
          inventoryByKey.get(key)
        ),
        registryEntries: matchingRegistry,
        duplicateOccurrences: Math.max(0, values.length - 1),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

function knownOmissionReason(route: RuntimeRoute, inventory?: DocsEntry): string | undefined {
  if (route.riskCategories.includes('internal/helper')) {
    return 'Route inventory classifies this endpoint as internal/helper or test-only.';
  }
  if (inventory && /\b(intentional|test-only|internal)\b/i.test(inventory.raw)) {
    return 'Route inventory contains an intentional/internal omission note.';
  }
  return undefined;
}

function buildReport(): AuditReport {
  const dependencies = parseRouteDependencies();
  const rootMounts = parseRootMounts(dependencies);
  const occurrences = resolveRuntimeRoutes(rootMounts);
  const registry = parseRegistry();
  const routeInventory = parseDocs('docs/api/route-inventory.md');
  const apiReference = parseDocs('docs/API_REFERENCE.md');
  const runtimeRoutes = aggregateRuntimeRoutes(occurrences, registry, routeInventory);

  const runtimeKeys = new Set(runtimeRoutes.map((route) => routeKey(route.method, route.path)));
  const registryKeys = new Set(
    registry.map((entry) => routeKey(entry.method, entry.comparisonPath))
  );
  const inventoryKeys = new Set(
    routeInventory.map((entry) => routeKey(entry.method, entry.comparisonPath))
  );
  const apiReferenceKeys = new Set(
    apiReference.map((entry) => routeKey(entry.method, entry.comparisonPath))
  );

  const inventoryByKey = new Map(
    routeInventory.map((entry) => [routeKey(entry.method, entry.comparisonPath), entry])
  );
  const runtimeMissingRegistry = runtimeRoutes
    .filter((route) => !registryKeys.has(routeKey(route.method, route.path)))
    .map((route) => ({
      ...route,
      intentionalOmission: knownOmissionReason(
        route,
        inventoryByKey.get(routeKey(route.method, route.path))
      ),
    }));
  const registryMissingRuntime = registry.filter(
    (entry) => !runtimeKeys.has(routeKey(entry.method, entry.comparisonPath))
  );
  const runtimeMissingRouteInventory = runtimeRoutes.filter(
    (route) => !inventoryKeys.has(routeKey(route.method, route.path))
  );
  const runtimeMissingApiReference = runtimeRoutes.filter(
    (route) => !apiReferenceKeys.has(routeKey(route.method, route.path))
  );
  const routeInventoryMissingRuntime = routeInventory.filter(
    (entry) => !runtimeKeys.has(routeKey(entry.method, entry.comparisonPath))
  );
  const apiReferenceMissingRuntime = apiReference.filter(
    (entry) => !runtimeKeys.has(routeKey(entry.method, entry.comparisonPath))
  );

  let gitHead = 'unknown';
  try {
    gitHead = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    warnings.add('Unable to resolve git HEAD.');
  }

  return {
    generatedAt: new Date().toISOString(),
    gitHead,
    counts: {
      runtimeRoutes: runtimeRoutes.length,
      routeOccurrences: occurrences.length,
      duplicateRuntimeKeys: runtimeRoutes.filter((route) => route.duplicateOccurrences > 0).length,
      registryEntries: registry.length,
      registryRouteKeys: registryKeys.size,
      generatedRouteOccurrences: occurrences.filter((route) => route.generatedBy).length,
      registryMissingRuntime: registryMissingRuntime.length,
      runtimeMissingRegistry: runtimeMissingRegistry.length,
      routeInventoryEntries: routeInventory.length,
      apiReferenceEntries: apiReference.length,
      runtimeMissingRouteInventory: runtimeMissingRouteInventory.length,
      runtimeMissingApiReference: runtimeMissingApiReference.length,
      routeInventoryMissingRuntime: routeInventoryMissingRuntime.length,
      apiReferenceMissingRuntime: apiReferenceMissingRuntime.length,
    },
    runtimeRoutes,
    registryParity: { runtimeMissingRegistry, registryMissingRuntime },
    docsParity: {
      runtimeMissingRouteInventory,
      runtimeMissingApiReference,
      routeInventoryMissingRuntime,
      apiReferenceMissingRuntime,
    },
    warnings: [...warnings].sort(),
    limitations: [
      'Static analysis only: runtime-constructed paths that are not string literals or supported provider factories are reported as unresolved.',
      'Express middleware is classified from mount gates, requireAuth/requireAdmin, API-key checks, and simple session heuristics; arbitrary middleware behavior is not executed.',
      'Docs parity recognizes method/path headings and Markdown table rows. Prose-only route mentions are not treated as authoritative entries.',
      'Intentional registry omissions are inferred only from explicit internal/test-only wording in the route inventory; there is no machine-readable omission registry.',
      'ALL routes are expanded only when the handler contains explicit req.method checks; otherwise they remain method ALL.',
      'JavaScript route modules composed by TypeScript routers are included because they are active production dependencies.',
      'Risk labels such as destructive, internal/helper, and deprecated/legacy are heuristic and should be reviewed before remediation.',
      'Duplicate method/path routes are aggregated and show all discovered auth variants; Express ordering can still affect which handler responds first.',
      'Stack-copy composition is recognized for the repository appendRoutes helper pattern. Other arbitrary router.stack mutation would require another resolver.',
    ],
  };
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function routeTable(routes: RuntimeRoute[]): string {
  if (routes.length === 0) {
    return '_None._\n';
  }
  const lines = [
    '| Method | Production Path | Source | Mount Source | Gate | Risk | Registry |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const route of routes) {
    const registry = route.registryEntries.length
      ? route.registryEntries
          .map((entry) => `${entry.label ?? 'registered'}${entry.manualOnly ? ' (manual)' : ''}`)
          .join('; ')
      : 'missing';
    lines.push(
      `| ${route.method} | \`${markdownCell(route.path)}\` | ${markdownCell(route.sources.join('<br>'))} | ${markdownCell(route.mountSources.join('<br>'))} | ${route.auth} | ${markdownCell(route.riskCategories.join(', '))} | ${markdownCell(registry)} |`
    );
  }
  return `${lines.join('\n')}\n`;
}

function registryTable(entries: RegistryEntry[]): string {
  if (entries.length === 0) {
    return '_None._\n';
  }
  const lines = [
    '| Method | Registry Path | Label | Category | Manual Only | Destructive | Source |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const entry of entries) {
    lines.push(
      `| ${entry.method} | \`${markdownCell(entry.path)}\` | ${markdownCell(entry.label ?? '')} | ${markdownCell(entry.category ?? '')} | ${entry.manualOnly ? 'yes' : 'no'} | ${entry.isDestructive ? 'yes' : 'no'} | client/src/config/apiTestEndpoints.ts:${entry.sourceLine} |`
    );
  }
  return `${lines.join('\n')}\n`;
}

function docsTable(entries: DocsEntry[], fileName: string): string {
  if (entries.length === 0) {
    return '_None._\n';
  }
  const lines = [
    '| Method | Documented Path | Source |',
    '| --- | --- | --- |',
    ...entries.map(
      (entry) =>
        `| ${entry.method} | \`${markdownCell(entry.path)}\` | ${fileName}:${entry.sourceLine} |`
    ),
  ];
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(report: AuditReport): string {
  const riskCounts = new Map<string, number>();
  for (const route of report.runtimeRoutes) {
    for (const category of route.riskCategories) {
      riskCounts.set(category, (riskCounts.get(category) ?? 0) + 1);
    }
  }

  return `# Mount-Aware API Route Audit

Generated: ${report.generatedAt}
Git HEAD: \`${report.gitHead}\`

## Executive Summary

| Metric | Count |
| --- | ---: |
| Unique runtime method/path routes | ${report.counts.runtimeRoutes} |
| Resolved route occurrences | ${report.counts.routeOccurrences} |
| Runtime keys with duplicate occurrences | ${report.counts.duplicateRuntimeKeys} |
| API Test Page registry entries | ${report.counts.registryEntries} |
| Unique API Test Page method/path keys | ${report.counts.registryRouteKeys} |
| Routes expanded from supported provider factories | ${report.counts.generatedRouteOccurrences} |
| Runtime routes missing registry entries | ${report.counts.runtimeMissingRegistry} |
| Registry entries without runtime routes | ${report.counts.registryMissingRuntime} |
| Runtime routes missing route inventory docs | ${report.counts.runtimeMissingRouteInventory} |
| Runtime routes missing API reference docs | ${report.counts.runtimeMissingApiReference} |
| Route inventory entries without runtime routes | ${report.counts.routeInventoryMissingRuntime} |
| API reference entries without runtime routes | ${report.counts.apiReferenceMissingRuntime} |

## Risk Summary

${[...riskCounts.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n')}

## Runtime Routes

${routeTable(report.runtimeRoutes)}

## Registry Parity

### Runtime Routes Missing From API Test Registry

${routeTable(report.registryParity.runtimeMissingRegistry)}

### Known Intentional Omission Signals

${
  report.registryParity.runtimeMissingRegistry
    .filter((route) => route.intentionalOmission)
    .map((route) => `- \`${route.method} ${route.path}\`: ${route.intentionalOmission as string}`)
    .join('\n') || '_None identified._'
}

### Registry Entries Without Runtime Routes

${registryTable(report.registryParity.registryMissingRuntime)}

## Documentation Parity

### Runtime Routes Missing From route-inventory.md

${routeTable(report.docsParity.runtimeMissingRouteInventory)}

### Runtime Routes Missing From API_REFERENCE.md

${routeTable(report.docsParity.runtimeMissingApiReference)}

### route-inventory.md Entries Without Runtime Routes

${docsTable(report.docsParity.routeInventoryMissingRuntime, 'docs/api/route-inventory.md')}

### API_REFERENCE.md Entries Without Runtime Routes

${docsTable(report.docsParity.apiReferenceMissingRuntime, 'docs/API_REFERENCE.md')}

## Warnings

${report.warnings.map((warning) => `- ${warning}`).join('\n') || '_None._'}

## Static-Analysis Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join('\n')}
`;
}

function writeOutput(fileName: string | undefined, content: string): void {
  if (!fileName) {
    return;
  }
  fs.writeFileSync(path.resolve(fileName), content);
}

const report = buildReport();
const markdown = renderMarkdown(report);
const markdownOut = readArg('--markdown-out');
const jsonOut = readArg('--json-out');
writeOutput(markdownOut, markdown);
writeOutput(jsonOut, `${JSON.stringify(report, null, 2)}\n`);

if (!markdownOut && !jsonOut) {
  process.stdout.write(markdown);
} else {
  process.stdout.write(
    `${JSON.stringify(
      {
        gitHead: report.gitHead,
        counts: report.counts,
        warnings: report.warnings.length,
        markdownOut: markdownOut ? path.resolve(markdownOut) : undefined,
        jsonOut: jsonOut ? path.resolve(jsonOut) : undefined,
      },
      null,
      2
    )}\n`
  );
}
