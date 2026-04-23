import { spawn } from 'child_process';
import { PROJECT_ROOT } from '../../services/admin/adminHelpers';
import logger from '../../logging/logger';

export interface ImportResult {
  code: number;
  stdout: string;
  stderr: string;
}

export class ImportService {
  async runImportCommand(
    cmd: string,
    args: string[],
    env: Record<string, string> = {}
  ): Promise<ImportResult> {
    return new Promise((resolve) => {
      const p = spawn(cmd, args, {
        cwd: PROJECT_ROOT,
        env: { ...process.env, ...env },
      });

      let stdout = '';
      let stderr = '';

      p.stdout.on('data', (data) => (stdout += data.toString()));
      p.stderr.on('data', (data) => (stderr += data.toString()));

      p.on('close', (code) => {
        resolve({ code: code || 0, stdout, stderr });
      });
    });
  }

  async runParallelImports(
    tasks: { cmd: string; args: string[]; env?: Record<string, string> }[]
  ): Promise<ImportResult[]> {
    return Promise.all(tasks.map((task) => this.runImportCommand(task.cmd, task.args, task.env)));
  }
}
