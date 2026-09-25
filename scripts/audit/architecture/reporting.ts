import type {
  AuditFinding,
  CruftAuditResult,
  ModularityAuditResult,
  RepositoryInventory,
  RoadmapItem,
} from './types';
import { classifyRole } from './modularityAnalysis';

const sanitize = (value: string): string =>
  value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

const renderMetadata = (inventory: RepositoryInventory): string => `
Generated: ${inventory.generatedDate}

Git HEAD: \`${inventory.head}\`

Mode: static, read-only analysis; findings are candidates, not deletion or refactor authorization.
`;

const renderFindingTable = (findings: AuditFinding[], top = 100): string => {
  if (findings.length === 0) {
    return '_No findings in this category._\n';
  }
  const rows = findings
    .slice(0, top)
    .map(
      (finding) =>
        `| ${finding.severity.toUpperCase()} | ${finding.confidence} | \`${finding.path}\` | ${sanitize(finding.evidence)} | ${sanitize(finding.recommendation)} |`
    );
  const suffix =
    findings.length > top
      ? `\n_${findings.length - top} additional findings omitted by report limit._\n`
      : '';
  return `| Severity | Confidence | Path | Evidence | Recommended verification |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n${suffix}`;
};

export const renderCruftReport = (
  inventory: RepositoryInventory,
  result: CruftAuditResult,
  top = 100
): string => `# Cruft Audit — ${inventory.generatedDate}
${renderMetadata(inventory)}
## Scope and Method

The generator reads \`package.json\`, TypeScript configs, env example key names, and static imports/exports across configured source roots. It does not delete files, change dependencies, inspect secret values, or claim dynamic runtime reachability.

## Summary

| Category | Candidates |
| --- | ---: |
| Unreferenced files | ${result.unreferencedFiles.length} |
| Unused exports | ${result.unusedExports.length} |
| Orphan tests | ${result.orphanTests.length} |
| Dependencies | ${result.dependencyCandidates.length} |
| Environment keys | ${result.envCandidates.length} |
| Temporary files | ${result.temporaryFiles.length} |

## Unreferenced File Candidates

${renderFindingTable(result.unreferencedFiles, top)}
## Unused Export Candidates

${renderFindingTable(result.unusedExports, top)}
## Orphan Test Candidates

${renderFindingTable(result.orphanTests, top)}
## Dependency Candidates

${renderFindingTable(result.dependencyCandidates, top)}
## Environment and Config Drift

Only environment key names are compared. Values are never read or emitted.

${renderFindingTable(result.envCandidates, top)}
## Temporary and Campaign File Candidates

${renderFindingTable(result.temporaryFiles, top)}
## Required Human Gate

No candidate in this report is approved for deletion. Confirm dynamic imports, CLI entrypoints, route mounting, deployment references, and focused tests before any removal.
`;

export const renderModularityReport = (
  inventory: RepositoryInventory,
  result: ModularityAuditResult,
  top = 100
): string => {
  const largestRows = result.largestModules.slice(0, Math.min(top, 30)).map((record) => {
    const fanIn = (inventory.inboundReferences.get(record.path) || []).length;
    const fanOut = new Set(
      record.imports.map((reference) => reference.resolvedPath).filter(Boolean)
    ).size;
    return `| \`${record.path}\` | ${classifyRole(record.path)} | ${record.metrics.lineCount} | ${record.metrics.importCount} | ${record.metrics.functionCount} | ${record.metrics.maxFunctionLines} | ${fanIn} | ${fanOut} |`;
  });
  return `# Modularity Audit — ${inventory.generatedDate}
${renderMetadata(inventory)}
## Assessment Model

This report separates the existing opt-in policy thresholds from broader role, coupling, and responsibility review signals. Line count is evidence, not a verdict; generated data, fixtures, and comprehensive tests can be legitimately large.

## Summary

| Category | Findings |
| --- | ---: |
| Existing policy failures | ${result.policyFindings.length} |
| Role violations/reviews | ${result.roleViolations.length} |
| Coupling candidates | ${result.couplingCandidates.length} |
| Structural threshold candidates | ${result.oversizedModules.length} |

## Existing \`policy:modularity\` Findings

${renderFindingTable(result.policyFindings, top)}
## Role and Layer Findings

${renderFindingTable(result.roleViolations, top)}
## Coupling Findings

${renderFindingTable(result.couplingCandidates, top)}
## Structural Threshold Findings

${renderFindingTable(result.oversizedModules, top)}
## Largest Modules Context

| Path | Role | Lines | Imports | Functions | Largest fn | Fan-in | Fan-out |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${largestRows.join('\n')}

## Interpretation Rule

High-confidence role findings should be reviewed before line-count-only candidates. Every refactor requires characterization tests, and database mutators or stored SQL remain deferred/high-risk work.
`;
};

export const renderArchitectureReport = (
  inventory: RepositoryInventory,
  modularity: ModularityAuditResult,
  cruft: CruftAuditResult,
  top = 50
): string => `# Full Architecture Audit — ${inventory.generatedDate}
${renderMetadata(inventory)}
## Executive Summary

- Existing modularity policy failures: **${modularity.policyFindings.length}**
- Role/coupling findings: **${modularity.roleViolations.length + modularity.couplingCandidates.length}**
- Structural threshold findings: **${modularity.oversizedModules.length}**
- Cruft candidates: **${cruft.findings.length}**

This combined report intentionally preserves separate modularity and cruft evidence. It does not auto-refactor or auto-delete.

## Highest-Priority Modularity Findings

${renderFindingTable(
  modularity.findings.filter(
    (finding) => finding.severity === 'high' || finding.category.includes('role')
  ),
  top
)}
## Highest-Confidence Cruft Findings

${renderFindingTable(
  cruft.findings.filter(
    (finding) => finding.confidence === 'high' || finding.confidence === 'medium'
  ),
  top
)}
## Safe Workflow

1. Lock current behavior with focused characterization tests.
2. Extract pure logic before moving side effects.
3. Isolate DB mutators only after integration coverage exists.
4. Split stored SQL last.
5. Delete cruft only after explicit review and runtime-reference checks.
`;

export const renderRoadmapReport = (
  inventory: RepositoryInventory,
  items: RoadmapItem[],
  top = 100
): string => {
  const stages = [1, 2, 3, 4, 5]
    .map((stage) => {
      const stageItems = items.filter((item) => item.stage === stage).slice(0, top);
      const heading = [
        '',
        'Role Locks and Characterization Tests',
        'Extract Pure Decision Logic',
        'Isolate Side Effects',
        'Split SQL and Rule Sieves Last',
        'Confirm and Remove Cruft',
      ][stage];
      const rows = stageItems.map(
        (item) =>
          `| ${item.priority} | ${item.risk} | \`${item.path}\` | ${sanitize(item.goal)} | ${sanitize(item.rationale)} | ${sanitize(item.requiredTests.join('; '))} |`
      );
      return `## Stage ${stage}: ${heading}\n\n${
        rows.length > 0
          ? `| Priority | Risk | Path | Goal | Rationale | Required tests |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}`
          : '_No current items._'
      }`;
    })
    .join('\n\n');
  return `# Architecture Refactor Roadmap — ${inventory.generatedDate}
${renderMetadata(inventory)}
## Sequencing Contract

\`Role locks → Pure extraction → Side-effect isolation → SQL split → Cruft removal\`

Risky database or stored-function changes are never promoted ahead of characterization coverage. Cruft candidates require explicit deletion approval.

${stages}

## Refresh Cadence

- Per PR: \`npm run policy:modularity\`, \`npm run lint:boundaries\`, \`npm run type-check\`.
- Weekly: cruft and light modularity audits.
- Monthly or after major subsystem merges: full architecture audit and roadmap refresh.
`;
};
