import type { Result } from '../shared/types';
import type { CoveBridge } from '../shared/bridge';

declare global {
  interface Window {
    cove: CoveBridge;
  }
}

const input = document.querySelector('#query') as HTMLInputElement;
const resultsEl = document.querySelector('#results') as HTMLElement;
let mode: 'new' | 'edit' = 'new';
let results: Result[] = [];
let selected = 0;
let request = 0;
let composing = false;

window.cove.onCommand((payload) => {
  mode = payload.mode;
  document.documentElement.dataset.appearance = payload.appearance || 'dark';
  input.value = payload.query || '';
  input.placeholder = mode === 'edit' ? 'Change this tab’s address' : 'Search or Enter URL…';
  input.focus();
  if (payload.select) input.select();
  void refresh();
});

input.addEventListener('compositionstart', () => { composing = true; });
input.addEventListener('compositionend', () => { composing = false; void refresh(); });
input.addEventListener('input', () => { if (!composing) void refresh(); });

input.addEventListener('keydown', (event) => {
  if (event.isComposing || composing) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (results.length) select((selected + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length, true);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    // A pending search must never open a suggestion from the previous query.
    const result = results[selected];
    if (result) choose(result, event);
    else if (input.value.trim()) window.cove.dispatch({ type: 'commit-omnibox', query: input.value, target: targetFor(event) });
  } else if (event.key === 'Escape') {
    ++request;
    window.cove.dispatch({ type: 'close-overlay' });
  }
});

async function refresh(): Promise<void> {
  const version = ++request;
  const query = input.value;
  results = [];
  input.removeAttribute('aria-activedescendant');
  resultsEl.setAttribute('aria-busy', 'true');
  try {
    const next = await window.cove.search(query, mode);
    if (version !== request) return;
    results = next;
    selected = 0;
    draw();
  } catch {
    if (version === request) {
      results = [];
      draw();
    }
  } finally {
    if (version === request) resultsEl.setAttribute('aria-busy', 'false');
  }
}

const paths: Record<Result['kind'], string> = {
  search: '<circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4"/>',
  url: '<circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3c4 4 4 10 0 14M10 3c-4 4-4 10 0 14"/>',
  tab: '<rect x="2" y="3" width="16" height="14" rx="3"/><path d="M2 7h16"/>',
  history: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/>',
  archive: '<rect x="3" y="6" width="14" height="11" rx="2"/><path d="M2 3h16v3H2zM8 10h4"/>',
  space: '<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/>',
  command: '<path d="m11 2-7 9h6l-1 7 7-10h-6z"/>',
  password: '<circle cx="7" cy="8" r="4"/><path d="m10 11 7 7m-3-3 2-2"/>',
};

function draw(): void {
  const fragment = document.createDocumentFragment();
  results.forEach((result, index) => {
    const row = document.createElement('div');
    row.id = `result-${index}`;
    row.className = `result${index === selected ? ' selected' : ''}`;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(index === selected));
    const icon = document.createElement('span');
    icon.className = 'result-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<svg viewBox="0 0 20 20">${paths[result.kind]}</svg>`;
    const copy = document.createElement('div');
    copy.className = 'result-copy';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = result.title;
    copy.append(title);
    if (result.subtitle && result.subtitle !== result.title) {
      const subtitle = document.createElement('div');
      subtitle.className = 'sub';
      subtitle.textContent = result.subtitle;
      copy.append(subtitle);
    }
    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = result.kind === 'tab' ? 'Switch to tab' : result.kind === 'search' ? 'Search' : result.kind === 'url' ? 'Open' : '';
    const enter = document.createElement('span');
    enter.className = 'enter';
    enter.textContent = '↵';
    enter.setAttribute('aria-hidden', 'true');
    row.append(icon, copy, hint, enter);
    row.addEventListener('mousemove', () => select(index));
    row.addEventListener('mousedown', (event) => {
      event.preventDefault();
      if (results[index] === result) choose(result, event);
    });
    fragment.append(row);
  });
  if (!results.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Type a URL, search, or command';
    fragment.append(empty);
  }
  resultsEl.replaceChildren(fragment);
  resultsEl.scrollTop = 0;
  if (results.length) input.setAttribute('aria-activedescendant', `result-${selected}`);
}

function select(index: number, scroll = false): void {
  if (!results[index]) return;
  const previous = resultsEl.querySelector('.selected');
  previous?.classList.remove('selected');
  previous?.setAttribute('aria-selected', 'false');
  selected = index;
  const row = resultsEl.children[index] as HTMLElement;
  row.classList.add('selected');
  row.setAttribute('aria-selected', 'true');
  input.setAttribute('aria-activedescendant', row.id);
  if (scroll) row.scrollIntoView({ block: 'nearest' });
}

function choose(result: Result, event: { metaKey: boolean; altKey: boolean }): void {
  const action = { ...result.action };
  if (action.type === 'commit-omnibox') action.target = targetFor(event);
  else if (event.altKey && action.type === 'activate-tab') {
    window.cove.dispatch({ type: 'activate-tab', id: action.id });
    return;
  }
  if (mode === 'edit' && action.type === 'commit-omnibox' && !event.metaKey && !event.altKey) action.target = 'current';
  ++request;
  window.cove.dispatch(action);
}

function targetFor(event: { metaKey: boolean; altKey: boolean }): 'current' | 'new' | 'little' {
  if (event.altKey) return 'little';
  if (event.metaKey) return 'new';
  return mode === 'edit' ? 'current' : 'new';
}

input.focus();
