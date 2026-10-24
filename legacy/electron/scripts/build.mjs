import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const shared = {
  bundle: true,
  sourcemap: true,
  target: 'es2022',
};

await esbuild.build({
  ...shared,
  entryPoints: ['src/main/main.ts'],
  outfile: 'dist/main.js',
  platform: 'node',
  external: ['electron'],
  format: 'cjs',
});

await esbuild.build({
  ...shared,
  entryPoints: {
    ui: 'src/preload/ui.ts',
    guest: 'src/preload/guest.ts',
  },
  outdir: 'dist',
  platform: 'node',
  external: ['electron'],
  format: 'cjs',
});

await esbuild.build({
  ...shared,
  entryPoints: {
    shell: 'src/renderer/shell.ts',
    command: 'src/renderer/command.ts',
    internal: 'src/renderer/internal.ts',
    overlay: 'src/renderer/overlay.ts',
  },
  outdir: 'dist',
  platform: 'browser',
  format: 'iife',
});

mkdirSync('dist', { recursive: true });
for (const name of readdirSync('src/renderer')) {
  if (name.endsWith('.html') || name.endsWith('.css')) {
    copyFileSync(join('src/renderer', name), join('dist', name));
  }
}
