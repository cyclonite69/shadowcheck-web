import * as fs from 'fs';
import * as path from 'path';

function isKmlFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.kml');
}

function walkKmlFiles(currentPath: string, results: string[]): void {
  const stat = fs.statSync(currentPath);

  if (stat.isFile()) {
    if (isKmlFile(currentPath)) {
      results.push(currentPath);
    }
    return;
  }

  for (const entry of fs.readdirSync(currentPath).sort()) {
    walkKmlFiles(path.join(currentPath, entry), results);
  }
}

export function collectKmlFiles(inputPath: string): string[] {
  const resolved = path.resolve(inputPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Input path not found: ${resolved}`);
  }

  const files: string[] = [];
  walkKmlFiles(resolved, files);
  return files;
}

export function deriveKmlSourceFile(inputPath: string, filePath: string): string {
  const resolvedInput = path.resolve(inputPath);
  const resolvedFile = path.resolve(filePath);
  const inputStat = fs.statSync(resolvedInput);

  if (inputStat.isFile()) {
    return path.basename(resolvedFile);
  }

  const relativePath = path.relative(resolvedInput, resolvedFile).split(path.sep).join('/');
  return relativePath || path.basename(resolvedFile);
}
