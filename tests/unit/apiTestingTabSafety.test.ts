import fs from 'fs';
import path from 'path';
import {
  AUTOMATED_API_PRESETS,
  MANUAL_API_PRESETS,
} from '../../client/src/components/admin/hooks/apiTestingPresets';

function extractRunner(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Unable to locate runner boundaries: ${start}`);
  }

  return source.slice(startIndex, endIndex);
}

function extractGuardRunCallback(runner: string): string {
  const guardIndex = runner.indexOf('withTestDbGuard(');
  const callbackMarker = 'run: async () => {';
  const callbackStart = runner.indexOf(callbackMarker, guardIndex);
  const callbackEnd = runner.indexOf('\n        },\n      });', callbackStart);

  if (guardIndex < 0 || callbackStart < 0 || callbackEnd < 0) {
    throw new Error('Unable to locate withTestDbGuard run callback');
  }

  return runner.slice(callbackStart + callbackMarker.length, callbackEnd);
}

describe('API Test Page safety buckets', () => {
  test('wires separate automated and operator-manual preset sections', () => {
    const tabSource = fs.readFileSync(
      path.resolve(process.cwd(), 'client/src/components/admin/tabs/ApiTestingTab.tsx'),
      'utf8'
    );
    const hookSource = fs.readFileSync(
      path.resolve(process.cwd(), 'client/src/components/admin/hooks/useApiTesting.ts'),
      'utf8'
    );

    expect(AUTOMATED_API_PRESETS.length).toBeGreaterThan(0);
    expect(MANUAL_API_PRESETS.length).toBeGreaterThan(0);
    expect(tabSource).toContain('title="Automated Presets"');
    expect(tabSource).toContain('title="Manual / Destructive / External-Effect Endpoints"');
    expect(tabSource).toContain('These presets are never included in bulk verification.');
    expect(tabSource).toContain('AUTOMATED_API_PRESETS.map');
    expect(tabSource).toContain('MANUAL_API_PRESETS.map');
    expect(hookSource).toContain('for (const preset of AUTOMATED_API_PRESETS)');
    expect(hookSource).not.toContain('for (const preset of API_PRESETS)');
    expect(tabSource).not.toContain('Include Destructive Tests');
  });

  test('routes runApiRequest and runAllTests through withTestDbGuard', () => {
    const hookSource = fs.readFileSync(
      path.resolve(process.cwd(), 'client/src/components/admin/hooks/useApiTesting.ts'),
      'utf8'
    );

    expect(hookSource).toMatch(
      /import\s*\{[^}]*withTestDbGuard[^}]*\}\s*from\s*['"]\.\/apiTestingDbGuard['"]/
    );

    const runners = [
      extractRunner(
        hookSource,
        'const runApiRequest = async () => {',
        'const [testingAll, setTestingAll]'
      ),
      extractRunner(hookSource, 'const runAllTests = async () => {', 'const testsAllowed ='),
    ];

    for (const runner of runners) {
      const runCallback = extractGuardRunCallback(runner);
      const runnerFetchCount = [...runner.matchAll(/\bfetch\s*\(/g)].length;
      const callbackFetchCount = [...runCallback.matchAll(/\bfetch\s*\(/g)].length;

      expect(runner).toContain('withTestDbGuard(');
      expect(runner).toContain('setApiError(outcome.reason)');
      expect(callbackFetchCount).toBeGreaterThan(0);
      expect(runnerFetchCount).toBe(callbackFetchCount);
    }

    expect(runners[1]).toContain('for (const preset of AUTOMATED_API_PRESETS)');
    expect(extractGuardRunCallback(runners[1])).toContain(
      'for (const preset of AUTOMATED_API_PRESETS)'
    );
  });

  test('resolves a single-request target before the DB guard and fetches only that path', () => {
    const hookSource = fs.readFileSync(
      path.resolve(process.cwd(), 'client/src/components/admin/hooks/useApiTesting.ts'),
      'utf8'
    );
    const runner = extractRunner(
      hookSource,
      'const runApiRequest = async () => {',
      'const [testingAll, setTestingAll]'
    );
    const resolverIndex = runner.indexOf('resolveSameOriginTarget(');
    const guardIndex = runner.indexOf('withTestDbGuard(');
    const runCallback = extractGuardRunCallback(runner);

    expect(resolverIndex).toBeGreaterThanOrEqual(0);
    expect(resolverIndex).toBeLessThan(guardIndex);
    expect(runCallback).toContain('fetch(resolvedTarget.path, opts)');
    expect([...runCallback.matchAll(/\bfetch\s*\(/g)]).toHaveLength(1);
  });

  test('surfaces blocked state and reflects the gate on both run buttons', () => {
    const tabSource = fs.readFileSync(
      path.resolve(process.cwd(), 'client/src/components/admin/tabs/ApiTestingTab.tsx'),
      'utf8'
    );

    expect(tabSource).toContain('{testDbBlockReason &&');
    expect(tabSource).toContain('{testDbBlockReason}');
    expect(tabSource).toMatch(/disabled=\{testingAll \|\| apiLoading \|\| !testsAllowed\}/);
    expect(tabSource).toMatch(/disabled=\{apiLoading \|\| !testsAllowed\}/);
  });
});
