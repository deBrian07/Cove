import { COMMANDS } from '../shared/commands';
import type { Action, HistoryEntry, Item, Library, Result, Space } from '../shared/types';
import { hostOf, looksLikeUrl } from '../shared/url';

export function queryCommands(
  library: Library,
  query: string,
  opts: { spaceId: string; activeUrl: string; mru: string[]; history: HistoryEntry[] },
): Result[] {
  const q = query.trim().toLowerCase();
  const results: Result[] = [];
  const push = (result: Result) => {
    if (results.some((r) => r.id === result.id)) return;
    results.push(result);
  };

  if (!q) {
    for (const id of opts.mru) {
      const item = library.items.find((i) => i.id === id && i.section !== 'archive');
      if (item) push(tabResult(item, library.spaces));
      if (results.length >= 6) break;
    }
    for (const id of ['little-arc', 'new-note', 'new-easel', 'add-split', 'clear-today', 'copy-url', 'open-library', 'open-settings']) {
      const command = COMMANDS.find((c) => c.id === id);
      if (command) push(commandResult(command.id, command.title, command.group));
    }
    return results.slice(0, 12);
  }

  const folderName = q.match(/^(?:folder|new folder)\s+(.+)/)?.[1];
  if (folderName) {
    push({
      id: `folder:${folderName}`,
      title: `New folder “${folderName}”`,
      subtitle: 'Pinned in this space',
      kind: 'command',
      action: { type: 'new-folder', name: folderName },
    });
  }
  const rename = q.match(/^(?:rename)\s+(.+)/)?.[1];
  if (rename) {
    push({
      id: `rename:${rename}`,
      title: `Rename tab to “${rename}”`,
      subtitle: 'Current tab',
      kind: 'command',
      action: { type: 'rename-item', id: '', title: rename },
    });
  }

  const url = looksLikeUrl(query.trim());
  if (url) {
    push({
      id: `url:${url}`,
      title: `Open ${url}`,
      subtitle: 'Website',
      kind: 'url',
      action: { type: 'commit-omnibox', query: url, target: 'new' },
    });
  }

  const tabs = library.items.filter((i) => i.kind !== 'folder' && i.section !== 'archive' && matches(q, `${i.customTitle || i.title} ${i.url}`));
  tabs.sort((a, b) => score(q, a) - score(q, b));
  for (const item of tabs.slice(0, 8)) push(tabResult(item, library.spaces));

  for (const space of library.spaces) {
    if (matches(q, space.name)) {
      push({
        id: `space:${space.id}`,
        title: `Focus ${space.name}`,
        subtitle: 'Space',
        kind: 'space',
        action: { type: 'activate-space', id: space.id },
      });
      push({
        id: `pin-space:${space.id}`,
        title: `Pin current tab to ${space.name}`,
        subtitle: 'Space',
        kind: 'command',
        action: { type: 'move-tab', id: '', spaceId: space.id, section: 'pinned' },
      });
    }
  }

  for (const command of COMMANDS) {
    if (command.accelerator && /go-tab-|focus-space-/.test(command.id)) continue;
    if (matches(q, `${command.title} ${command.keywords}`)) {
      push(commandResult(command.id, command.title, command.group));
    }
  }

  for (const entry of library.items.filter((i) => i.section === 'archive' && matches(q, `${i.title} ${i.url}`)).slice(0, 5)) {
    push({
      id: `archive:${entry.id}`,
      title: entry.customTitle || entry.title,
      subtitle: `Archive · ${hostOf(entry.url)}`,
      kind: 'archive',
      action: { type: 'restore-tab', id: entry.id },
    });
  }

  for (const entry of opts.history.filter((h) => matches(q, `${h.title} ${h.url}`)).slice(0, 5)) {
    push({
      id: `hist:${entry.id}`,
      title: entry.title || hostOf(entry.url),
      subtitle: entry.url,
      kind: 'history',
      action: { type: 'commit-omnibox', query: entry.url, target: 'new' },
    });
  }

  if (q) {
    push({
      id: `search:${q}`,
      title: `Search for “${query.trim()}”`,
      subtitle: library.settings.searchEngine,
      kind: 'search',
      action: { type: 'commit-omnibox', query: query.trim(), target: 'new' },
    });
  }
  return results.slice(0, 30);
}

function commandResult(id: string, title: string, group: string): Result {
  return { id: `cmd:${id}`, title, subtitle: group, kind: 'command', action: commandAction(id) };
}

export function commandAction(id: string): Action {
  switch (id) {
    case 'open-command':
      return { type: 'open-command', mode: 'new' };
    case 'edit-url':
      return { type: 'open-command', mode: 'edit' };
    case 'new-window':
      return { type: 'new-window' };
    case 'blank-window':
      return { type: 'new-window', blank: true };
    case 'incognito':
      return { type: 'incognito' };
    case 'little-arc':
      return { type: 'little-arc' };
    case 'close-tab':
      return { type: 'close-tab' };
    case 'close-window':
      return { type: 'close-window' };
    case 'reopen':
      return { type: 'reopen' };
    case 'copy-url':
      return { type: 'copy-url' };
    case 'copy-md':
      return { type: 'copy-url', markdown: true };
    case 'toggle-sidebar':
      return { type: 'toggle-sidebar' };
    case 'clear-today':
      return { type: 'clear-today' };
    case 'back':
      return { type: 'back' };
    case 'forward':
      return { type: 'forward' };
    case 'reload':
      return { type: 'reload' };
    case 'hard-reload':
      return { type: 'reload', hard: true };
    case 'home':
      return { type: 'home' };
    case 'find-open':
      return { type: 'find-open' };
    case 'print':
      return { type: 'print' };
    case 'quit':
      return { type: 'quit' };
    case 'next-tab':
      return { type: 'cycle-tab', delta: 1 };
    case 'prev-tab':
      return { type: 'cycle-tab', delta: -1 };
    case 'prev-sidebar':
      return { type: 'cycle-sidebar', delta: -1 };
    case 'next-sidebar':
      return { type: 'cycle-sidebar', delta: 1 };
    case 'prev-space':
      return { type: 'cycle-space', delta: -1 };
    case 'next-space':
      return { type: 'cycle-space', delta: 1 };
    case 'new-space':
      return { type: 'new-space' };
    case 'pin':
      return { type: 'pin' };
    case 'favorite':
      return { type: 'favorite' };
    case 'new-folder':
      return { type: 'new-folder' };
    case 'archive-tab':
      return { type: 'archive-tab' };
    case 'rename-item':
      return { type: 'rename-item', id: '', title: '' };
    case 'duplicate':
      return { type: 'duplicate' };
    case 'reset-pin':
      return { type: 'reset-pin' };
    case 'replace-pin':
      return { type: 'replace-pin' };
    case 'add-split':
      return { type: 'add-split' };
    case 'close-split-pane':
      return { type: 'close-split-pane' };
    case 'toggle-split-orientation':
      return { type: 'toggle-split-orientation' };
    case 'expand-split':
      return { type: 'expand-split' };
    case 'focus-split-1':
      return { type: 'focus-split-index', index: 0 };
    case 'focus-split-2':
      return { type: 'focus-split-index', index: 1 };
    case 'new-note':
      return { type: 'new-note' };
    case 'new-note-split':
      return { type: 'new-note', split: true };
    case 'new-easel':
      return { type: 'new-easel' };
    case 'capture':
      return { type: 'capture' };
    case 'capture-full':
      return { type: 'capture', full: true };
    case 'translate':
      return { type: 'translate' };
    case 'join-call':
      return { type: 'join-call' };
    case 'open-library':
      return { type: 'open-page', page: 'library' };
    case 'open-settings':
      return { type: 'open-page', page: 'settings' };
    case 'membership':
      return { type: 'open-page', page: 'membership' };
    case 'open-passwords':
      return { type: 'open-page', page: 'passwords' };
    case 'mute':
      return { type: 'mute' };
    case 'media-pip':
      return { type: 'media', op: 'pip' };
    case 'devtools':
      return { type: 'devtools' };
    case 'open-file':
      return { type: 'open-file' };
    case 'new-doc':
      return { type: 'commit-omnibox', query: 'https://docs.new', target: 'new' };
    case 'new-sheet':
      return { type: 'commit-omnibox', query: 'https://sheets.new', target: 'new' };
    case 'new-slides':
      return { type: 'commit-omnibox', query: 'https://slides.new', target: 'new' };
    case 'new-figma':
      return { type: 'commit-omnibox', query: 'https://figma.new', target: 'new' };
    case 'new-notion':
      return { type: 'commit-omnibox', query: 'https://www.notion.so/new', target: 'new' };
    case 'edit-boost':
      return { type: 'open-page', page: 'boost/new' };
    case 'import-arc':
      return { type: 'import-arc' };
    default:
      if (id.startsWith('go-tab-')) return { type: 'go-tab-index', index: Number(id.slice(7)) - 1 };
      if (id.startsWith('focus-space-')) return { type: 'focus-space-index', index: Number(id.slice(12)) - 1 };
      return { type: 'open-command', mode: 'new' };
  }
}

function tabResult(item: Item, spaces: Space[]): Result {
  const space = spaces.find((s) => s.id === item.spaceId);
  return {
    id: `tab:${item.id}`,
    title: item.customTitle || item.title || 'Tab',
    subtitle: [space?.name, item.section === 'favorites' ? 'Favorite' : item.section === 'pinned' ? 'Pinned' : 'Today', hostOf(item.url)]
      .filter(Boolean)
      .join(' · '),
    kind: 'tab',
    action: { type: 'activate-tab', id: item.id },
  };
}

function matches(q: string, hay: string): boolean {
  const text = hay.toLowerCase();
  return q.split(/\s+/).every((part) => text.includes(part));
}

function score(q: string, item: Item): number {
  const title = (item.customTitle || item.title).toLowerCase();
  if (title.startsWith(q)) return 0;
  if (title.includes(q)) return 1;
  return 2;
}
