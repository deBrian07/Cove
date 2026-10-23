// Shared 16px stroke icons keep the browser chrome consistent at every scale.
const paths: Record<string, string> = {
  back: '<path d="m10 3-5 5 5 5M5 8h9"/>',
  forward: '<path d="m6 3 5 5-5 5M11 8H2"/>',
  reload: '<path d="M13 6a5.3 5.3 0 1 0 .2 4M13 2v4H9"/>',
  stop: '<rect x="4" y="4" width="8" height="8" rx="1"/>',
  sidebar: '<rect x="2" y="3" width="12" height="10" rx="2"/><path d="M6 3v10"/>',
  search: '<circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  close: '<path d="m5 5 6 6m0-6-6 6"/>',
  library: '<path d="M3 3h3v10H3zM9 3l3-.5 2 10-3 .5z"/>',
  globe: '<circle cx="8" cy="8" r="6"/><ellipse cx="8" cy="8" rx="2.5" ry="6"/><path d="M2 8h12"/>',
  lock: '<rect x="4" y="7" width="8" height="6" rx="2"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
  folder: '<path d="M2 5V4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z"/>',
  chevron: '<path d="m6 4 4 4-4 4"/>',
  audio: '<path d="M3 6h3l3-3v10l-3-3H3zM12 5a5 5 0 0 1 0 6"/>',
};
export function chromeIcon(name: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths[name] || paths.globe;
  return svg;
}
