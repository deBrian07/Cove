import type { Row, Snapshot } from '../shared/types';
import type { CoveBridge } from '../shared/bridge';
import { chromeIcon } from './icons';

declare global {
  interface Window {
    cove: CoveBridge;
  }
}

const COLORS = ['#C5CBB0', '#E7C7A1', '#E7B7C3', '#C9C4E8', '#B7D0E8', '#E7C2B0', '#B7D6D1', '#D7C0E0'];
const EMOJIS = ['🏡', '✦', '💼', '📚', '🌿', '🌙', '⚡', '🎯', '🧪', '🎨', '🗂️', '☕️'];

const essentials = document.querySelector('#essentials') as HTMLElement;
const heading = document.querySelector('#heading') as HTMLElement;
const list = document.querySelector('#list') as HTMLElement;
const foot = document.querySelector('#foot') as HTMLElement;
const topbar = document.querySelector('#topbar') as HTMLElement;
const search = document.querySelector('#search') as HTMLButtonElement;
const mini = document.querySelector('#mini') as HTMLElement;
const editor = document.querySelector('#editor') as HTMLElement;
const resize = document.querySelector('#resize') as HTMLElement;

let snap: Snapshot | null = null;
let editing = '';
let seenRename = '';
let lastSound = -1;
let dragId = '';
const painted = new Map<string, string>();

search.addEventListener('click', () => window.cove.dispatch({ type: 'open-command', mode: snap?.url && !snap.url.startsWith('cove:') ? 'edit' : 'new' }));
let peekTimer = 0;
document.addEventListener('mousemove', (event) => {
  window.clearTimeout(peekTimer);
  if (!snap || snap.mode !== 'main' || snap.sidebarVisible) return;
  if (!snap.sidebarPeek && event.clientX <= 7) {
    peekTimer = window.setTimeout(() => window.cove.dispatch({ type: 'sidebar-peek', on: true }), 120);
  }
});
document.documentElement.addEventListener('mouseleave', () => {
  if (!snap || snap.mode !== 'main' || snap.sidebarVisible) return;
  window.clearTimeout(peekTimer);
  peekTimer = window.setTimeout(() => window.cove.dispatch({ type: 'sidebar-peek', on: false }), 220);
});
essentials.addEventListener('dragover', (event) => { event.preventDefault(); essentials.classList.add('drop-zone'); });
essentials.addEventListener('dragleave', () => essentials.classList.remove('drop-zone'));
essentials.addEventListener('drop', (event) => {
  event.preventDefault();
  essentials.classList.remove('drop-zone');
  const id = event.dataTransfer?.getData('text/plain') || dragId;
  if (id) window.cove.dispatch({ type: 'favorite', id });
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !editor.hidden) window.cove.dispatch({ type: 'close-overlay' });
});
resize.addEventListener('pointerdown', (event) => {
  if (!snap) return;
  event.preventDefault();
  resize.setPointerCapture(event.pointerId);
  const startX = event.screenX;
  const startW = snap.sidebarWidth;
  let frame = 0;
  let width = startW;
  const send = () => { frame = 0; window.cove.dispatch({ type: 'set-sidebar-width', width }); };
  const move = (ev: PointerEvent) => {
    width = startW + ev.screenX - startX;
    if (!frame) frame = requestAnimationFrame(send);
  };
  const end = () => {
    cancelAnimationFrame(frame);
    send();
    resize.removeEventListener('pointermove', move);
    resize.removeEventListener('lostpointercapture', end);
    document.body.classList.remove('resizing');
  };
  document.body.classList.add('resizing');
  resize.addEventListener('pointermove', move);
  resize.addEventListener('lostpointercapture', end);
  resize.addEventListener('pointerup', () => resize.releasePointerCapture(event.pointerId), { once: true });
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
  root.style.setProperty('--side', `${Math.max(260, next.sidebarWidth)}px`);
  document.body.classList.toggle('collapsed', next.mode === 'main' && !open);
  document.body.classList.toggle('peeking', next.sidebarPeek && !next.sidebarVisible);
  document.body.classList.toggle('mini-mode', next.mode !== 'main');
  document.body.dataset.appearance = next.theme.appearance;
  // Update only the region that changed. Loading and address updates must not
  // replace tab rows under the pointer or interrupt an in-progress rename.
  const region = (key: string, value: unknown, render: () => void) => {
    const signature = JSON.stringify(value);
    if (painted.get(key) === signature) return;
    painted.set(key, signature);
    render();
  };
  region('address', [next.url, next.secure], renderAddress);
  if (!dragId) region('favorites', next.favorites, renderEssentials);
  region('heading', next.spaces, renderHeading);
  if (!editing && !dragId) region('list', [next.pinned, next.today], renderList);
  region('foot', [next.spaces, open], renderFoot);
  region('topbar', [next.mode, next.canBack, next.canForward, next.loading], renderTopbar);
  region('mini', [next.mode, next.url], renderMini);
  region('editor', [next.editSpaceId, next.spaces], renderEditor);
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

function renderAddress(): void {
  if (!snap) return;
  const internal = !snap.url || snap.url.startsWith('cove:');
  const label = document.createElement('span');
  label.className = 'address-label';
  label.textContent = internal ? 'Search or Enter URL…' : snap.host.replace(/^www\./, '');
  const shortcut = document.createElement('kbd');
  shortcut.textContent = internal ? '⌘T' : '⌘L';
  search.replaceChildren(chromeIcon(internal ? 'search' : snap.secure ? 'lock' : 'globe'), label, shortcut);
  search.title = internal ? 'New tab (⌘T)' : `${snap.url} (⌘L)`;
}

function renderEssentials(): void {
  if (!snap) return;
  essentials.replaceChildren();
  essentials.hidden = snap.favorites.length === 0;
  for (const row of snap.favorites) {
    const button = document.createElement('button');
    button.className = `essential${row.active ? ' active' : ''}`;
    button.title = row.title;
    button.setAttribute('aria-label', row.title);
    button.setAttribute('aria-pressed', String(row.active));
    button.append(icon(row));
    button.draggable = true;
    button.addEventListener('dragstart', (event) => {
      dragId = row.id;
      document.body.classList.add('dragging-tab');
      event.dataTransfer?.setData('text/plain', row.id);
    });
    button.addEventListener('dragend', () => {
      dragId = '';
      document.body.classList.remove('dragging-tab');
      if (snap) paint(snap);
      document.querySelectorAll('.drop-zone, .drop-before').forEach((node) => node.classList.remove('drop-zone', 'drop-before'));
    });
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
  heading.append(name);
}

function renderList(): void {
  if (!snap) return;
  const focusedId = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.row')?.dataset.id;
  list.replaceChildren();
  const pinned = document.createElement('div');
  pinned.className = 'pinned-tabs';
  pinned.setAttribute('aria-label', 'Pinned tabs');
  for (const row of snap.pinned) pinned.append(rowEl(row, false, 'pinned'));
  setupDrop(pinned, 'pinned');
  list.append(pinned);
  const divider = document.createElement('div');
  divider.className = 'tab-divider';
  const clear = document.createElement('button');
  clear.className = 'clear';
  clear.textContent = 'Clear';
  clear.title = 'Archive all unpinned tabs';
  clear.hidden = snap.today.length === 0;
  clear.addEventListener('click', () => window.cove.dispatch({ type: 'clear-today' }));
  divider.append(clear);
  list.append(divider);
  const today = document.createElement('div');
  today.className = 'today-tabs';
  today.setAttribute('aria-label', 'Today’s tabs');
  const fresh = document.createElement('button');
  fresh.className = 'line new-tab';
  fresh.append(chromeIcon('plus'), text('New Tab'));
  const shortcut = document.createElement('kbd');
  shortcut.textContent = '⌘T';
  fresh.append(shortcut);
  fresh.addEventListener('click', () => window.cove.dispatch({ type: 'open-command', mode: 'new' }));
  today.append(fresh);
  for (const row of snap.today) today.append(rowEl(row, false, 'today'));
  setupDrop(today, 'today');
  list.append(today);
  if (focusedId) list.querySelector<HTMLElement>(`[data-id="${CSS.escape(focusedId)}"]`)?.focus({ preventScroll: true });
}

function setupDrop(element: HTMLElement, section: 'pinned' | 'today'): void {
  element.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.target === element) element.classList.add('drop-zone');
  });
  element.addEventListener('dragleave', () => element.classList.remove('drop-zone'));
  element.addEventListener('drop', (event) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    element.classList.remove('drop-zone');
    const id = event.dataTransfer?.getData('text/plain') || dragId;
    if (id) window.cove.dispatch({ type: 'reorder', id, beforeId: null, parentId: null, section });
  });
}

function renderFoot(): void {
  if (!snap) return;
  foot.replaceChildren();
  if (!document.body.classList.contains('collapsed')) {
    const archived = document.createElement('button');
    archived.className = 'archived';
    archived.append(chromeIcon('library'));
    archived.title = 'Archived';
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
    chip.setAttribute('aria-label', space.name);
    chip.setAttribute('aria-pressed', String(space.active));
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

function renderTopbar(): void {
  if (!snap || snap.mode !== 'main') {
    topbar.replaceChildren();
    return;
  }
  topbar.replaceChildren();
  topbar.append(
    tool('sidebar', 'Toggle sidebar (⌘S)', () => window.cove.dispatch({ type: 'toggle-sidebar' })),
    tool('back', 'Back', () => window.cove.dispatch({ type: 'back' }), !snap.canBack),
    tool('forward', 'Forward', () => window.cove.dispatch({ type: 'forward' }), !snap.canForward),
    tool(snap.loading ? 'stop' : 'reload', snap.loading ? 'Stop loading' : 'Reload', () => window.cove.dispatch({ type: snap?.loading ? 'stop' : 'reload' })),
  );
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

function rowEl(row: Row, child: boolean, section: 'pinned' | 'today', parentId: string | null = null): HTMLElement {
  const el = document.createElement('div');
  el.className = `row${row.active ? ' active' : ''}${row.unread ? ' unread' : ''}${child ? ' child' : ''}`;
  el.draggable = true;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', row.title);
  el.setAttribute('aria-current', String(row.active));
  el.title = row.url || row.title;
  el.dataset.id = row.id;
  if (row.kind === 'folder') {
    const mark = chromeIcon('chevron');
    mark.classList.add('folder-chevron');
    mark.classList.toggle('expanded', !row.collapsed);
    el.append(mark);
    el.setAttribute('aria-expanded', String(!row.collapsed));
  }
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
  close.append(chromeIcon('close'));
  close.title = row.kind === 'folder' ? 'Archive folder' : 'Close tab';
  close.setAttribute('aria-label', `${close.title}: ${row.title}`);
  close.addEventListener('click', (event) => {
    event.stopPropagation();
    window.cove.dispatch({ type: 'close-tab', id: row.id });
  });
  if (row.audible || row.muted) {
    const audio = document.createElement('button');
    audio.className = 'audio';
    audio.append(chromeIcon('audio'));
    audio.title = row.muted ? 'Unmute tab' : 'Mute tab';
    audio.addEventListener('click', (event) => { event.stopPropagation(); window.cove.dispatch({ type: 'mute', id: row.id }); });
    el.append(audio);
  }
  el.append(close);
  el.addEventListener('keydown', (event) => {
    if (event.target !== el) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); el.click(); }
    if (event.key === 'F2') { event.preventDefault(); editing = row.id; renderList(); }
  });
  el.addEventListener('auxclick', (event) => {
    if (event.button === 1 && row.kind !== 'folder') { event.preventDefault(); window.cove.dispatch({ type: 'close-tab', id: row.id }); }
  });
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
    el.classList.add('dragging');
    document.body.classList.add('dragging-tab');
    dragId = row.id;
    event.dataTransfer?.setData('text/plain', row.id);
  });
  el.addEventListener('dragend', () => {
    document.body.classList.remove('dragging-tab');
    dragId = '';
    document.querySelectorAll('.drop-before, .drop-zone, .dragging').forEach((node) => node.classList.remove('drop-before', 'drop-zone', 'dragging'));
    if (snap) paint(snap);
  });
  el.addEventListener('dragover', (event) => {
    event.preventDefault();
    const rect = el.getBoundingClientRect();
    el.classList.toggle('drop-before', event.clientY < rect.top + rect.height / 2);
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-before'));
  el.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    el.classList.remove('drop-before');
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
      beforeId: row.kind === 'folder' && event.clientX > rect.left + 32 ? null : event.clientY < rect.top + rect.height / 2 ? row.id : (wrap.nextElementSibling?.querySelector<HTMLElement>('.row')?.dataset.id || null),
      parentId: row.kind === 'folder' && event.clientX > rect.left + 32 ? row.id : parentId,
      section,
    });
  });
  const wrap = document.createElement('div');
  wrap.append(el);
  for (const child of row.children) wrap.append(rowEl(child, true, section, row.id));
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
    button.setAttribute('aria-label', emoji);
    button.setAttribute('aria-pressed', String(iconValue === emoji));
    button.addEventListener('click', () => { iconValue = emoji; emojis.querySelectorAll('button').forEach((entry) => entry.setAttribute('aria-pressed', String(entry === button))); });
    emojis.append(button);
  }
  const swatches = document.createElement('div');
  swatches.className = 'swatches';
  let color = space.color;
  for (const hex of COLORS) {
    const button = document.createElement('button');
    button.style.background = hex;
    button.setAttribute('aria-label', `Theme ${hex}`);
    button.setAttribute('aria-pressed', String(color.toLowerCase() === hex.toLowerCase()));
    button.addEventListener('click', () => { color = hex; swatches.querySelectorAll('button').forEach((entry) => entry.setAttribute('aria-pressed', String(entry === button))); });
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
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => window.cove.dispatch({ type: 'close-overlay' }));
  actions.append(save, cancel, remove);
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
  if (row.loading) {
    el.classList.add('loading');
  } else if (row.favicon) {
    const img = document.createElement('img');
    img.src = row.favicon;
    img.alt = '';
    img.addEventListener('error', () => el.replaceChildren(chromeIcon('globe')), { once: true });
    el.append(img);
  } else {
    el.append(chromeIcon(row.kind === 'folder' ? 'folder' : 'globe'));
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
  button.append(chromeIcon(glyph));
  button.title = title;
  button.setAttribute('aria-label', title);
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
  osc.onended = () => { void ctx.close(); };
}

window.cove.onSnapshot(paint);
window.cove.snapshot().then(paint).catch(() => undefined);
