import type { Membership } from './types';

export const MEMBER_PALETTES = [
  { page: '#C4A05A', card: '#FBF6EA', ink: '#8A5524', soft: '#C4A27A', wave: ['#F8D7A4', '#F0A15A', '#E07A32'], stamp: '#2F6FE4' },
  { page: '#8E6B4A', card: '#FBF6EA', ink: '#6E4520', soft: '#C4A27A', wave: ['#F6C98A', '#E08A3C', '#C56A28'], stamp: '#2F6FE4' },
  { page: '#5E7A68', card: '#F4F7F2', ink: '#24382C', soft: '#8AA894', wave: ['#D7E8CF', '#7EAE86', '#3E6B50'], stamp: '#2F6FE4' },
  { page: '#6E6488', card: '#F7F4FB', ink: '#3A3154', soft: '#A398BE', wave: ['#E4D8F4', '#A78BC4', '#6E5A96'], stamp: '#2F6FE4' },
  { page: '#3E6F8A', card: '#F3F7F8', ink: '#1C3A48', soft: '#8FB0BE', wave: ['#D5EAF2', '#7EB4CC', '#3E7C96'], stamp: '#2F6FE4' },
];

export function defaultMembership(): Membership {
  return {
    name: '',
    title: '',
    joinedAt: Date.now(),
    palette: 1,
    shape: 'Shape3',
    blob: [6, 6, 12, 4, 7, 9, 4, 6, 12, 11, 8, 5, 11, 2, 7],
  };
}

export function completedYears(joinedAt: number, now = Date.now()): number {
  const start = new Date(joinedAt);
  const end = new Date(now);
  if (Number.isNaN(start.getTime())) return 0;
  let years = end.getFullYear() - start.getFullYear();
  const beforeAnniversary =
    end.getMonth() < start.getMonth() || (end.getMonth() === start.getMonth() && end.getDate() < start.getDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

export function memberDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function paletteFor(index: number) {
  const safe = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 1;
  return MEMBER_PALETTES[(safe - 1 + MEMBER_PALETTES.length) % MEMBER_PALETTES.length];
}

export function wavePath(blob: number[], width = 320, height = 188): string {
  const samples = blob.length >= 3 ? blob : [6, 8, 12, 7, 9, 5, 11, 8, 6];
  const lobes = 3;
  const chunk = Math.max(1, Math.floor(samples.length / lobes));
  const radii = Array.from({ length: lobes }, (_, i) => {
    const slice = samples.slice(i * chunk, i * chunk + chunk);
    const avg = slice.reduce((sum, n) => sum + n, 0) / (slice.length || 1);
    return 28 + (avg / 12) * 26;
  });
  const right = 168 + radii[0];
  let d = `M0 0 H${right} `;
  const centers = [58, 108, 156];
  radii.forEach((radius, i) => {
    const cy = centers[i];
    const rx = radius;
    const ry = radius * 0.92;
    d += `C ${right + 8} ${cy - ry}, ${right - rx} ${cy - ry * 0.2}, ${right - 36} ${cy + ry * 0.15} `;
  });
  d += `C 120 ${height - 8}, 40 ${height - 18}, 0 ${height - 36} Z`;
  return d;
}
