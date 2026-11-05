import type { AuditFinding, RepositoryInventory } from './architecture/types';
import type { TestGapAuditResult } from './testGapAnalysis';

type TestGapSection = {
  title: string;
  findings: AuditFinding[];
  note?: string;
};

const sanitize = (value: string): string =>
  value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

const renderFindings = (findings: TestGapSection['findings'], top: number): string => {
  if (findings.length === 0) {
    return '_No candidates found._\n';
  }
  const rows = findings
    .slice(0, top)
    .map(
      (finding) =>
        `| \`${finding.path}\` | ${finding.confidence} | ${sanitize(finding.evidence)} | ${sanitize(finding.recommendation)} |`
    );
  const suffix =
    findings.length > top
      ? `\n_${findings.length - top} additional findings omitted by the report limit._\n`
      : '';
  return `| File | Confidence | Evidence | Review guidance |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n${suffix}`;
};

export const renderTestGapReport = (
  inventory: RepositoryInventory,
  result: TestGapAuditResult,
  top = 100
): string => {
  const metricAvailabilityNote = (metric: 'branch' | 'function', matchedFiles: number): string => {
    if (matchedFiles === 0) {
      return `No usable per-file ${metric} metrics matched the inventory; this section is unavailable.`;
    }
    const coverage = `${metric === 'branch' ? 'Branch' : 'Function'} metrics matched ${matchedFiles} of ${result.coverageEligibleFiles} inventoried application modules`;
    return matchedFiles < result.coverageEligibleFiles
      ? `${coverage}; missing records are not treated as zero, so this section is incomplete.`
      : `${coverage}.`;
  };
  const functionDetailsNote = (() => {
    switch (result.coverageFunctionDetailsStatus) {
      case 'missing':
        return result.coverageFunctionMatchedFiles > 0
          ? 'The coverage-final artifact is missing; summary-level function totals remain available, but function names are unavailable.'
          : 'The coverage-final artifact is missing, and no per-file function totals matched the inventory.';
      case 'not-applicable':
        return 'No per-file function totals are available to reconcile with function details.';
      case 'incomplete':
        return `${result.coverageFunctionDetailsIncompleteFiles} file(s) have missing or incomplete function details; names are shown only for reconciled files.`;
      case 'inconsistent':
        return `${result.coverageFunctionDetailsMismatchedFiles} file(s) have function-detail counts inconsistent with the summary; names are shown only for reconciled files.`;
      case 'reconciled':
        return `Function details reconcile with summary totals for ${result.coverageFunctionDetailsMatchedFiles} file(s).`;
    }
  })();
  const artifactTimeNote =
    result.coverageArtifactTimeDeltaMs === null
      ? 'Modification-time difference unavailable because both artifacts are not present.'
      : `Modification times differ by ${result.coverageArtifactTimeDeltaMs} ms; reporters write sequentially, so timestamps alone do not prove whether artifacts came from the same run.`;
  const sections: TestGapSection[] = [
    {
      title: 'Source Modules Without Direct Test Imports',
      findings: result.untestedModules,
      note: 'Function-bearing source files only. Indirect imports and runtime registration are not inferred; type-only imports and Jest mock references may count as test references.',
    },
    {
      title: 'Modules With Uncovered Branches',
      findings: result.uncoveredBranches,
      note: metricAvailabilityNote('branch', result.coverageBranchMatchedFiles),
    },
    {
      title: 'Modules With Incomplete Function Coverage',
      findings: result.uncoveredFunctions,
      note: `${metricAvailabilityNote('function', result.coverageFunctionMatchedFiles)} ${functionDetailsNote}`,
    },
    {
      title: 'Skipped, Todo, or Disabled Test Markers',
      findings: result.skippedTests,
      note: 'Static scan for Jest skip/todo markers and x-prefixed test declarations.',
    },
    {
      title: 'Unresolved Relative Imports in Tests',
      findings: result.brokenImports,
      note: 'Only relative paths that do not match an inventoried source or asset file are reported.',
    },
    {
      title: 'Integration Coverage Review Candidates',
      findings: result.integrationCandidates,
      note: 'Heuristic: a route has a direct unit-test import but no direct integration-test import. App-level or indirect coverage requires human review.',
    },
    {
      title: 'Test Behavior Review Candidates',
      findings: result.qualityCandidates,
      note: 'Heuristic: a test file declares tests but has no recognizable expect/assert calls. Custom helpers and side-effect assertions may be missed.',
    },
  ];

  const summaryRows = sections.map(
    (section) => `| ${section.title} | ${section.findings.length} |`
  );
  const renderedSections = sections
    .map(
      (section) =>
        `## ${section.title}\n\n${section.note ? `_${section.note}_\n\n` : ''}${renderFindings(section.findings, top)}`
    )
    .join('\n');

  return `# Test Gap Audit — ${inventory.generatedDate}

Generated from Git HEAD \`${inventory.head}\`.

## Scope and Limitations

This is a read-only audit. It does not run Jest, modify coverage reports, or determine that a test is meaningful. Static import matching and the integration/test-quality sections are candidates for human review, not proof of missing behavior coverage.

Coverage data is the **latest available snapshot**; this audit does not establish that it is current.

- Summary artifact: **${result.coverageSummaryStatus === 'missing' ? 'missing' : result.coverageSummaryStatus === 'present-unusable' ? 'present, but no usable per-file metrics matched the inventory' : `usable per-file metrics matched ${result.coverageSummaryMatchedFiles} inventoried module(s) (branches: ${result.coverageBranchMatchedFiles}; functions: ${result.coverageFunctionMatchedFiles})`}**${result.coverageSummaryModifiedAt ? `; file modification time ${result.coverageSummaryModifiedAt}` : ''}.
- Function details artifact: **${result.coverageFinalPresent ? 'present' : 'missing'}**${result.coverageFinalModifiedAt ? `; file modification time ${result.coverageFinalModifiedAt}` : ''}. ${artifactTimeNote}
- Missing per-file records are not treated as zero coverage. A usable snapshot may still cover only a subset of modules.

${
  result.coverageSummaryStatus !== 'usable' ||
  result.coverageBranchMatchedFiles < result.coverageEligibleFiles ||
  result.coverageFunctionMatchedFiles < result.coverageEligibleFiles
    ? 'Run `npm run test:cov` when fresh coverage data is intentionally needed; the audit itself never runs tests.'
    : ''
}

## Summary

| Category | Candidates |
| --- | ---: |
${summaryRows.join('\n')}

${renderedSections}
`;
};
