import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import electron from 'electron';
await build({ entryPoints: ['scripts/check-ui.ts'], outfile: 'dist/check-ui.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron'], target: 'es2022' });
const result = spawnSync(electron, ['dist/check-ui.cjs'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
