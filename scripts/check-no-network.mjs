#!/usr/bin/env node
/**
 * 隐私边界检查：本地处理包不得出现任何网络发送能力。
 * docs/08、docs/05 要求用户文件与结果只在浏览器本地处理，
 * 这里用静态扫描把“不得上传”从口头约定变成可重复的门禁。
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** 只允许在本地处理数据的包；新增此类包必须显式加入并说明理由。 */
const LOCAL_ONLY_PACKAGES = ['packages/asset-store', 'packages/task-runtime'];

/** 任何会离开本机的调用形态。 */
const FORBIDDEN_PATTERNS = [
  { pattern: /\bfetch\s*\(/, label: 'fetch()' },
  { pattern: /new\s+XMLHttpRequest\b/, label: 'XMLHttpRequest' },
  { pattern: /new\s+WebSocket\b/, label: 'WebSocket' },
  { pattern: /\bEventSource\b/, label: 'EventSource' },
  { pattern: /\bsendBeacon\s*\(/, label: 'navigator.sendBeacon()' },
];

async function collectSourceFiles(dir, files = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectSourceFiles(path, files);
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name)
    ) {
      files.push(path);
    }
  }
  return files;
}

const violations = [];
for (const packagePath of LOCAL_ONLY_PACKAGES) {
  for (const file of await collectSourceFiles(
    resolve(root, packagePath, 'src'),
  )) {
    const source = await readFile(file, 'utf8');
    for (const { pattern, label } of FORBIDDEN_PATTERNS) {
      if (pattern.test(source)) {
        violations.push(`${relative(root, file)}: 出现 ${label}`);
      }
    }
  }
}

if (violations.length > 0) {
  for (const violation of violations) console.error(violation);
  console.error(`\n隐私边界检查失败：${violations.length} 处网络调用。`);
  process.exit(1);
}

console.log(
  `隐私边界检查通过：${LOCAL_ONLY_PACKAGES.length} 个本地包无网络调用。`,
);
