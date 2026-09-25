import fs from 'node:fs';
import path from 'node:path';

export type AuditCliOptions = {
  date: string;
  stdout: boolean;
  output: string | null;
  top: number;
};

export const parseAuditCli = (argv: string[]): AuditCliOptions => {
  const options: AuditCliOptions = {
    date: new Date().toISOString().slice(0, 10),
    stdout: false,
    output: null,
    top: 100,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--stdout') {
      options.stdout = true;
    } else if (argument === '--date') {
      options.date = argv[++index] || '';
    } else if (argument === '--output') {
      options.output = argv[++index] || '';
    } else if (argument === '--top') {
      options.top = Number(argv[++index]);
    } else {
      throw new Error(`Unknown audit option: ${argument}`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    throw new Error(`Invalid --date value: ${options.date}`);
  }
  if (!Number.isInteger(options.top) || options.top < 1 || options.top > 1000) {
    throw new Error(`Invalid --top value: ${options.top}`);
  }
  return options;
};

export const emitAuditReport = (
  repoRoot: string,
  defaultFilename: string,
  markdown: string,
  options: AuditCliOptions
): void => {
  if (options.stdout) {
    process.stdout.write(markdown);
    return;
  }
  const auditsRoot = path.resolve(repoRoot, 'docs/audits');
  const requested = options.output
    ? path.resolve(repoRoot, options.output)
    : path.join(auditsRoot, defaultFilename);
  if (requested !== auditsRoot && !requested.startsWith(`${auditsRoot}${path.sep}`)) {
    throw new Error('Audit reports may only be written under docs/audits/.');
  }
  fs.mkdirSync(path.dirname(requested), { recursive: true });
  fs.writeFileSync(requested, markdown.endsWith('\n') ? markdown : `${markdown}\n`, 'utf8');
  process.stdout.write(`${path.relative(repoRoot, requested)}\n`);
};
