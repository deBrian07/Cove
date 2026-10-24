import type { CommandInfo } from './types';

export interface CommandDef {
  id: string;
  title: string;
  keywords: string;
  accelerator?: string;
  group: string;
}

export const COMMANDS: CommandDef[] = [
  { id: 'open-command', title: 'Command bar', keywords: 'new tab search go', accelerator: 'Command+T', group: 'Navigation' },
  { id: 'edit-url', title: 'Change current tab URL', keywords: 'location address omnibox', accelerator: 'Command+L', group: 'Navigation' },
  { id: 'new-window', title: 'New window', keywords: 'window', accelerator: 'Command+N', group: 'Navigation' },
  { id: 'blank-window', title: 'Blank window', keywords: 'empty window', group: 'Navigation' },
  { id: 'incognito', title: 'New incognito window', keywords: 'private', accelerator: 'Command+Shift+N', group: 'Navigation' },
  { id: 'little-arc', title: 'Little Cove', keywords: 'little arc mini popup', accelerator: 'Command+Alt+N', group: 'Navigation' },
  { id: 'close-tab', title: 'Close tab', keywords: 'close', accelerator: 'Command+W', group: 'Navigation' },
  { id: 'close-window', title: 'Close window', keywords: 'close window', accelerator: 'Command+Shift+W', group: 'Navigation' },
  { id: 'reopen', title: 'Reopen last closed tab', keywords: 'undo close', accelerator: 'Command+Shift+T', group: 'Navigation' },
  { id: 'copy-url', title: 'Copy current URL', keywords: 'copy link', accelerator: 'Command+Shift+C', group: 'Navigation' },
  { id: 'copy-md', title: 'Copy URL as Markdown', keywords: 'markdown link', accelerator: 'Command+Alt+Shift+C', group: 'Navigation' },
  { id: 'toggle-sidebar', title: 'Show or hide sidebar', keywords: 'sidebar', accelerator: 'Command+S', group: 'Navigation' },
  { id: 'clear-today', title: 'Clear unpinned tabs', keywords: 'clear today archive', accelerator: 'Command+Shift+K', group: 'Navigation' },
  { id: 'back', title: 'Go back', keywords: 'history back', accelerator: 'Command+Left', group: 'Navigation' },
  { id: 'forward', title: 'Go forward', keywords: 'history forward', accelerator: 'Command+Right', group: 'Navigation' },
  { id: 'reload', title: 'Reload', keywords: 'refresh', accelerator: 'Command+R', group: 'Navigation' },
  { id: 'hard-reload', title: 'Reload ignoring cache', keywords: 'hard refresh', accelerator: 'Command+Shift+R', group: 'Navigation' },
  { id: 'home', title: 'New tab page', keywords: 'home', group: 'Navigation' },
  { id: 'find-open', title: 'Find on page', keywords: 'find search', accelerator: 'Command+F', group: 'Navigation' },
  { id: 'print', title: 'Print', keywords: 'print', accelerator: 'Command+P', group: 'Navigation' },
  { id: 'quit', title: 'Quit Cove', keywords: 'quit exit', accelerator: 'Command+Q', group: 'Navigation' },
  { id: 'next-tab', title: 'Toggle between recent tabs', keywords: 'switcher', accelerator: 'Control+Tab', group: 'Navigation' },
  { id: 'prev-tab', title: 'Previous recent tab', keywords: 'switcher', accelerator: 'Control+Shift+Tab', group: 'Navigation' },
  { id: 'prev-sidebar', title: 'Previous tab in sidebar', keywords: 'up', accelerator: 'Command+Alt+Up', group: 'Navigation' },
  { id: 'next-sidebar', title: 'Next tab in sidebar', keywords: 'down', accelerator: 'Command+Alt+Down', group: 'Navigation' },
  { id: 'prev-space', title: 'Previous space', keywords: 'space left', accelerator: 'Command+Alt+Left', group: 'Spaces' },
  { id: 'next-space', title: 'Next space', keywords: 'space right', accelerator: 'Command+Alt+Right', group: 'Spaces' },
  { id: 'new-space', title: 'New space', keywords: 'workspace', group: 'Spaces' },
  { id: 'pin', title: 'Pin or unpin tab', keywords: 'pin bookmark', accelerator: 'Command+D', group: 'Organization' },
  { id: 'favorite', title: 'Favorite tab', keywords: 'favorite top apps', accelerator: 'Command+Shift+D', group: 'Organization' },
  { id: 'new-folder', title: 'New folder', keywords: 'folder group', group: 'Organization' },
  { id: 'archive-tab', title: 'Archive tab', keywords: 'archive', group: 'Organization' },
  { id: 'rename-item', title: 'Rename current tab', keywords: 'rename', group: 'Organization' },
  { id: 'duplicate', title: 'Duplicate tab', keywords: 'duplicate', group: 'Organization' },
  { id: 'reset-pin', title: 'Reset pinned tab', keywords: 'reset original url', group: 'Organization' },
  { id: 'replace-pin', title: 'Replace pin with current page', keywords: 'replace pin', group: 'Organization' },
  { id: 'add-split', title: 'Add split view', keywords: 'split', accelerator: 'Control+Shift+=', group: 'Split view' },
  { id: 'close-split-pane', title: 'Close split view', keywords: 'unsplit', accelerator: 'Control+Shift+-', group: 'Split view' },
  { id: 'toggle-split-orientation', title: 'Flip split direction', keywords: 'vertical horizontal', group: 'Split view' },
  { id: 'expand-split', title: 'Expand current split', keywords: 'expand unsplit', group: 'Split view' },
  { id: 'focus-split-1', title: 'Focus first split', keywords: 'split 1', accelerator: 'Control+Shift+1', group: 'Split view' },
  { id: 'focus-split-2', title: 'Focus second split', keywords: 'split 2', accelerator: 'Control+Shift+2', group: 'Split view' },
  { id: 'new-note', title: 'New note', keywords: 'note markdown', group: 'Tools' },
  { id: 'new-note-split', title: 'New note in split view', keywords: 'note split', group: 'Tools' },
  { id: 'new-easel', title: 'New easel', keywords: 'canvas draw whiteboard', group: 'Tools' },
  { id: 'capture', title: 'Capture page', keywords: 'screenshot', accelerator: 'Command+Shift+S', group: 'Tools' },
  { id: 'capture-full', title: 'Capture full page', keywords: 'full screenshot', group: 'Tools' },
  { id: 'translate', title: 'Translate this page', keywords: 'translate language', group: 'Tools' },
  { id: 'join-call', title: 'Join call', keywords: 'zoom meet teams', group: 'Tools' },
  { id: 'open-library', title: 'Open library', keywords: 'history downloads archive', accelerator: 'Command+Alt+L', group: 'Tools' },
  { id: 'open-settings', title: 'Settings', keywords: 'preferences', accelerator: 'Command+,', group: 'Tools' },
  { id: 'membership', title: 'Membership card', keywords: 'card anniversary profile member', group: 'Tools' },
  { id: 'open-passwords', title: 'Passwords', keywords: 'passwords logins', group: 'Tools' },
  { id: 'mute', title: 'Mute or unmute tab', keywords: 'mute audio', group: 'Tools' },
  { id: 'media-pip', title: 'Picture in picture', keywords: 'pip video', group: 'Tools' },
  { id: 'devtools', title: 'Developer tools', keywords: 'inspect', accelerator: 'Alt+Command+I', group: 'Tools' },
  { id: 'open-file', title: 'Open file', keywords: 'file html pdf', accelerator: 'Command+O', group: 'Tools' },
  { id: 'new-doc', title: 'New Google Doc', keywords: 'docs document', group: 'Create' },
  { id: 'new-sheet', title: 'New Google Sheet', keywords: 'sheets spreadsheet', group: 'Create' },
  { id: 'new-slides', title: 'New Google Slides', keywords: 'slides deck', group: 'Create' },
  { id: 'new-figma', title: 'New Figma file', keywords: 'figma', group: 'Create' },
  { id: 'new-notion', title: 'New Notion page', keywords: 'notion', group: 'Create' },
  { id: 'edit-boost', title: 'Edit boost for this site', keywords: 'boost css js', group: 'Tools' },
  { id: 'import-arc', title: 'Import from Arc', keywords: 'import arc sidebar', group: 'Tools' },
];

for (let n = 1; n <= 9; n += 1) {
  COMMANDS.push({
    id: `go-tab-${n}`,
    title: `Go to tab ${n}`,
    keywords: 'tab number',
    accelerator: `Command+${n}`,
    group: 'Navigation',
  });
  COMMANDS.push({
    id: `focus-space-${n}`,
    title: `Focus space ${n}`,
    keywords: 'space number',
    accelerator: `Control+${n}`,
    group: 'Spaces',
  });
}

export function commandList(overrides: Record<string, string>): CommandInfo[] {
  return COMMANDS.map((c) => ({
    id: c.id,
    title: c.title,
    group: c.group,
    accelerator: Object.prototype.hasOwnProperty.call(overrides, c.id) ? overrides[c.id] : c.accelerator || '',
  }));
}

export function acceleratorFor(id: string, overrides: Record<string, string>): string {
  if (Object.prototype.hasOwnProperty.call(overrides, id)) return overrides[id];
  return COMMANDS.find((c) => c.id === id)?.accelerator || '';
}
