import { execFileSync } from 'child_process';
import { app, BaseWindow, Menu, type MenuItemConstructorOptions } from 'electron';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import type { Action } from '../shared/types';
import { Cove } from './cove';
import { importArc } from './importArc';
import { handleCoveProtocol, registerCoveScheme } from './protocol';
import { Store } from './store';

registerCoveScheme();

if (process.env.COVE_SMOKE) {
  app.setPath('userData', join(tmpdir(), `cove-smoke-${process.pid}`));
}

let cove: Cove | null = null;
let pendingUrl = '';

const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();

app.setName('Cove');
app.setAboutPanelOptions({
  applicationName: 'Cove',
  applicationVersion: '0.1.0',
  version: '0.1.0',
  copyright: 'Independent Chromium browser. Not affiliated with The Browser Company.',
  credits: 'Sidebar tabs, spaces, and a command bar. No assistant.',
});

app.on('second-instance', (_event, argv) => {
  const url = argv.find((arg) => /^https?:\/\//i.test(arg));
  if (url) cove?.openExternalUrl(url);
  const win = cove?.focused()?.win;
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (cove) cove.openExternalUrl(url);
  else pendingUrl = url;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!cove) return;
  if (!cove.focused()) void cove.run({ type: 'new-window' });
});

if (locked) app.whenReady().then(async () => {
  if (process.env.COVE_SMOKE === 'import') {
    try {
      const imported = importArc(homedir());
      console.log(JSON.stringify(imported.report));
      app.exit(0);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'import failed');
      app.exit(1);
    }
    return;
  }

  handleCoveProtocol(__dirname, join(app.getPath('userData'), 'favicons'));
  const store = new Store();
  cove = new Cove(store);
  installMenu(cove);
  cove.start();
  if (pendingUrl) cove.openExternalUrl(pendingUrl);

  if (process.env.COVE_SMOKE === 'ui') {
    setTimeout(() => {
      void (async () => {
        if (process.env.COVE_IMPORT === '1') await cove?.run({ type: 'import-arc' });
        if (process.env.COVE_URL) await cove?.run({ type: 'commit-omnibox', query: process.env.COVE_URL, target: 'new' });
        if (process.env.COVE_COMMAND === '1') await cove?.run({ type: 'open-command', mode: 'new' });
        else await cove?.run({ type: 'open-page', page: process.env.COVE_PAGE || 'newtab' });
      })();
    }, 500);
    setTimeout(() => {
      const win = BaseWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
      const shot = '/tmp/cove-smoke.png';
      if (win) {
        const id = win.getMediaSourceId().split(':')[1];
        try {
          execFileSync('screencapture', ['-x', '-o', '-l', id, shot]);
          console.log('wrote', shot, id);
        } catch (error) {
          console.error(error instanceof Error ? error.message : 'screenshot failed');
        }
      }
      app.exit(0);
    }, 6000);
  }
});

function installMenu(browser: Cove): void {
  const go = (action: Action) => () => {
    void browser.run(action);
  };
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Cove',
      submenu: [
        { role: 'about' },
        { label: 'Settings…', click: go({ type: 'open-page', page: 'settings' }) },
        { label: 'Membership Card', click: go({ type: 'open-page', page: 'membership' }) },
        { label: 'Passwords', click: go({ type: 'open-page', page: 'passwords' }) },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', click: go({ type: 'open-command', mode: 'new' }) },
        { label: 'New Window', click: go({ type: 'new-window' }) },
        { label: 'New Incognito Window', click: go({ type: 'incognito' }) },
        { label: 'Little Cove', click: go({ type: 'little-arc' }) },
        { type: 'separator' },
        { label: 'New Note', click: go({ type: 'new-note' }) },
        { label: 'New Easel', click: go({ type: 'new-easel' }) },
        { label: 'New Space', click: go({ type: 'new-space' }) },
        { type: 'separator' },
        { label: 'Open File…', click: go({ type: 'open-file' }) },
        { type: 'separator' },
        { label: 'Close Tab', click: go({ type: 'close-tab' }) },
        { label: 'Close Window', click: go({ type: 'close-window' }) },
      ],
    },
    {
      role: 'editMenu',
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Sidebar', click: go({ type: 'toggle-sidebar' }) },
        { label: 'Reload', click: go({ type: 'reload' }) },
        { label: 'Reload Ignoring Cache', click: go({ type: 'reload', hard: true }) },
        { type: 'separator' },
        { label: 'Actual Size', click: go({ type: 'zoom', dir: 'reset' }) },
        { label: 'Zoom In', click: go({ type: 'zoom', dir: 'in' }) },
        { label: 'Zoom Out', click: go({ type: 'zoom', dir: 'out' }) },
        { type: 'separator' },
        { label: 'Add Split View', click: go({ type: 'add-split' }) },
        { label: 'Close Split', click: go({ type: 'close-split-pane' }) },
        { label: 'Capture Page', click: go({ type: 'capture' }) },
        { label: 'Translate Page', click: go({ type: 'translate' }) },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { label: 'Developer Tools', click: go({ type: 'devtools' }) },
      ],
    },
    {
      label: 'History',
      submenu: [
        { label: 'Back', click: go({ type: 'back' }) },
        { label: 'Forward', click: go({ type: 'forward' }) },
        { label: 'Reopen Closed Tab', click: go({ type: 'reopen' }) },
        { type: 'separator' },
        { label: 'Library', click: go({ type: 'open-page', page: 'library' }) },
        { label: 'Clear Unpinned Tabs', click: go({ type: 'clear-today' }) },
      ],
    },
    {
      label: 'Spaces',
      submenu: [
        { label: 'Next Space', click: go({ type: 'cycle-space', delta: 1 }) },
        { label: 'Previous Space', click: go({ type: 'cycle-space', delta: -1 }) },
        { label: 'Pin Tab', click: go({ type: 'pin' }) },
        { label: 'Favorite Tab', click: go({ type: 'favorite' }) },
        { label: 'Archive Tab', click: go({ type: 'archive-tab' }) },
      ],
    },
    {
      role: 'windowMenu',
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
