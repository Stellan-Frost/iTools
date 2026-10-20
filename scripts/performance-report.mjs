import { execFileSync } from 'node:child_process';
import os from 'node:os';

export function describeMachine() {
  const cpu = os.cpus()[0];
  return {
    platform: os.platform(),
    release: os.release(),
    architecture: os.arch(),
    logicalCpuCount: os.cpus().length,
    cpuModel: cpu?.model ?? 'unknown',
    totalMemoryBytes: os.totalmem(),
    nodeVersion: process.version,
  };
}

export function describeSource(root) {
  try {
    const git = (args) =>
      execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    return {
      revision: git(['rev-parse', 'HEAD']),
      workingTreeDirty: git(['status', '--porcelain']) !== '',
    };
  } catch {
    return { revision: null, workingTreeDirty: null };
  }
}

export function roundedMedian(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  return Math.round(value * 10) / 10;
}

export function ratio(encodedBytes, decodedBytes) {
  if (decodedBytes === 0) return null;
  return Math.round((1 - encodedBytes / decodedBytes) * 1_000) / 1_000;
}
