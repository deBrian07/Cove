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

const COLORS = ['#3EBE8A', '#E09A3E', '#D85A78', '#7B6CF0', '#3D8BFF', '#E36B4A', '#2AA8A0', '#C45AD6'];
const EMOJIS = ['🏡', '✦', '💼', '📚', '🌿', '🌙', '⚡', '🎯', '🧪', '🎨', '🗂️', '☕️', '🧭', '💻', '🎵', '🌐'];

const rail = document.querySelector('#rail') as HTMLElement;
const side = document.querySelector('#side') as HTMLElement;
const nav = document.querySelector('#nav') as HTMLElement;
const favs = document.querySelector('#favs') as HTMLElement;
const list = document.querySelector('#list') as HTMLElement;
const shelf = document.querySelector('#shelf') as HTMLElement;
const plus = document.querySelector('#plus') as HTMLButtonElement;
const resize = document.querySelector('#resize') as HTMLElement;
const edge = document.querySelector('#edge') as HTMLElement;
const mini = document.querySelector('#mini') as HTMLElement;
const editor = document.querySelector('#editor') as HTMLElement;
const chrome = document.querySelector('#chrome') as HTMLElement;

let snap: Snapshot | null = null;
let editing = '';
let seenRename = '';
let lastSound = -1;
let dragId = '';

plus.addEventListener('click', () => window.cove.dispatch({ type: 'open-command', mode: 'new' }));
edge.addEventListener('mouseenter', () => window.cove.dispatch({ type: 'sidebar-peek', on: true }));
chrome.addEventListener('mouseleave', () => {
  if (snap && !snap.sidebarVisible) window.cove.dispatch({ type: 'sidebar-peek', on: false });
});
resize.addEventListener('mousedown', (event) => {
  if (!snap) return;
  const startX = event.screenX;
  const startW = snap.sidebarWidth;
  const move = (ev: MouseEvent) => window.cove.dispatch({ type: 'set-sidebar-width', width: startW + ev.screenX - startX });
  const up = () => window.removeEventListener('mousemove', move);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up, { once: true });
});

let painted = '';

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
  root.style.setProperty('--side', `${next.sidebarWidth}px`);
  document.body.classList.toggle('side-hidden', next.mode === 'main' && !next.sidebarVisible && !next.sidebarPeek);
  document.body.classList.toggle('mini-mode', next.mode !== 'main');
  document.body.dataset.appearance = next.theme.appearance;
  const signature = JSON.stringify({
    mode: next.mode,
    spaces: next.spaces,
    favorites: next.favorites,
    pinned: next.pinned,
    today: next.today,
    downloads: next.downloads,
    media: next.media,
    host: next.host,
    url: next.url,
    secure: next.secure,
    canBack: next.canBack,
    canForward: next.canForward,
    loading: next.loading,
    edit: next.editSpaceId,
    rename: next.renameId,
    incognito: next.incognito,
  });
  if (signature !== painted) {
    painted = signature;
    renderRail();
    renderNav();
    renderFavs();
    renderList();
    renderShelf();
    renderMini();
    renderEditor();
  }
  list.scrollTop = scroll;
  if (next.renameId && next.renameId !== seenRename) {
    seenRename = next.renameId;
    startRename(next.renameId);
  }
  if (!next.renameId) seenRename = '';
  if (lastSound >= 0 && next.sound > lastSound) tick();
  lastSound = next.sound;
}

function renderRail(): void {
  if (!snap) return;
  rail.replaceChildren();
  for (const space of snap.spaces) {
    const button = document.createElement('button');
    button.className = `space${space.active ? ' active' : ''}`;
    button.style.setProperty('--swatch', space.color);
    button.textContent = space.icon || '✦';
    button.title = space.name;
    button.addEventListener('click', () => window.cove.dispatch({ type: 'activate-space', id: space.id }));
    button.addEventListener('dblclick', () => window.cove.dispatch({ type: 'menu-space', id: space.id }));
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      window.cove.dispatch({ type: 'menu-space', id: space.id });
    });
    button.addEventListener('dragover', (event) => event.preventDefault());
    button.addEventListener('drop', (event) => {
      event.preventDefault();
      const id = event.dataTransfer?.getData('text/plain') || dragId;
      if (id) window.cove.dispatch({ type: 'move-tab', id, spaceId: space.id });
    });
    rail.append(button);
  }
  const add = document.createElement('button');
  add.className = 'space-add';
  add.textContent = '+';
  add.title = 'New space';
  add.addEventListener('click', () => window.cove.dispatch({ type: 'new-space' }));
  const card = document.createElement('button');
  card.className = 'gear';
  card.textContent = '▣';
  card.title = 'Membership card';
  card.addEventListener('click', () => window.cove.dispatch({ type: 'open-page', page: 'membership' }));
  const gear = document.createElement('button');
  gear.className = 'gear';
  gear.textContent = '⚙';
  gear.title = 'Settings';
  gear.addEventListener('click', () => window.cove.dispatch({ type: 'open-page', page: 'settings' }));
  rail.append(add, card, gear);
}

function renderNav(): void {
  if (!snap) return;
  nav.replaceChildren();
  nav.append(
    iconButton('←', 'Back', () => window.cove.dispatch({ type: 'back' }), !snap.canBack),
    iconButton('→', 'Forward', () => window.cove.dispatch({ type: 'forward' }), !snap.canForward),
    iconButton('↻', 'Reload', () => window.cove.dispatch({ type: 'reload' })),
  );
  const host = document.createElement('button');
  host.className = `host${snap.secure ? ' secure' : ''}`;
  host.textContent = snap.host || (snap.secure === null ? 'Cove' : snap.url || 'New tab');
  host.title = snap.url;
  host.addEventListener('click', () => window.cove.dispatch({ type: 'open-site-panel' }));
  const split = iconButton('▥', 'Split view', () => window.cove.dispatch({ type: 'add-split' }));
  nav.append(host, split);
  if (snap.loading) {
    const bar = document.createElement('div');
    bar.className = 'loading';
    nav.append(bar);
  }
}

function renderFavs(): void {
  if (!snap) return;
  favs.replaceChildren();
  for (const row of snap.favorites) favs.append(favButton(row));
}

function favButton(row: Row): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = `fav${row.active ? ' active' : ''}`;
  button.title = row.title;
  button.append(mark(row, true));
  button.addEventListener('click', () => window.cove.dispatch({ type: 'activate-tab', id: row.id }));
  button.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    window.cove.dispatch({ type: 'menu-tab', id: row.id });
  });
  return button;
}

function renderList(): void {
  if (!snap) return;
  list.replaceChildren();
  if (!snap.pinnedCollapsed) {
    for (const row of snap.pinned) list.append(rowEl(row, false, 'pinned'));
  }
  const header = document.createElement('div');
  header.className = 'section';
  const label = document.createElement('span');
  label.textContent = snap.todayLabel;
  const clear = document.createElement('button');
  clear.textContent = '×';
  clear.title = 'Clear unpinned tabs';
  clear.addEventListener('click', () => window.cove.dispatch({ type: 'clear-today' }));
  header.append(label, clear);
  list.append(header);
  if (!snap.today.length) {
    const empty = document.createElement('div');
    empty.className = 'section';
    empty.textContent = 'Nothing open';
    list.append(empty);
  }
  for (const row of snap.today) list.append(rowEl(row, false, 'today'));
}

function rowEl(row: Row, child: boolean, section: 'pinned' | 'today'): HTMLElement {
  const el = document.createElement('div');
  el.className = `row${row.active ? ' active' : ''}${row.unread ? ' unread' : ''}${child ? ' child' : ''}`;
  el.draggable = true;
  el.append(mark(row, false));
  if (editing === row.id) {
    const input = document.createElement('input');
    input.className = 'rename';
    input.value = row.title;
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        window.cove.dispatch({ type: 'rename-item', id: row.id, title: input.value.trim() || row.title });
        editing = '';
      }
      if (event.key === 'Escape') editing = '';
    });
    input.addEventListener('blur', () => {
      if (editing === row.id) {
        window.cove.dispatch({ type: 'rename-item', id: row.id, title: input.value.trim() || row.title });
        editing = '';
      }
    });
    el.append(input);
    setTimeout(() => input.focus(), 0);
  } else {
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = row.kind === 'split' ? `${row.title}` : row.title;
    if (row.paneCount > 1) title.textContent = `${row.title}  ·  ${row.paneCount}`;
    el.append(title);
  }
  if (row.audible || row.muted) {
    const audio = document.createElement('button');
    audio.className = `audio${row.audible ? ' on' : ''}`;
    audio.textContent = row.muted ? '🔇' : '🔊';
    audio.addEventListener('click', (event) => {
      event.stopPropagation();
      window.cove.dispatch({ type: 'mute', id: row.id });
    });
    el.append(audio);
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
    startRename(row.id);
  });
  el.addEventListener('auxclick', (event) => {
    if (event.button === 1) window.cove.dispatch({ type: 'close-tab', id: row.id });
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
    const split = event.clientX > rect.left + rect.width * 0.72;
    el.classList.toggle('drop-split', split);
    el.classList.toggle('drop-before', !split && event.clientY < rect.top + rect.height / 2);
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-split', 'drop-before'));
  el.addEventListener('drop', (event) => {
    event.preventDefault();
    el.classList.remove('drop-split', 'drop-before');
    const id = event.dataTransfer?.getData('text/plain') || dragId;
    if (!id || id === row.id || !snap) return;
    const rect = el.getBoundingClientRect();
    if (event.clientX > rect.left + rect.width * 0.72 && row.kind !== 'folder') {
      window.cove.dispatch({ type: 'split-drop', id, ontoId: row.id, orientation: 'horizontal' });
      return;
    }
    const before = event.clientY < rect.top + rect.height / 2;
    window.cove.dispatch({
      type: 'reorder',
      id,
      beforeId: before ? row.id : null,
      parentId: row.kind === 'folder' ? row.id : null,
      section,
    });
  });
  if (row.kind === 'folder') {
    const caret = document.createElement('span');
    caret.textContent = row.collapsed ? '▸' : '▾';
    el.prepend(caret);
  }
  const wrap = document.createElement('div');
  wrap.append(el);
  for (const child of row.children) wrap.append(rowEl(child, true, section));
  return wrap;
}

function renderShelf(): void {
  if (!snap) return;
  shelf.replaceChildren();
  if (snap.media) {
    const chip = document.createElement('div');
    chip.className = 'chip';
    const label = document.createElement('span');
    label.textContent = snap.media.title;
    const pause = document.createElement('button');
    pause.textContent = '⏯';
    pause.addEventListener('click', () => window.cove.dispatch({ type: 'media', op: 'toggle' }));
    const pip = document.createElement('button');
    pip.textContent = '⧉';
    pip.addEventListener('click', () => window.cove.dispatch({ type: 'media', op: 'pip' }));
    chip.append(label, pause, pip);
    shelf.append(chip);
  }
  for (const download of snap.downloads) {
    const chip = document.createElement('div');
    chip.className = 'chip';
    const label = document.createElement('span');
    label.textContent = download.state === 'progressing' ? `${download.filename}` : download.filename;
    const open = document.createElement('button');
    open.textContent = download.state === 'progressing' ? '×' : '↗';
    open.addEventListener('click', () => {
      window.cove.dispatch({
        type: 'download-action',
        id: download.id,
        op: download.state === 'progressing' ? 'cancel' : 'open',
      });
    });
    chip.append(label, open);
    shelf.append(chip);
  }
}

function renderMini(): void {
  if (!snap) return;
  mini.hidden = snap.mode === 'main';
  if (snap.mode === 'main') return;
  mini.replaceChildren();
  mini.append(
    iconButton('←', 'Back', () => window.cove.dispatch({ type: 'back' }), !snap.canBack),
    iconButton('→', 'Forward', () => window.cove.dispatch({ type: 'forward' }), !snap.canForward),
  );
  const input = document.createElement('input');
  input.value = snap.url;
  input.placeholder = snap.mode === 'peek' ? 'Peek' : 'Little Cove';
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') window.cove.dispatch({ type: 'commit-omnibox', query: input.value, target: 'current' });
  });
  const open = document.createElement('button');
  open.className = 'open';
  open.textContent = 'Open in Cove';
  open.addEventListener('click', () => window.cove.dispatch({ type: 'open-in-cove' }));
  mini.append(input, open);
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
  const title = document.createElement('h3');
  title.textContent = 'Space';
  const name = document.createElement('input');
  name.value = space.name;
  const emojis = document.createElement('div');
  emojis.className = 'emojis';
  let icon = space.icon;
  for (const emoji of EMOJIS) {
    const button = document.createElement('button');
    button.textContent = emoji;
    button.addEventListener('click', () => {
      icon = emoji;
    });
    emojis.append(button);
  }
  const swatches = document.createElement('div');
  swatches.className = 'swatches';
  let color = space.color;
  for (const hex of COLORS) {
    const button = document.createElement('button');
    button.style.background = hex;
    button.addEventListener('click', () => {
      color = hex;
    });
    swatches.append(button);
  }
  const appearance = document.createElement('select');
  for (const value of ['auto', 'light', 'dark'] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value === 'auto' ? 'Match system' : value === 'light' ? 'Light sidebar' : 'Dark sidebar';
    appearance.append(option);
  }
  const profile = document.createElement('select');
  for (const entry of snap.profiles) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.name;
    if (entry.name === snap.profileName) option.selected = true;
    profile.append(option);
  }
  const actions = document.createElement('div');
  actions.className = 'row-actions';
  const save = document.createElement('button');
  save.textContent = 'Save';
  save.addEventListener('click', () => {
    editor.hidden = true;
    window.cove.dispatch({
      type: 'update-space',
      id: space.id,
      name: name.value.trim() || space.name,
      icon,
      color,
      appearance: appearance.value as 'auto' | 'light' | 'dark',
      profileId: profile.value,
    });
  });
  const duplicate = document.createElement('button');
  duplicate.textContent = 'Duplicate';
  duplicate.addEventListener('click', () => window.cove.dispatch({ type: 'duplicate-space', id: space.id }));
  const remove = document.createElement('button');
  remove.textContent = 'Delete';
  remove.addEventListener('click', () => window.cove.dispatch({ type: 'delete-space', id: space.id }));
  actions.append(save, duplicate, remove);
  editor.append(title, name, emojis, swatches, appearance, profile, actions);
}

function startRename(id: string): void {
  editing = id;
  if (snap) renderList();
}

function mark(row: Row, large: boolean): HTMLElement {
  const el = document.createElement(large ? 'span' : 'span');
  el.className = 'mark';
  if (row.favicon) {
    const img = document.createElement('img');
    img.src = row.favicon;
    img.alt = '';
    el.append(img);
    el.style.background = 'transparent';
  } else {
    el.textContent = (row.title || '•').slice(0, 1).toUpperCase();
  }
  return el;
}

function iconButton(glyph: string, title: string, onClick: () => void, disabled = false): HTMLButtonElement {
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
  gain.gain.value = 0.02;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.03);
  osc.onended = () => ctx.close();
}

window.cove.onSnapshot(paint);
window.cove.snapshot().then(paint).catch(() => undefined);
