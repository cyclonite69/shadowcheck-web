import fs from 'node:fs';
import path from 'node:path';
import { emitAuditReport, parseAuditCli } from './architecture/cli';
import { buildRepositoryInventory, loadAuditConfig } from './architecture/inventory';
import {
  analyzeTestGaps,
  parseCoverageArtifactJson,
  type CoverageArtifactMetadata,
  type CoverageFinal,
  type CoverageSummary,
} from './testGapAnalysis';
import { renderTestGapReport } from './testGapReporting';

const repoRoot = path.resolve(__dirname, '../..');
const options = parseAuditCli(process.argv.slice(2));
const config = loadAuditConfig(repoRoot);
const inventory = buildRepositoryInventory(repoRoot, options.date, config);

type LoadedCoverageArtifact = {
  data: Record<string, unknown> | null;
  modifiedAt: string | null;
};

const readCoverageArtifact = (filePath: string): LoadedCoverageArtifact => {
  if (!fs.existsSync(filePath)) {
    return { data: null, modifiedAt: null };
  }
  const modifiedAt = fs.statSync(filePath).mtime.toISOString();
  const artifactPath = path.relative(repoRoot, filePath);
  const data = parseCoverageArtifactJson(artifactPath, fs.readFileSync(filePath, 'utf8'));
  return { data, modifiedAt };
};

const coverageSummaryArtifact = readCoverageArtifact(
  path.join(repoRoot, 'coverage/coverage-summary.json')
);
const coverageFinalArtifact = readCoverageArtifact(
  path.join(repoRoot, 'coverage/coverage-final.json')
);
const coverageSummary = coverageSummaryArtifact.data as CoverageSummary | null;
const coverageFinal = coverageFinalArtifact.data as CoverageFinal | null;
const artifactMetadata: CoverageArtifactMetadata = {
  summaryModifiedAt: coverageSummaryArtifact.modifiedAt,
  finalModifiedAt: coverageFinalArtifact.modifiedAt,
};
const result = analyzeTestGaps(inventory, coverageSummary, coverageFinal, artifactMetadata);
const report = renderTestGapReport(inventory, result, options.top);

emitAuditReport(repoRoot, `${options.date}-test-gap-audit.md`, report, options);
