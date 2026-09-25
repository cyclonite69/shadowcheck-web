import path from 'node:path';
import type {
  ArchitectureAuditConfig,
  AuditFinding,
  CruftAuditResult,
  RepositoryInventory,
  SourceRecord,
} from './types';
import { globToRegex } from './inventory';

const packageRoot = (specifier: string): string => {
  if (specifier.startsWith('@')) {
    return specifier.split('/').slice(0, 2).join('/');
  }
  return specifier.split('/')[0];
};

const isEntrypoint = (file: string, config: ArchitectureAuditConfig): boolean =>
  config.entrypoints.some((pattern) => globToRegex(pattern).test(file));

const isApplicationSource = (file: string): boolean =>
  /^(client\/src|server\/src|etl)\//.test(file) &&
  !/\.(test|spec)\.[jt]sx?$/.test(file) &&
  !file.endsWith('.d.ts');

const relatedTestCommands = (inventory: RepositoryInventory, sourcePath: string): string[] => {
  const basename = path
    .basename(sourcePath)
    .replace(/\.[^.]+$/, '')
    .toLowerCase();
  const matches = inventory.sourceRecords
    .filter(
      (record) => record.path.startsWith('tests/') && record.path.toLowerCase().includes(basename)
    )
    .slice(0, 3)
    .map((record) => `npx jest ${record.path} --no-coverage --runInBand`);
  return matches.length > 0
    ? matches
    : ['Run the nearest focused unit or integration test before deletion.'];
};

const buildUnreferencedFindings = (
  inventory: RepositoryInventory,
  config: ArchitectureAuditConfig
): AuditFinding[] =>
  inventory.sourceRecords
    .filter((record) => isApplicationSource(record.path))
    .filter((record) => !isEntrypoint(record.path, config))
    .filter((record) => (inventory.inboundReferences.get(record.path) || []).length === 0)
    .map((record) => ({
      id: `unreferenced:${record.path}`,
      category: 'unreferenced-file',
      severity: 'medium',
      confidence: 'medium',
      path: record.path,
      evidence:
        'No static inbound import or require reference was found in audited source/test roots.',
      recommendation:
        'Verify runtime registration, dynamic loading, CLI use, and documentation references before deleting.',
      requiredTests: relatedTestCommands(inventory, record.path),
    }));

const buildUnusedExportFindings = (
  inventory: RepositoryInventory,
  config: ArchitectureAuditConfig
): AuditFinding[] => {
  const findings: AuditFinding[] = [];
  for (const record of inventory.sourceRecords) {
    if (!isApplicationSource(record.path) || isEntrypoint(record.path, config)) {
      continue;
    }
    if (record.exports.length === 0) {
      continue;
    }
    const importers = inventory.sourceRecords.flatMap((candidate) =>
      candidate.imports
        .filter((reference) => reference.resolvedPath === record.path)
        .map((reference) => ({ candidate, reference }))
    );
    if (importers.length === 0 || importers.some(({ reference }) => reference.wholeModule)) {
      continue;
    }
    const importedNames = new Set(importers.flatMap(({ reference }) => reference.names));
    for (const exportedName of record.exports) {
      if (importedNames.has(exportedName)) {
        continue;
      }
      findings.push({
        id: `unused-export:${record.path}:${exportedName}`,
        category: 'unused-export',
        severity: 'low',
        confidence: 'medium',
        path: record.path,
        evidence: `Export \`${exportedName}\` has no matching named static import among ${importers.length} importer(s).`,
        recommendation:
          'Confirm there is no dynamic, reflective, test-only, or external package consumer before removing the export.',
        requiredTests: relatedTestCommands(inventory, record.path),
      });
    }
  }
  return findings;
};

const buildOrphanTestFindings = (inventory: RepositoryInventory): AuditFinding[] =>
  inventory.sourceRecords
    .filter((record) => /\.(test|spec)\.[jt]sx?$/.test(record.path))
    .filter(
      (record) =>
        !record.imports.some(
          (reference) => reference.resolvedPath && !reference.resolvedPath.startsWith('tests/')
        )
    )
    .map((record) => ({
      id: `orphan-test:${record.path}`,
      category: 'orphan-test',
      severity: 'low',
      confidence: 'low',
      path: record.path,
      evidence: 'No statically resolved import or require target outside the test tree was found.',
      recommendation:
        'Inspect mocks, global setup, route registration, and string-based dynamic imports before classifying this test as orphaned.',
      requiredTests: [`npx jest ${record.path} --no-coverage --runInBand`],
    }));

const buildDependencyFindings = (inventory: RepositoryInventory): AuditFinding[] => {
  const usedPackages = new Set<string>();
  for (const record of inventory.sourceRecords) {
    for (const reference of record.imports) {
      if (!reference.specifier.startsWith('.') && !reference.specifier.startsWith('node:')) {
        usedPackages.add(packageRoot(reference.specifier));
      }
    }
  }
  const scriptText = Object.values(inventory.packageManifest.scripts || {}).join('\n');
  return Object.keys(inventory.packageManifest.dependencies || {})
    .filter((dependency) => !usedPackages.has(dependency) && !scriptText.includes(dependency))
    .map((dependency) => ({
      id: `dependency:${dependency}`,
      category: 'dependency-candidate',
      severity: 'low',
      confidence: 'low',
      path: 'package.json',
      evidence: `Dependency \`${dependency}\` has no static import/require reference in audited code roots.`,
      recommendation:
        'Check runtime plugins, native loading, build configuration, and deployment scripts before removal.',
      requiredTests: ['npm ci', 'npm run build', 'npm test -- --no-coverage'],
    }));
};

const buildEnvFindings = (
  inventory: RepositoryInventory,
  config: ArchitectureAuditConfig
): AuditFinding[] => {
  const documented = new Set(inventory.documentedEnvKeys);
  const used = new Set(inventory.usedEnvKeys);
  const ignored = new Set(config.envIgnore);
  const findings: AuditFinding[] = [];
  for (const key of [...used]
    .filter((value) => !documented.has(value) && !ignored.has(value))
    .sort()) {
    findings.push({
      id: `env-undocumented:${key}`,
      category: 'undocumented-env',
      severity: 'medium',
      confidence: 'high',
      path: '.env.example',
      evidence: `Environment key \`${key}\` is referenced in code but absent from checked-in env example files.`,
      recommendation:
        'Document the key name and safe placeholder only; never copy a real secret value.',
      requiredTests: ['npm run policy:secret-disk', 'npm run type-check'],
    });
  }
  for (const key of [...documented]
    .filter((value) => !used.has(value) && !ignored.has(value))
    .sort()) {
    findings.push({
      id: `env-unused:${key}`,
      category: 'unused-env-candidate',
      severity: 'low',
      confidence: 'low',
      path: '.env.example',
      evidence: `Documented environment key \`${key}\` has no direct process.env reference in audited code roots.`,
      recommendation:
        'Check compose interpolation, shell scripts, deployment tooling, and external consumers before removal.',
      requiredTests: ['docker compose config', 'npm run build'],
    });
  }
  return findings;
};

const buildTemporaryFileFindings = (inventory: RepositoryInventory): AuditFinding[] => {
  const pattern = /(^|\/)(?:tmp|temp|scratch)[-_]|\.(?:bak|old|orig|rej|tmp)$|coveragePush\d+/i;
  return inventory.allFiles
    .filter((file) => pattern.test(file))
    .map((file) => ({
      id: `temporary:${file}`,
      category: 'temporary-file',
      severity: 'low',
      confidence: 'medium',
      path: file,
      evidence: 'Filename matches a temporary, backup, rejected-patch, or campaign naming pattern.',
      recommendation: 'Verify provenance and retention requirements before removing or renaming.',
      requiredTests: ['No test command; require explicit human deletion approval.'],
    }));
};

export const analyzeCruft = (
  inventory: RepositoryInventory,
  config: ArchitectureAuditConfig
): CruftAuditResult => {
  const unreferencedFiles = buildUnreferencedFindings(inventory, config);
  const unusedExports = buildUnusedExportFindings(inventory, config);
  const orphanTests = buildOrphanTestFindings(inventory);
  const dependencyCandidates = buildDependencyFindings(inventory);
  const envCandidates = buildEnvFindings(inventory, config);
  const temporaryFiles = buildTemporaryFileFindings(inventory);
  return {
    findings: [
      ...unreferencedFiles,
      ...unusedExports,
      ...orphanTests,
      ...dependencyCandidates,
      ...envCandidates,
      ...temporaryFiles,
    ],
    unreferencedFiles,
    unusedExports,
    orphanTests,
    dependencyCandidates,
    envCandidates,
    temporaryFiles,
  };
};

export const getApplicationSourceRecords = (inventory: RepositoryInventory): SourceRecord[] =>
  inventory.sourceRecords.filter((record) => isApplicationSource(record.path));
