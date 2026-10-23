import type { SearchEngine } from './types';

export function searchUrl(engine: SearchEngine, query: string): string {
  const q = encodeURIComponent(query);
  switch (engine) {
    case 'duckduckgo':
      return `https://duckduckgo.com/?q=${q}`;
    case 'bing':
      return `https://www.bing.com/search?q=${q}`;
    case 'kagi':
      return `https://kagi.com/search?q=${q}`;
    default:
      return `https://www.google.com/search?q=${q}`;
  }
}

export function looksLikeUrl(input: string): string | null {
  const q = input.trim();
  if (!q || /\s/.test(q)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(q)) {
    if (/^https?:\/\//i.test(q)) return q;
    if (/^(cove|file|about):/i.test(q)) return q;
    return null;
  }
  if (/^localhost(:\d+)?(\/.*)?$/i.test(q)) return `http://${q}`;
  if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/.test(q)) return `http://${q}`;
  if (/^[\w.-]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(q)) return `https://${q}`;
  return null;
}

export function resolveQuery(query: string, engine: SearchEngine): string {
  const trimmed = query.trim();
  if (!trimmed) return 'cove://app/newtab';
  return looksLikeUrl(trimmed) || searchUrl(engine, trimmed);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

export function isInternalPage(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'cove:' || u.hostname !== 'app') return false;
    const p = u.pathname;
    return (
      p === '/newtab' ||
      p === '/settings' ||
      p === '/library' ||
      p === '/welcome' ||
      p === '/error' ||
      p === '/passwords' ||
      p.startsWith('/note/') ||
      p.startsWith('/easel/') ||
      p.startsWith('/boost/')
    );
  } catch {
    return false;
  }
}

export function isWebUrl(url: string): boolean {
  try {
    const p = new URL(url).protocol;
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}

export function safeHttpUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function uid(): string {
  return crypto.randomUUID();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function hostMatches(host: string, pattern: string): boolean {
  const p = pattern.trim().toLowerCase().replace(/^\*\./, '');
  const h = host.toLowerCase().replace(/^www\./, '');
  if (!p) return false;
  return h === p || h.endsWith(`.${p}`);
}
