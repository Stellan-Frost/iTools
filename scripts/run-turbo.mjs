import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const executable = fileURLToPath(
  new URL('../node_modules/turbo/bin/turbo', import.meta.url),
);
const result = spawnSync(
  process.execPath,
  [executable, 'run', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, TURBO_TELEMETRY_DISABLED: '1' },
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
