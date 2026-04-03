export interface KmlImportCounts {
  filesImported: number;
  pointsImported: number;
}

export function sanitizeRelativePath(input: string): string {
  return input
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/');
}

export function parseRelativePathsPayload(rawRelativePaths: unknown): string[] {
  if (typeof rawRelativePaths !== 'string' || !rawRelativePaths.trim()) {
    return [];
  }

  const parsed = JSON.parse(rawRelativePaths);
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid relative_paths payload');
  }

  return parsed.map((value) => String(value || ''));
}

export function getKmlImportHistoryContext(
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

export function parseKmlImportCounts(output: string, fallbackFileCount: number): KmlImportCounts {
  const filesMatch = output.match(/Files:\s+([\d,]+)/);
  const pointsMatch = output.match(/Points:\s+([\d,]+)/);

  return {
    filesImported: filesMatch ? parseInt(filesMatch[1].replace(/,/g, ''), 10) : fallbackFileCount,
    pointsImported: pointsMatch ? parseInt(pointsMatch[1].replace(/,/g, ''), 10) : 0,
  };
}
