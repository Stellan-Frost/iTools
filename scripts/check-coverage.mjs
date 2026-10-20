#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = new URL('../', import.meta.url);
const baseline = JSON.parse(
  await readFile(
    new URL('quality/coverage-baseline.json', workspaceRoot),
    'utf8',
  ),
);
const root = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(workspaceRoot);
const metrics = ['statements', 'branches', 'functions'];
let failures = 0;

function percentage(covered, total) {
  return total === 0 ? 100 : (covered / total) * 100;
}

function summarize(files) {
  const totals = Object.fromEntries(
    metrics.map((metric) => [metric, { covered: 0, total: 0 }]),
  );
  for (const file of Object.values(files)) {
    for (const count of Object.values(file.s)) {
      totals.statements.total += 1;
      if (count > 0) totals.statements.covered += 1;
    }
    for (const counts of Object.values(file.b)) {
      for (const count of counts) {
        totals.branches.total += 1;
        if (count > 0) totals.branches.covered += 1;
      }
    }
    for (const count of Object.values(file.f)) {
      totals.functions.total += 1;
      if (count > 0) totals.functions.covered += 1;
    }
  }
  return Object.fromEntries(
    metrics.map((metric) => {
      const total = totals[metric];
      return [metric, percentage(total.covered, total.total)];
    }),
  );
}

for (const [packagePath, expected] of Object.entries(baseline.packages)) {
  try {
    const reportPath = resolve(
      root,
      packagePath,
      'coverage/coverage-final.json',
    );
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    if (Object.keys(report).length === 0) {
      throw new Error('coverage report is empty');
    }
    const actual = summarize(report);
    for (const metric of metrics) {
      const floor = expected[metric] - baseline.maximumRegressionPoints;
      const result = actual[metric];
      const passed = result + 0.0001 >= floor;
      process.stdout.write(
        `${passed ? 'PASS' : 'FAIL'} ${packagePath} ${metric}: ${result.toFixed(1)}% (floor ${floor.toFixed(1)}%)\n`,
      );
      if (!passed) failures += 1;
    }
  } catch (error) {
    failures += 1;
    process.stderr.write(
      `FAIL ${packagePath}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
}

if (failures > 0) {
  process.stderr.write(`Coverage gate failed: ${failures} finding(s).\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Coverage gate passed for all 8 packages.\n');
}
