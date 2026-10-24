import { completedYears, memberDate, paletteFor, wavePath } from '../shared/membership';
import { renderMarkdown } from '../shared/markdown';
import type { Action, EaselDoc, Membership } from '../shared/types';

declare global {
  interface Window {
    covePage: {
      boot(): Promise<Boot>;
      onTheme(cb: (appearance: 'light' | 'dark') => void): () => void;
      act(action: Action): Promise<unknown>;
      library(section: string, query: string, offset: number): Promise<{ rows: Lib[]; total: number }>;
    };
  }
}

interface Lib { id: string; title: string; url: string; at: number; space: string; kind: string }
interface Boot {
  path: string;
  query: Record<string, string>;
  theme: { appearance: 'light' | 'dark' };
  settings: Record<string, unknown>;
  info: {
    greeting: string;
    spaceName: string;
    arcAvailable: boolean;
    favorites: { id: string; title: string; url: string; favicon: string }[];
    topSites: { title: string; url: string }[];
    currentHost: string;
  };
  note: { id: string; title: string; body: string } | null;
  easel: { id: string; title: string; doc: EaselDoc | null } | null;
  boost: { id: string; name: string; host: string; css: string; js: string; enabled: boolean } | null;
  passwords: { id: string; origin: string; username: string }[];
  extensions: { id: string; name: string; version: string }[];
  commands: { id: string; title: string; accelerator: string; group: string }[];
  membership: Membership;
}

const app = document.querySelector('#app') as HTMLElement;

window.covePage.onTheme((appearance) => document.body.classList.toggle('dark', appearance === 'dark'));

window.covePage.boot().then(render).catch((error) => {
  app.textContent = error instanceof Error ? error.message : 'This page failed to load.';
});

function render(boot: Boot): void {
  document.body.classList.toggle('dark', boot.theme.appearance === 'dark');
  const path = boot.path;
  if (path === '/membership') return membership(boot);
  if (path === '/newtab') return newtab(boot);
  if (path === '/welcome') return welcome(boot);
  if (path === '/settings') return settings(boot);
  if (path === '/library') return library();
  if (path === '/passwords') return passwords(boot);
  if (path === '/error') return errorPage(boot);
  if (path.startsWith('/note/')) return note(boot);
  if (path.startsWith('/easel/')) return easel(boot);
  if (path.startsWith('/boost/')) return boost(boot);
  app.textContent = 'This page is not available.';
}

function page(...nodes: Node[]): void {
  const wrap = document.createElement('div');
  wrap.className = 'page';
  wrap.append(...nodes);
  app.replaceChildren(wrap);
}

function h1(text: string): HTMLElement {
  const el = document.createElement('h1');
  el.textContent = text;
  return el;
}

function lead(text: string): HTMLElement {
  const el = document.createElement('p');
  el.className = 'lead';
  el.textContent = text;
  return el;
}

function newtab(boot: Boot): void {
  const stage = document.createElement('div');
  stage.className = 'stage';
  stage.classList.add('newtab');
  document.title = 'New Tab';
  const hint = document.createElement('button');
  hint.className = 'action';
  hint.textContent = '⌘T';
  hint.style.background = 'transparent';
  hint.style.color = 'inherit';
  hint.style.fontSize = '28px';
  hint.addEventListener('click', () => window.covePage.act({ type: 'open-command', mode: 'new' }));
  stage.append(hint);
  app.replaceChildren(stage);

}

function welcome(boot: Boot): void {
  const start = button('Start browsing', () => {
    window.covePage.act({ type: 'update-settings', patch: { didOnboard: true } });
    window.covePage.act({ type: 'open-page', page: 'newtab' });
  });
  const importArc = button('Import my Arc sidebar', () => window.covePage.act({ type: 'import-arc' }));
  const card = button('Membership card', () => window.covePage.act({ type: 'open-page', page: 'membership' }));
  const note = lead(boot.info.arcAvailable
    ? 'Cove is Chromium, same family of engine Arc uses for pages. The sidebar, spaces, pins, and command bar are the browser. There is no assistant.'
    : 'Cove keeps tabs in a sidebar, splits a page when you need two, and archives yesterday’s tabs. There is no assistant.');
  page(h1('Cove'), note, start, document.createElement('br'), importArc, card);
}

function settings(boot: Boot): void {
  const box = document.createElement('div');
  const settings = boot.settings;
  toggle(box, 'Block ads and trackers', !!settings.adBlock, (value) => window.covePage.act({ type: 'update-settings', patch: { adBlock: value } }));
  toggle(box, 'Archive Today tabs after 12 hours', Number(settings.archiveAfterHours) > 0, (value) => {
    window.covePage.act({ type: 'update-settings', patch: { archiveAfterHours: value ? 12 : 0 } });
  });
  toggle(box, 'Open links from other apps in Little Cove', settings.openExternalIn === 'little', (value) => {
    window.covePage.act({ type: 'update-settings', patch: { openExternalIn: value ? 'little' : 'space' } });
  });
  toggle(box, 'Sound', !!settings.soundEffects, (value) => window.covePage.act({ type: 'update-settings', patch: { soundEffects: value } }));
  toggle(box, 'Boost JavaScript', !!settings.boostJs, (value) => window.covePage.act({ type: 'update-settings', patch: { boostJs: value } }));
  toggle(box, 'Previews', !!settings.previews, (value) => window.covePage.act({ type: 'update-settings', patch: { previews: value } }));
  const actions = document.createElement('div');
  actions.className = 'grid';
  actions.append(
    button('Import from Arc', () => window.covePage.act({ type: 'import-arc' })),
    button('Import bookmarks', () => window.covePage.act({ type: 'import-bookmarks' })),
    button('Import passwords CSV', () => window.covePage.act({ type: 'import-passwords' })),
    button('Export library', () => window.covePage.act({ type: 'export-library' })),
    button('Choose download folder', () => window.covePage.act({ type: 'select-download-folder' })),
    button('Sync folder', () => window.covePage.act({ type: 'select-sync-folder' })),
    button('Load extension', () => window.covePage.act({ type: 'load-extension' })),
    button('Clear history', () => window.covePage.act({ type: 'clear-history' })),
    button('Clear cache', () => window.covePage.act({ type: 'clear-cache' })),
  );
  const ext = document.createElement('div');
  for (const item of boot.extensions) {
    const row = document.createElement('div');
    row.className = 'hit';
    row.textContent = `${item.name} ${item.version}`;
    row.addEventListener('click', () => window.covePage.act({ type: 'remove-extension', id: item.id }));
    ext.append(row);
  }
  page(h1('Settings'), lead('Chromium pages, a quiet sidebar, and no assistant.'), box, actions, ext);
}

function library(): void {
  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const list = document.createElement('div');
  const search = document.createElement('input');
  search.placeholder = 'Search';
  let section = 'archive';
  const names = ['archive', 'history', 'downloads', 'notes'];
  const drawTabs = () => {
    tabs.replaceChildren();
    for (const name of names) {
      const tab = document.createElement('button');
      tab.textContent = name;
      tab.className = name === section ? 'on' : '';
      tab.addEventListener('click', () => {
        section = name;
        drawTabs();
        void load();
      });
      tabs.append(tab);
    }
  };
  const load = async () => {
    const data = await window.covePage.library(section, search.value, 0);
    list.replaceChildren();
    for (const row of data.rows) {
      const hit = document.createElement('div');
      hit.className = 'hit';
      hit.textContent = row.title || row.url;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = row.url || row.space;
      hit.append(meta);
      hit.addEventListener('click', () => {
        if (section === 'archive') window.covePage.act({ type: 'restore-tab', id: row.id });
        else if (section === 'downloads') window.covePage.act({ type: 'download-action', id: row.id, op: 'open' });
        else if (row.url) window.covePage.act({ type: 'commit-omnibox', query: row.url, target: 'new' });
      });
      list.append(hit);
    }
    if (!data.rows.length) list.textContent = 'Nothing here yet.';
  };
  search.addEventListener('input', () => void load());
  drawTabs();
  page(h1('Library'), search, tabs, list);
  void load();
}

function passwords(boot: Boot): void {
  const list = document.createElement('div');
  for (const item of boot.passwords) {
    const row = document.createElement('div');
    row.className = 'hit';
    row.textContent = `${item.username || 'Saved login'} · ${item.origin}`;
    const fill = button('Fill', () => window.covePage.act({ type: 'fill-password', id: item.id }));
    const remove = button('Delete', () => window.covePage.act({ type: 'delete-password', id: item.id }));
    row.append(fill, remove);
    list.append(row);
  }
  page(h1('Passwords'), lead(`Matches for ${boot.info.currentHost || 'the last site'}. Stored in the system keychain.`), list, button('Import CSV', () => window.covePage.act({ type: 'import-passwords' })));
}

function errorPage(boot: Boot): void {
  const params = new URLSearchParams(location.search);
  const retry = button('Try again', () => {
    const url = params.get('url');
    if (url) window.covePage.act({ type: 'commit-omnibox', query: url, target: 'current' });
  });
  const insecure = button('Open the insecure version', () => window.covePage.act({ type: 'allow-insecure' }));
  page(h1('This page didn’t load'), lead(params.get('desc') || 'The site could not be reached.'), retry, insecure);
  void boot;
}

function note(boot: Boot): void {
  if (!boot.note) return;
  const title = document.createElement('input');
  title.value = boot.note.title;
  const body = document.createElement('textarea');
  body.value = boot.note.body;
  const preview = document.createElement('div');
  const save = () => window.covePage.act({ type: 'update-note', id: boot.note!.id, title: title.value, body: body.value });
  body.addEventListener('input', () => {
    preview.innerHTML = renderMarkdown(body.value);
    save();
  });
  title.addEventListener('change', save);
  preview.innerHTML = renderMarkdown(body.value);
  page(h1('Note'), title, body, preview);
}

function easel(boot: Boot): void {
  if (!boot.easel) return;
  const doc: EaselDoc = boot.easel.doc || { strokes: [], texts: [], camera: { x: 0, y: 0, zoom: 1 } };
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  let drawing = false;
  const redraw = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of doc.strokes) {
      ctx.strokeStyle = stroke.tool === 'erase' ? '#fff' : stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      stroke.points.forEach((value, index) => {
        if (index % 2 === 0) {
          const y = stroke.points[index + 1];
          if (index === 0) ctx.moveTo(value, y);
          else ctx.lineTo(value, y);
        }
      });
      ctx.stroke();
    }
  };
  canvas.addEventListener('pointerdown', (event) => {
    drawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    doc.strokes.push({ tool: 'pen', color: '#1c1c1e', size: 3, points: [x, y] });
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    const stroke = doc.strokes[doc.strokes.length - 1];
    stroke.points.push(((event.clientX - rect.left) / rect.width) * canvas.width, ((event.clientY - rect.top) / rect.height) * canvas.height);
    redraw();
  });
  canvas.addEventListener('pointerup', () => {
    drawing = false;
    window.covePage.act({ type: 'update-easel', id: boot.easel!.id, doc });
  });
  redraw();
  page(h1(boot.easel.title || 'Easel'), canvas);
}

function boost(boot: Boot): void {
  const data = boot.boost || { id: 'new', name: '', host: '', css: '', js: '', enabled: true };
  const name = field(data.name, 'Name');
  const host = field(data.host, 'Site, like example.com');
  const css = document.createElement('textarea');
  css.placeholder = 'CSS';
  css.value = data.css;
  const js = document.createElement('textarea');
  js.placeholder = 'JavaScript';
  js.value = data.js;
  const save = button('Save boost', () => {
    window.covePage.act({
      type: 'save-boost',
      boost: { id: data.id, name: name.value, host: host.value, css: css.value, js: js.value, enabled: true },
    });
  });
  page(h1('Boost'), lead('Your CSS and JavaScript for one site. Nothing is shared.'), name, host, css, js, save);
}

function membership(boot: Boot): void {
  const card = boot.membership;
  const colors = paletteFor(card.palette);
  const years = completedYears(card.joinedAt);
  const shown = Math.max(1, Math.min(6, years || 1));
  document.body.style.background = colors.page;
  const stage = document.createElement('div');
  stage.className = 'stage';
  stage.style.setProperty('--page', colors.page);
  const shell = document.createElement('div');
  shell.className = 'card';
  shell.style.setProperty('--card', colors.card);
  shell.style.setProperty('--ink', colors.ink);
  shell.style.setProperty('--soft', colors.soft);
  const art = document.createElement('div');
  art.className = 'art';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 320 188');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  gradient.id = 'wave';
  gradient.setAttribute('x1', '0');
  gradient.setAttribute('y1', '0');
  gradient.setAttribute('x2', '1');
  gradient.setAttribute('y2', '1');
  colors.wave.forEach((color, index) => {
    const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop.setAttribute('offset', String(index / (colors.wave.length - 1)));
    stop.setAttribute('stop-color', color);
    gradient.append(stop);
  });
  defs.append(gradient);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', wavePath(card.blob));
  path.setAttribute('fill', 'url(#wave)');
  svg.append(defs, path);
  art.append(svg);
  const who = document.createElement('div');
  who.className = 'who';
  const name = document.createElement('h2');
  name.textContent = card.name || 'Member';
  const title = document.createElement('p');
  title.textContent = card.title || 'Cove member';
  who.append(name, title);
  const stamps = document.createElement('div');
  stamps.className = 'stamps';
  for (let year = 1; year <= shown; year += 1) {
    const active = years > 0 && year === years;
    const past = years > year;
    stamps.append(stamp(year, active, past || active ? colors.stamp : colors.soft, colors.card));
  }
  const foot = document.createElement('div');
  foot.className = 'foot';
  const pill = document.createElement('div');
  pill.className = 'pill';
  const mark = document.createElement('strong');
  mark.textContent = 'COVE';
  const hash = document.createElement('span');
  hash.className = 'hash';
  const date = document.createElement('span');
  date.textContent = memberDate(card.joinedAt);
  pill.append(mark, hash, date);
  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.innerHTML = 'MEMBER<br>CARD';
  foot.append(pill, brand);
  const edit = document.createElement('div');
  edit.className = 'edit';
  const nameInput = field(card.name, 'Name');
  const titleInput = field(card.title, 'Title');
  const save = button('Save card', () => {
    window.covePage.act({ type: 'update-membership', patch: { name: nameInput.value, title: titleInput.value } });
  });
  edit.append(nameInput, titleInput, save);
  shell.append(art, who, stamps, foot, edit);
  stage.append(shell);
  app.replaceChildren(stage);
}

function stamp(year: number, active: boolean, color: string, card: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.classList.add('stamp');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '32');
  circle.setAttribute('cy', '32');
  circle.setAttribute('r', '22');
  circle.setAttribute('fill', active ? color : 'none');
  circle.setAttribute('stroke', color);
  circle.setAttribute('stroke-width', '1.6');
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', '32');
  label.setAttribute('y', '38');
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('font-size', '18');
  label.setAttribute('font-family', 'Avenir Next, sans-serif');
  label.setAttribute('font-weight', '700');
  label.setAttribute('fill', active ? card : color);
  label.textContent = String(year);
  svg.append(circle, label);
  return svg;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.className = 'action';
  el.textContent = text;
  el.addEventListener('click', onClick);
  return el;
}

function field(value: string, placeholder: string): HTMLInputElement {
  const input = document.createElement('input');
  input.value = value;
  input.placeholder = placeholder;
  return input;
}

function toggle(parent: HTMLElement, label: string, value: boolean, onChange: (value: boolean) => void): void {
  const line = document.createElement('label');
  line.className = 'line';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value;
  input.style.width = 'auto';
  input.addEventListener('change', () => onChange(input.checked));
  line.append(span, input);
  parent.append(line);
}
