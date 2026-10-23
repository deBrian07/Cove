import { protocol } from 'electron';
import { existsSync, readFileSync } from 'fs';
import { join, resolve, sep } from 'path';

export function registerCoveScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'cove',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

const PAGES = new Set(['/newtab', '/settings', '/library', '/welcome', '/error', '/passwords', '/membership']);

export function handleCoveProtocol(distDir: string, faviconDir: string): void {
  const root = resolve(distDir);
  protocol.handle('cove', (request) => {
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return new Response('bad url', { status: 400 });
    }
    if (url.hostname !== 'app') return new Response('not found', { status: 404 });
    if (url.pathname.startsWith('/favicon/')) {
      const id = url.pathname.slice('/favicon/'.length);
      if (!/^[\w-]+$/.test(id)) return new Response('bad', { status: 400 });
      const file = join(faviconDir, id);
      if (!existsSync(file)) return new Response(null, { status: 404 });
      return new Response(readFileSync(file), { headers: { 'content-type': 'image/png', 'cache-control': 'no-store' } });
    }
    const dynamic = url.pathname.startsWith('/note/') || url.pathname.startsWith('/easel/') || url.pathname.startsWith('/boost/');
    const fileName = PAGES.has(url.pathname) || dynamic ? 'internal.html' : url.pathname.replace(/^\/+/, '');
    if (!fileName || fileName.includes('..')) return new Response('bad', { status: 400 });
    const full = resolve(root, fileName);
    if (!full.startsWith(root + sep) || !existsSync(full)) return new Response('missing', { status: 404 });
    return new Response(readFileSync(full), { headers: { 'content-type': mime(full) } });
  });
}

function mime(file: string): string {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.map')) return 'application/json';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}
