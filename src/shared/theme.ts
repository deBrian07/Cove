import type { Theme } from './types';

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const v = Number.parseInt(n, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function themeFor(color: string, appearance: 'light' | 'dark'): Theme {
  const accent = hexToRgb(color || '#4C9AFF');
  if (appearance === 'dark') {
    const bg = mix(accent, [22, 22, 26], 0.78);
    return {
      bg: rgbToHex(...bg),
      fg: '#f4f4f6',
      muted: 'rgba(255,255,255,0.58)',
      hover: 'rgba(255,255,255,0.08)',
      active: 'rgba(255,255,255,0.14)',
      line: 'rgba(255,255,255,0.1)',
      accent: rgbToHex(...accent),
      appearance,
    };
  }
  const bg = mix(accent, [246, 243, 237], 0.8);
  return {
    bg: rgbToHex(...bg),
    fg: '#1c1c1e',
    muted: 'rgba(20,20,22,0.55)',
    hover: 'rgba(0,0,0,0.05)',
    active: 'rgba(0,0,0,0.09)',
    line: 'rgba(0,0,0,0.08)',
    accent: rgbToHex(...accent),
    appearance,
  };
}

export const SPACE_COLORS = ['#3EBE8A', '#E09A3E', '#D85A78', '#7B6CF0', '#3D8BFF', '#E36B4A', '#2AA8A0', '#C45AD6'];

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}
