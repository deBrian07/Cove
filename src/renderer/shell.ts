import type { Action, Row, Snapshot } from '../shared/types';

declare global {
  interface Window {
    cove: {
      snapshot(): Promise<Snapshot>;
      dispatch(action: Action): Promise<unknown>;
      onSnapshot(cb: (snapshot: Snapshot) => void): () => void;
    };
  }
}

const COLORS = ['#C5CBB0', '#E7C7A1', '#E7B7C3', '#C9C4E8', '#B7D0E8', '#E7C2B0', '#B7D6D1', '#D7C0E0'];
const EMOJIS = ['🏡', '✦', '💼', '📚', '🌿', '🌙', '⚡', '🎯', '🧪', '🎨', '🗂️', '☕️'];

const essentials = document.querySelector('#essentials') as HTMLElement;
const heading = document.querySelector('#heading') as HTMLElement;
const list = document.querySelector('#list') as HTMLElement;
const foot = document.querySelector('#foot') as HTMLElement;
const toolbar = document.querySelector('#toolbar') as HTMLElement;
const mini = document.querySelector('#mini') as HTMLElement;
const editor = document.querySelector('#editor') as HTMLElement;
const resize = document.querySelector('#resize') as HTMLElement;
const toggle = document.querySelector('#toggle') as HTMLButtonElement;

let snap: Snapshot | null = null;
let editing = '';
let seenRename = '';
let lastSound = -1;
let dragId = '';
let painted = '';

toggle.addEventListener('click', () => window.cove.dispatch({ type: 'toggle-sidebar' }));
resize.addEventListener('mousedown', (event) => {
  if (!snap) return;
  const startX = event.screenX;
  const startW = snap.sidebarWidth;
  const move = (ev: MouseEvent) => window.cove.dispatch({ type: 'set-sidebar-width', width: startW + ev.screenX - startX });
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', () => window.removeEventListener('mousemove', move), { once: true });
});

function paint(next: Snapshot): void {
  const scroll = list.scrollTop;
  snap = next;
  const root = document.documentElement;
  root.style.setProperty('--bg', next.theme.bg);
  root.style.setProperty('--fg', next.theme.fg);
  root.style.setProperty('--muted', next.theme.muted);
  root.style.setProperty('--hover', next.theme.hover);
  root.style.setProperty('--active', next.theme.active);
  root.style.setProperty('--line', next.theme.line);
  root.style.setProperty('--accent', next.theme.accent);
  const open = next.mode !== 'main' || next.sidebarVisible || next.sidebarPeek;
  root.style.setProperty('--side', open ? `${Math.max(240, next.sidebarWidth)}px` : '76px');
  document.body.classList.toggle('collapsed', next.mode === 'main' && !open);
  document.body.classList.toggle('mini-mode', next.mode !== 'main');
  document.body.dataset.appearance = next.theme.appearance;
  const signature = JSON.stringify([next.mode, next.sidebarVisible, next.spaces, next.favorites, next.pinned, next.today, next.host, next.url, next.canBack, next.canForward, next.editSpaceId, next.renameId, next.incognito]);
  if (signature !== painted) {
    painted = signature;
    renderEssentials();
    renderHeading();
    renderList();
    renderFoot();
    renderToolbar();
    renderMini();
    renderEditor();
  }
  list.scrollTop = scroll;
  if (next.renameId && next.renameId !== seenRename) {
    seenRename = next.renameId;
    editing = next.renameId;
    renderList();
  }
  if (!next.renameId) seenRename = '';
  if (lastSound >= 0 && next.sound > lastSound) tick();
  lastSound = next.sound;
}

function renderEssentials(): void {
  if (!snap) return;
  essentials.replaceChildren();
  for (const row of snap.favorites) {
    const button = document.createElement('button');
    button.className = `essential${row.active ? ' active' : ''}`;
    button.title = row.title;
    button.append(icon(row));
    button.addEventListener('click', () => window.cove.dispatch({ type: 'activate-tab', id: row.id }));
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      window.cove.dispatch({ type: 'menu-tab', id: row.id });
    });
    essentials.append(button);
  }
}

function renderHeading(): void {
  if (!snap) return;
  heading.replaceChildren();
  const space = snap.spaces.find((entry) => entry.active) || snap.spaces[0];
  const name = document.createElement('button');
  name.className = 'space-name';
  const glyph = document.createElement('span');
  glyph.textContent = space?.icon || '✦';
  const label = document.createElement('span');
  label.textContent = space?.name || 'Space';
  name.append(glyph, label);
  if (space) name.addEventListener('click', () => window.cove.dispatch({ type: 'menu-space', id: space.id }));
  const clear = document.createElement('button');
  clear.className = 'clear';
  clear.textContent = 'Clear';
  clear.addEventListener('click', () => window.cove.dispatch({ type: 'clear-today' }));
  heading.append(name, clear);
}

function renderList(): void {
  if (!snap) return;
  list.replaceChildren();
  const fresh = document.createElement('button');
  fresh.className = 'line';
  fresh.append(textGlyph('+'), text('New Tab'));
  fresh.addEventListener('click', () => window.cove.dispatch({ type: 'open-command', mode: 'new' }));
  list.append(fresh);
  for (const row of snap.pinned) list.append(rowEl(row, false, 'pinned'));
  for (const row of snap.today) list.append(rowEl(row, false, 'today'));
}

function renderFoot(): void {
  if (!snap) return;
  foot.replaceChildren();
  if (!document.body.classList.contains('collapsed')) {
    const archived = document.createElement('button');
    archived.className = 'archived';
    archived.append(textGlyph('◷'), text('Archived'));
    archived.addEventListener('click', () => window.cove.dispatch({ type: 'open-page', page: 'library' }));
    foot.append(archived);
  }
  const spaces = document.createElement('div');
  spaces.className = 'spaces';
  for (const space of snap.spaces) {
    const chip = document.createElement('button');
    chip.className = `chip${space.active ? ' active' : ''}`;
    chip.style.setProperty('--swatch', space.color);
    chip.textContent = space.icon || '✦';
    chip.title = space.name;
    chip.addEventListener('click', () => window.cove.dispatch({ type: 'activate-space', id: space.id }));
    chip.addEventListener('dblclick', () => window.cove.dispatch({ type: 'menu-space', id: space.id }));
    chip.addEventListener('dragover', (event) => event.preventDefault());
    chip.addEventListener('drop', (event) => {
      event.preventDefault();
      const id = event.dataTransfer?.getData('text/plain') || dragId;
      if (id) window.cove.dispatch({ type: 'move-tab', id, spaceId: space.id });
    });
    spaces.append(chip);
  }
  const add = document.createElement('button');
  add.className = 'add-space';
  add.textContent = '+';
  add.title = 'New space';
  add.addEventListener('click', () => window.cove.dispatch({ type: 'new-space' }));
  spaces.append(add);
  foot.append(spaces);
}

function renderToolbar(): void {
  if (!snap || snap.mode !== 'main') {
    toolbar.replaceChildren();
    return;
  }
  toolbar.replaceChildren();
  toolbar.append(
    tool('←', 'Back', () => window.cove.dispatch({ type: 'back' }), !snap.canBack),
    tool('→', 'Forward', () => window.cove.dispatch({ type: 'forward' }), !snap.canForward),
    tool('↻', 'Reload', () => window.cove.dispatch({ type: 'reload' })),
  );
  const url = document.createElement('button');
  url.className = 'url';
  url.textContent = snap.host && snap.host !== 'app' ? snap.host : 'Search or Enter URL';
  url.title = snap.url;
  url.addEventListener('click', () => window.cove.dispatch({ type: 'open-command', mode: 'edit' }));
  const star = tool('☆', 'Favorite', () => window.cove.dispatch({ type: 'favorite' }));
  const more = tool('•••', 'Site', () => window.cove.dispatch({ type: 'open-site-panel' }));
  toolbar.append(url, star, more);
}

function renderMini(): void {
  if (!snap) return;
  mini.hidden = snap.mode === 'main';
  if (snap.mode === 'main') return;
  mini.replaceChildren();
  const input = document.createElement('input');
  input.value = snap.url;
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') window.cove.dispatch({ type: 'commit-omnibox', query: input.value, target: 'current' });
  });
  const open = document.createElement('button');
  open.textContent = 'Open in Cove';
  open.addEventListener('click', () => window.cove.dispatch({ type: 'open-in-cove' }));
  mini.append(input, open);
}

function rowEl(row: Row, child: boolean, section: 'pinned' | 'today'): HTMLElement {
  const el = document.createElement('div');
  el.className = `row${row.active ? ' active' : ''}${row.unread ? ' unread' : ''}${child ? ' child' : ''}`;
  el.draggable = true;
  if (row.kind === 'folder') el.append(textGlyph(row.collapsed ? '▸' : '▾'));
  else el.append(icon(row));
  if (editing === row.id) {
    const input = document.createElement('input');
    input.className = 'rename';
    input.value = row.title;
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') finish(row.id, input.value);
      if (event.key === 'Escape') { editing = ''; renderList(); }
    });
    input.addEventListener('blur', () => finish(row.id, input.value));
    el.append(input);
    setTimeout(() => input.focus(), 0);
  } else {
    const title = text(row.paneCount > 1 ? `${row.title}  ·  ${row.paneCount}` : row.title);
    title.classList.add('title');
    el.append(title);
  }
  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = '×';
  close.addEventListener('click', (event) => {
    event.stopPropagation();
    window.cove.dispatch({ type: 'close-tab', id: row.id });
  });
  el.append(close);
  el.addEventListener('click', () => {
    if (row.kind === 'folder') window.cove.dispatch({ type: 'toggle-folder', id: row.id });
    else window.cove.dispatch({ type: 'activate-tab', id: row.id });
  });
  el.addEventListener('dblclick', (event) => {
    event.stopPropagation();
    editing = row.id;
    renderList();
  });
  el.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    window.cove.dispatch({ type: 'menu-tab', id: row.id });
  });
  el.addEventListener('dragstart', (event) => {
    dragId = row.id;
    event.dataTransfer?.setData('text/plain', row.id);
  });
  el.addEventListener('dragover', (event) => {
    event.preventDefault();
    const rect = el.getBoundingClientRect();
    el.classList.toggle('drop-before', event.clientY < rect.top + rect.height / 2);
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-before'));
  el.addEventListener('drop', (event) => {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain') || dragId;
    if (!id || id === row.id) return;
    const rect = el.getBoundingClientRect();
    if (event.clientX > rect.left + rect.width * 0.72 && row.kind !== 'folder') {
      window.cove.dispatch({ type: 'split-drop', id, ontoId: row.id, orientation: 'horizontal' });
      return;
    }
    window.cove.dispatch({
      type: 'reorder',
      id,
      beforeId: event.clientY < rect.top + rect.height / 2 ? row.id : null,
      parentId: row.kind === 'folder' ? row.id : null,
      section,
    });
  });
  const wrap = document.createElement('div');
  wrap.append(el);
  for (const child of row.children) wrap.append(rowEl(child, true, section));
  return wrap;
}

function renderEditor(): void {
  if (!snap?.editSpaceId) {
    editor.hidden = true;
    return;
  }
  const space = snap.spaces.find((entry) => entry.id === snap?.editSpaceId);
  if (!space) {
    editor.hidden = true;
    return;
  }
  if (editor.dataset.id === space.id && !editor.hidden) return;
  editor.hidden = false;
  editor.dataset.id = space.id;
  editor.replaceChildren();
  const name = document.createElement('input');
  name.value = space.name;
  const emojis = document.createElement('div');
  emojis.className = 'emojis';
  let iconValue = space.icon;
  for (const emoji of EMOJIS) {
    const button = document.createElement('button');
    button.textContent = emoji;
    button.addEventListener('click', () => { iconValue = emoji; });
    emojis.append(button);
  }
  const swatches = document.createElement('div');
  swatches.className = 'swatches';
  let color = space.color;
  for (const hex of COLORS) {
    const button = document.createElement('button');
    button.style.background = hex;
    button.addEventListener('click', () => { color = hex; });
    swatches.append(button);
  }
  const actions = document.createElement('div');
  actions.className = 'editor-actions';
  const save = document.createElement('button');
  save.textContent = 'Save';
  save.addEventListener('click', () => {
    editor.hidden = true;
    window.cove.dispatch({ type: 'update-space', id: space.id, name: name.value.trim() || space.name, icon: iconValue, color });
  });
  const remove = document.createElement('button');
  remove.textContent = 'Delete';
  remove.addEventListener('click', () => window.cove.dispatch({ type: 'delete-space', id: space.id }));
  actions.append(save, remove);
  editor.append(name, emojis, swatches, actions);
}

function finish(id: string, value: string): void {
  if (editing !== id) return;
  editing = '';
  window.cove.dispatch({ type: 'rename-item', id, title: value.trim() || 'Tab' });
}

function icon(row: Row): HTMLElement {
  const el = document.createElement('span');
  el.className = 'mark';
  if (row.favicon) {
    const img = document.createElement('img');
    img.src = row.favicon;
    img.alt = '';
    el.append(img);
  } else {
    el.classList.add('glyph');
    el.textContent = (row.title || '•').slice(0, 1).toUpperCase();
  }
  return el;
}

function text(value: string): HTMLElement {
  const el = document.createElement('span');
  el.textContent = value;
  return el;
}

function textGlyph(value: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'folder-mark';
  el.textContent = value;
  return el;
}

function tool(glyph: string, title: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = glyph;
  button.title = title;
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}

function tick(): void {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 740;
  gain.gain.value = 0.015;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.03);
}

window.cove.onSnapshot(paint);
window.cove.snapshot().then(paint).catch(() => undefined);
