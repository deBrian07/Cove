import type { Action } from '../shared/types';

declare global {
  interface Window {
    cove: {
      dispatch(action: Action): Promise<unknown>;
      onOverlay(cb: (payload: Record<string, unknown>) => void): () => void;
    };
  }
}

const root = document.querySelector('#root') as HTMLElement;

window.cove.onOverlay((payload) => {
  const mode = String(payload.mode || location.hash.replace('#', ''));
  if (mode === 'find') find(payload);
  else if (mode === 'switcher') switcher(payload);
  else if (mode === 'site') site(payload);
  else if (mode === 'password') password(payload);
  else if (mode === 'auth') auth(payload);
  else if (mode === 'preview') preview(payload);
});

function panel(...nodes: Node[]): HTMLElement {
  const el = document.createElement('div');
  el.className = 'panel';
  el.append(...nodes);
  root.replaceChildren(el);
  return el;
}

function find(payload: Record<string, unknown>): void {
  const input = document.createElement('input');
  input.placeholder = 'Find';
  input.value = String(payload.query || '');
  const count = document.createElement('div');
  count.className = 'muted';
  count.textContent = payload.total ? `${payload.active || 0} of ${payload.total}` : '';
  input.addEventListener('input', () => window.cove.dispatch({ type: 'find', text: input.value, forward: true }));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') window.cove.dispatch({ type: 'find', text: input.value, forward: !event.shiftKey });
    if (event.key === 'Escape') window.cove.dispatch({ type: 'find-close' });
  });
  panel(input, count);
  input.focus();
}

function switcher(payload: Record<string, unknown>): void {
  const rows = (payload.rows as { id: string; title: string; url: string }[]) || [];
  const index = Number(payload.index || 0);
  const list = document.createElement('div');
  list.className = 'list';
  rows.forEach((row, i) => {
    const item = document.createElement('div');
    item.className = `item${i === index ? ' on' : ''}`;
    item.textContent = row.title;
    const sub = document.createElement('div');
    sub.className = 'muted';
    sub.textContent = row.url;
    item.append(sub);
    list.append(item);
  });
  panel(list);
}

function site(payload: Record<string, unknown>): void {
  const host = document.createElement('strong');
  host.textContent = String(payload.host || 'This site');
  const url = document.createElement('div');
  url.className = 'muted';
  url.textContent = String(payload.url || '');
  const zoom = document.createElement('div');
  zoom.textContent = `Zoom ${Math.round(Number(payload.zoom || 1) * 100)}%`;
  const row = document.createElement('div');
  row.className = 'row';
  row.append(
    action('−', () => window.cove.dispatch({ type: 'zoom', dir: 'out' })),
    action('+', () => window.cove.dispatch({ type: 'zoom', dir: 'in' })),
    action(payload.muted ? 'Unmute' : 'Mute', () => window.cove.dispatch({ type: 'mute' })),
    action('Boost', () => window.cove.dispatch({ type: 'open-page', page: `boost/new?host=${encodeURIComponent(String(payload.host || ''))}` })),
    action('Clear data', () => window.cove.dispatch({ type: 'clear-site-data', origin: String(payload.origin || '') })),
  );
  panel(host, url, zoom, row);
}

function password(payload: Record<string, unknown>): void {
  const text = document.createElement('div');
  text.textContent = `Save a password for ${payload.origin || 'this site'}?`;
  const who = document.createElement('div');
  who.className = 'muted';
  who.textContent = String(payload.username || '');
  const row = document.createElement('div');
  row.className = 'row';
  const id = String(payload.id || '');
  row.append(
    action('Save', () => window.cove.dispatch({ type: 'save-pending-password', id })),
    action('Not now', () => window.cove.dispatch({ type: 'dismiss-password', id })),
    action('Never', () => window.cove.dispatch({ type: 'dismiss-password', id, never: true })),
  );
  panel(text, who, row);
}

function auth(payload: Record<string, unknown>): void {
  const title = document.createElement('div');
  title.textContent = `Sign in to ${payload.host || 'this site'}`;
  const username = document.createElement('input');
  username.placeholder = 'Username';
  const password = document.createElement('input');
  password.placeholder = 'Password';
  password.type = 'password';
  const row = document.createElement('div');
  row.className = 'row';
  row.append(
    action('Sign in', () => window.cove.dispatch({ type: 'auth-reply', username: username.value, password: password.value })),
    action('Cancel', () => window.cove.dispatch({ type: 'auth-reply', username: '', password: '', cancel: true })),
  );
  panel(title, username, password, row);
  username.focus();
}

function preview(payload: Record<string, unknown>): void {
  const title = document.createElement('strong');
  title.textContent = String(payload.title || '');
  const url = document.createElement('div');
  url.className = 'muted';
  url.textContent = String(payload.url || '');
  const nodes: Node[] = [title, url];
  if (payload.image) {
    const img = document.createElement('img');
    img.className = 'preview';
    img.alt = '';
    img.src = String(payload.image);
    nodes.push(img);
  }
  panel(...nodes);
}

function action(text: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}
