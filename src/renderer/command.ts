import type { Action, Result } from '../shared/types';

declare global {
  interface Window {
    cove: {
      search(query: string, mode: 'new' | 'edit'): Promise<Result[]>;
      dispatch(action: Action): Promise<unknown>;
      onCommand(cb: (payload: { query: string; mode: 'new' | 'edit'; select: boolean }) => void): () => void;
    };
  }
}

const input = document.querySelector('#query') as HTMLInputElement;
const resultsEl = document.querySelector('#results') as HTMLElement;
let mode: 'new' | 'edit' = 'new';
let results: Result[] = [];
let selected = 0;
let timer = 0;

window.cove.onCommand((payload) => {
  mode = payload.mode;
  input.value = payload.query || '';
  input.placeholder = mode === 'edit' ? 'Change this tab’s address' : 'Search tabs, spaces, and actions';
  input.focus();
  if (payload.select) input.select();
  void refresh();
});

input.addEventListener('input', () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void refresh(), 40);
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    selected = Math.min(results.length - 1, selected + 1);
    draw();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    selected = Math.max(0, selected - 1);
    draw();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const result = results[selected];
    if (result) choose(result, event);
    else window.cove.dispatch({ type: 'commit-omnibox', query: input.value, target: targetFor(event) });
  } else if (event.key === 'Escape') {
    window.cove.dispatch({ type: 'close-overlay' });
  }
});

async function refresh(): Promise<void> {
  results = await window.cove.search(input.value, mode);
  selected = 0;
  draw();
}

function draw(): void {
  resultsEl.replaceChildren();
  results.forEach((result, index) => {
    const row = document.createElement('div');
    row.className = `result${index === selected ? ' selected' : ''}`;
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = result.title;
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = result.kind === 'tab' ? 'Switch to Tab' : result.kind === 'search' ? 'Search' : result.kind === 'url' ? 'Open' : '';
    row.append(title, hint);
    row.addEventListener('mouseenter', () => {
      if (selected === index) return;
      selected = index;
      draw();
    });
    row.addEventListener('mousedown', (event) => {
      event.preventDefault();
      choose(result, event);
    });
    resultsEl.append(row);
  });
}

function choose(result: Result, event: { metaKey: boolean; altKey: boolean }): void {
  const action = { ...result.action };
  if (action.type === 'commit-omnibox') action.target = targetFor(event);
  else if (event.altKey && action.type === 'activate-tab') {
    window.cove.dispatch({ type: 'activate-tab', id: action.id });
    return;
  }
  if (mode === 'edit' && action.type === 'commit-omnibox' && !event.metaKey && !event.altKey) action.target = 'current';
  window.cove.dispatch(action);
}

function targetFor(event: { metaKey: boolean; altKey: boolean }): 'current' | 'new' | 'little' {
  if (event.altKey) return 'little';
  if (event.metaKey) return 'new';
  return mode === 'edit' ? 'current' : 'new';
}

input.focus();
