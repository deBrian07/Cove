import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import electron from 'electron';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
await build({ entryPoints: ['scripts/check-ui.ts'], outfile: 'dist/check-ui.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron'], target: 'es2022' });
const profile = mkdtempSync(join(tmpdir(), 'cove-ui-check-'));
let status = 1;
try {
  const result = spawnSync(electron, ['dist/check-ui.cjs'], { stdio: 'inherit', env: { ...process.env, COVE_UI_PROFILE: profile } });
  status = result.status ?? 1;
} finally {
  rmSync(profile, { recursive: true, force: true });
}
process.exit(status);
