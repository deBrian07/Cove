import {
  BaseWindow,
  BrowserWindow,
  Menu,
  Notification,
  WebContents,
  WebContentsView,
  app,
  clipboard,
  dialog,
  ipcMain,
  nativeTheme,
  net,
  session,
  shell,
} from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { commandList } from '../shared/commands';
import { greeting, themeFor } from '../shared/theme';
import type { Action, DownloadRec, EaselDoc, Item, LibRow, Section, Settings, Snapshot, Space } from '../shared/types';
import { clamp, hostMatches, hostOf, isInternalPage, isWebUrl, originOf, resolveQuery, safeHttpUrl, uid } from '../shared/url';
import { isAdUrl } from './blocklist';
import { importArc, readArcMembership } from './importArc';
import { handleCoveProtocol } from './protocol';
import { bindingMap, keyToken } from './keys';
import { commandAction, queryCommands } from './search';
import { Store } from './store';

interface Win {
  id: number;
  win: BaseWindow;
  shell: WebContentsView;
  mode: 'main' | 'little' | 'peek';
  incognito: boolean;
  partition: string;
  spaceId: string;
  activeTabId: string | null;
  peeking: boolean;
  command: BrowserWindow | null;
  find: BrowserWindow | null;
  switcher: BrowserWindow | null;
  site: BrowserWindow | null;
  preview: BrowserWindow | null;
  password: BrowserWindow | null;
  auth: BrowserWindow | null;
  dividers: WebContentsView[];
  peekView: WebContentsView | null;
}

interface Live {
  view: WebContentsView;
  windowId: number | null;
}

const PAGE_BLOCK = new Set(['auth-reply', 'sidebar-peek', 'preview-tab', 'hide-preview', 'divider-drag']);
const MEETING = /zoom\.us|meet\.google\.com|teams\.microsoft\.com|webex\.com/;

export class Cove {
  private windows = new Map<number, Win>();
  private views = new Map<string, Live>();
  private owner = new Map<string, number>();
  private loading = new Set<string>();
  private audible = new Set<string>();
  private mru: string[] = [];
  private keys = new Map<string, string>();
  private ua = '';
  private sessionsReady = new Set<string>();
  private switcher: { ids: string[]; index: number; windowId: number } | null = null;
  private pendingRename: string | null = null;
  private editSpaceId: string | null = null;
  private sound = 0;
  private authPending: ((user: string, pass: string) => void) | null = null;
  private passwordPending = new Map<string, { origin: string; username: string; password: string }>();
  private allowHttp = new Set<string>();
  private lastReload = new Map<string, number>();
  private importsRunning = false;

  constructor(private store: Store) {}

  start(): void {
    this.store.load();
    this.hydrateMembership();
    mkdirSync(this.faviconDir, { recursive: true });
    mkdirSync(this.thumbDir, { recursive: true });
    this.ua = session.defaultSession.getUserAgent().replace(/\sElectron\/\S+/g, '').replace(/\sCove\/\S+/g, '');
    app.userAgentFallback = this.ua;
    this.rebuildKeys();
    this.bindIpc();
    nativeTheme.on('updated', () => this.refresh());
    setInterval(() => this.archiveSweep(), 60_000);
    setInterval(() => this.pollAudio(), 1500);
    setInterval(() => this.store.pullSync(), 30_000);
    const first = this.createWindow('main');
    this.ensureStart(first);
    this.layout(first);
    this.refresh();
  }

  run(action: Action): Promise<unknown> {
    const win = this.focused();
    if (!win) return Promise.resolve(null);
    return this.dispatch(action, win);
  }

  focused(): Win | null {
    const current = BaseWindow.getFocusedWindow();
    if (current) {
      const found = this.windows.get(current.id);
      if (found) return found;
    }
    return [...this.windows.values()].find((win) => win.mode === 'main') || null;
  }

  openExternalUrl(url: string): void {
    const safe = safeHttpUrl(url);
    if (!safe) return;
    if (this.store.library.settings.openExternalIn === 'little') this.openLittle(safe);
    else {
      const win = this.focused() || this.createWindow('main');
      this.openUrl(win, safe, 'today');
      win.win.show();
      win.win.focus();
    }
  }

  private bindIpc(): void {
    ipcMain.handle('cove:dispatch', (event, action: Action) => this.dispatch(action, this.windowFromEvent(event.sender), event.sender));
    ipcMain.handle('cove:snapshot', (event) => {
      const win = this.windowFromEvent(event.sender);
      return win ? this.snapshot(win) : null;
    });
    ipcMain.handle('cove:search', (event, query: string, mode: 'new' | 'edit') => {
      const win = this.windowFromEvent(event.sender);
      return win ? this.search(win, query, mode) : [];
    });
    ipcMain.handle('cove:boot', (event) => this.boot(event.sender));
    ipcMain.handle('cove:library', (_event, section: string, query: string, offset: number) => this.libraryRows(section, query, offset));
    ipcMain.on('cove:guest', (event, payload) => this.onGuest(event.sender, payload));
  }

  private async dispatch(action: Action, win: Win | null, sender?: WebContents): Promise<unknown> {
    if (!win) win = this.focused();
    if (!win) return null;
    if (sender && !this.senderAllowed(sender, action)) return { error: 'blocked' };
    try {
      const result = await this.apply(action, win, sender);
      this.store.touch();
      for (const open of this.windows.values()) this.layout(open);
      this.refresh();
      return result ?? { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong';
      console.error(message);
      return { error: message };
    }
  }

  private senderAllowed(sender: WebContents, action: Action): boolean {
    const url = sender.getURL();
    if (/cove:\/\/app\/(shell|command|overlay|divider)\.html/.test(url)) return true;
    if (!isInternalPage(url)) return false;
    return !PAGE_BLOCK.has(action.type);
  }

  private createWindow(mode: Win['mode'], opts?: { incognito?: boolean; parent?: Win; blank?: boolean }): Win {
    const incognito = !!opts?.incognito;
    const settings = this.store.library.settings;
    const bounds = mode === 'main' ? settings && this.store.library.ui.bounds : null;
    const browser = new BaseWindow({
      width: mode === 'main' ? bounds?.width || 1280 : mode === 'little' ? 460 : 420,
      height: mode === 'main' ? bounds?.height || 840 : mode === 'little' ? 720 : 640,
      x: mode === 'main' ? bounds?.x : undefined,
      y: mode === 'main' ? bounds?.y : undefined,
      minWidth: mode === 'main' ? 860 : 360,
      minHeight: mode === 'main' ? 560 : 420,
      show: false,
      title: incognito ? 'Cove Incognito' : 'Cove',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: mode === 'main' ? 16 : 14, y: mode === 'main' ? 16 : 16 },
      backgroundColor: '#ffffff',
      alwaysOnTop: mode === 'peek' || (mode === 'little' && settings.littleOnTop),
      parent: mode === 'peek' ? opts?.parent?.win : undefined,
    });
    const shell = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, 'ui.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    browser.contentView.addChildView(shell);
    const win: Win = {
      id: browser.id,
      win: browser,
      shell,
      mode,
      incognito,
      partition: incognito ? `incognito-${uid()}` : '',
      spaceId: this.store.library.ui.lastSpaceId || this.spaces()[0]?.id || '',
      activeTabId: null,
      peeking: false,
      command: null,
      find: null,
      switcher: null,
      site: null,
      preview: null,
      password: null,
      auth: null,
      dividers: [],
      peekView: null,
    };
    this.windows.set(win.id, win);
    if (incognito) this.prepareSession(win.partition);
    shell.webContents.loadURL('cove://app/shell.html');
    this.bindKeys(shell.webContents, win);
    browser.on('resize', () => this.layout(win));
    browser.on('enter-full-screen', () => this.layout(win));
    browser.on('leave-full-screen', () => this.layout(win));
    browser.on('swipe', (_event, direction) => {
      if (direction === 'left') void this.dispatch({ type: 'back' }, win);
      if (direction === 'right') void this.dispatch({ type: 'forward' }, win);
    });
    browser.on('close', () => this.persistBounds(win));
    browser.on('closed', () => this.onWindowClosed(win));
    shell.webContents.once('did-finish-load', () => {
      if (!browser.isDestroyed()) {
        browser.show();
        this.layout(win);
      }
    });
    if (opts?.blank) this.openUrl(win, 'cove://app/newtab', 'today');
    return win;
  }

  private ensureStart(win: Win): void {
    if (win.incognito) {
      this.openUrl(win, 'cove://app/newtab', 'today');
      return;
    }
    const space = this.space(win.spaceId) || this.spaces()[0];
    if (!space) return;
    win.spaceId = space.id;
    if (!this.store.library.settings.didOnboard && !this.store.library.items.some((item) => item.url.includes('/welcome'))) {
      const welcome = this.makeItem(space, { kind: 'tab', section: 'today', title: 'Welcome', url: 'cove://app/welcome' });
      win.activeTabId = welcome.id;
      return;
    }
    const last = this.item(this.store.library.ui.lastTabId || '');
    if (last && last.section !== 'archive') {
      win.spaceId = last.spaceId || space.id;
      win.activeTabId = last.kind === 'split' ? last.id : last.parentId && this.item(last.parentId)?.kind === 'split' ? last.parentId : last.id;
      return;
    }
    const existing = this.visibleItems(win)[0];
    if (existing) win.activeTabId = existing.kind === 'folder' ? existing.children[0] || existing.id : existing.id;
    else win.activeTabId = this.openUrl(win, 'cove://app/newtab', 'today').id;
  }

  private onWindowClosed(win: Win): void {
    for (const [id, live] of this.views) {
      if (live.windowId === win.id) {
        live.windowId = null;
        if (this.item(id)?.ephemeral) this.destroyView(id);
      }
    }
    win.peekView?.webContents.close();
    for (const divider of win.dividers) divider.webContents.close();
    if (win.incognito || win.mode !== 'main') {
      for (const item of [...this.store.library.items]) {
        if (item.ephemeral && this.owner.get(item.id) === win.id) this.removeItem(item, false);
      }
    }
    this.windows.delete(win.id);
    if (win.mode === 'main' && ![...this.windows.values()].some((candidate) => candidate.mode === 'main')) {
      this.store.flush();
    }
  }

  private persistBounds(win: Win): void {
    if (win.mode !== 'main' || win.incognito || win.win.isDestroyed()) return;
    const bounds = win.win.getBounds();
    this.store.library.ui.bounds = bounds;
    this.store.library.ui.lastSpaceId = win.spaceId;
    this.store.library.ui.lastTabId = win.activeTabId;
    this.store.touch();
  }

  private layout(win: Win): void {
    if (win.win.isDestroyed()) return;
    const [width, height] = win.win.getContentSize();
    if (width < 10 || height < 10) return;
    const settings = this.store.library.settings;
    let left = 0;
    let top = 0;
    if (win.mode === 'main') {
      const open = settings.sidebarVisible || win.peeking;
      left = open ? Math.max(240, settings.sidebarWidth) : 76;
      top = 38;
    } else {
      top = 52;
    }
    const area = { x: left, y: top, width: Math.max(0, width - left), height: Math.max(0, height - top) };
    win.shell.setBounds({ x: 0, y: 0, width, height });
    if (win.mode === 'peek' && win.peekView) {
      this.place(win.peekView, area);
      return;
    }
    const panes = this.panes(win);
    const split = this.activeSplit(win);
    const orientation = split?.splitOrientation || 'horizontal';
    const weights = normalize(split?.splitWeights?.length === panes.length ? split.splitWeights : panes.map(() => 1));
    const gap = 6;
    const dividers = Math.max(0, panes.length - 1);
    const span = (orientation === 'horizontal' ? area.width : area.height) - dividers * gap;
    let cursor = orientation === 'horizontal' ? area.x : area.y;
    const showing = new Set(panes.map((pane) => pane.id));
    for (const [id, live] of this.views) {
      if (live.windowId === win.id && !showing.has(id)) live.view.setVisible(false);
    }
    panes.forEach((pane, index) => {
      const size = Math.max(40, Math.round(span * (weights[index] || 1 / panes.length)));
      const live = this.ensureView(pane, win);
      this.attach(live, win);
      const bounds = orientation === 'horizontal'
        ? { x: cursor, y: area.y, width: size, height: area.height }
        : { x: area.x, y: cursor, width: area.width, height: size };
      this.place(live.view, bounds);
      cursor += size;
      if (index < panes.length - 1 && split) {
        const divider = this.ensureDivider(win, index);
        const target = `cove://app/divider.html?id=${encodeURIComponent(split.id)}&index=${index}&axis=${orientation === 'horizontal' ? 'h' : 'v'}`;
        if (divider.webContents.getURL() !== target) void divider.webContents.loadURL(target);
        const bar = orientation === 'horizontal'
          ? { x: cursor, y: area.y, width: gap, height: area.height }
          : { x: area.x, y: cursor, width: area.width, height: gap };
        this.place(divider, bar);
        cursor += gap;
      }
    });
    for (let i = dividers; i < win.dividers.length; i += 1) win.dividers[i].setVisible(false);
    const theme = this.theme(win);
    win.win.setBackgroundColor(theme.bg);
  }

  private place(view: WebContentsView, bounds: { x: number; y: number; width: number; height: number }): void {
    view.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.max(0, Math.round(bounds.width)),
      height: Math.max(0, Math.round(bounds.height)),
    });
    view.setVisible(true);
  }

  private panes(win: Win): Item[] {
    const active = this.item(win.activeTabId || '');
    if (!active) return [];
    if (active.kind === 'split') return this.children(active).filter((child) => child.kind !== 'folder');
    if (active.parentId) {
      const parent = this.item(active.parentId);
      if (parent?.kind === 'split') return this.children(parent).filter((child) => child.kind !== 'folder');
    }
    if (active.kind === 'folder') return [];
    return [active];
  }

  private activeSplit(win: Win): Item | null {
    const active = this.item(win.activeTabId || '');
    if (!active) return null;
    if (active.kind === 'split') return active;
    if (active.parentId) {
      const parent = this.item(active.parentId);
      if (parent?.kind === 'split') return parent;
    }
    return null;
  }

  private ensureDivider(win: Win, index: number): WebContentsView {
    while (win.dividers.length <= index) {
      const view = new WebContentsView({
        webPreferences: {
          preload: join(__dirname, 'ui.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      view.setBackgroundColor('#00000000');
      win.win.contentView.addChildView(view);
      win.dividers.push(view);
    }
    return win.dividers[index];
  }

  private ensureView(item: Item, win: Win): Live {
    const existing = this.views.get(item.id);
    if (existing) return existing;
    const partition = win.incognito ? win.partition : this.profile(item.profileId)?.partition || this.store.library.profiles[0].partition;
    this.prepareSession(partition);
    const view = new WebContentsView({
      webPreferences: {
        partition,
        preload: join(__dirname, 'guest.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: true,
      },
    });
    view.setBackgroundColor('#ffffff');
    const live: Live = { view, windowId: null };
    this.views.set(item.id, live);
    this.wireView(view.webContents, item, win);
    const url = item.url || 'cove://app/newtab';
    void view.webContents.loadURL(this.prepareUrl(item, url));
    if (item.muted) view.webContents.setAudioMuted(true);
    this.touchLru(item.id);
    this.evict();
    return live;
  }

  private wireView(wc: WebContents, item: Item, win: Win): void {
    this.bindKeys(wc, win);
    wc.setWindowOpenHandler((details) => {
      const target = safeHttpUrl(details.url) || (isInternalPage(details.url) ? details.url : '');
      if (target) {
        const host = this.windowFromContents(wc) || win;
        if (host.mode === 'little') this.openExternalUrl(target);
        else this.openUrl(host, target, 'today');
        this.refresh();
      } else if (/^[a-z][a-z0-9+.-]*:/i.test(details.url)) {
        void this.openSystem(details.url);
      }
      return { action: 'deny' };
    });
    wc.on('will-navigate', (event, url) => {
      if (isWebUrl(url) || isInternalPage(url)) {
        if (url.startsWith('http://') && this.store.library.settings.httpsOnly && !this.allowHttp.has(item.id)) {
          event.preventDefault();
          void wc.loadURL(this.prepareUrl(item, url));
        }
        return;
      }
      if (url.startsWith('file:')) return;
      event.preventDefault();
      if (/^[a-z][a-z0-9+.-]*:/i.test(url)) void this.openSystem(url);
    });
    wc.on('did-start-loading', () => {
      this.loading.add(item.id);
      this.refresh();
    });
    wc.on('did-stop-loading', () => {
      this.loading.delete(item.id);
      this.refresh();
    });
    wc.on('did-navigate', (_event, url) => this.afterNavigate(item, url));
    wc.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (isMainFrame) this.afterNavigate(item, url);
    });
    wc.on('did-finish-load', () => {
      const current = wc.getURL();
      void this.applyBoosts(wc, current);
      this.applyZoom(wc, current);
    });
    wc.on('page-title-updated', (_event, title) => {
      if (!item.customTitle && title && !currentIsError(wc)) {
        item.title = title;
        const active = this.isActive(item.id);
        if (!active) item.unread = true;
        this.store.touch();
        this.refresh();
      }
    });
    wc.on('page-favicon-updated', (_event, urls) => {
      const pick = [...urls].reverse().find(Boolean);
      if (pick) void this.cacheFavicon(item, pick);
    });
    wc.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
      if (!isMainFrame || code === -3 || url.startsWith('cove://app/error')) return;
      void wc.loadURL(`cove://app/error?code=${code}&desc=${encodeURIComponent(desc)}&url=${encodeURIComponent(url)}`);
    });
    wc.on('render-process-gone', () => {
      if (!wc.isDestroyed()) void wc.loadURL('cove://app/error?code=crash&desc=This%20page%20crashed&url=');
    });
    wc.on('login', (event, _details, authInfo, callback) => {
      event.preventDefault();
      this.askAuth(this.windowFromContents(wc) || win, authInfo.host, callback);
    });
    wc.on('context-menu', (_event, params) => this.pageMenu(wc, params));
    wc.on('found-in-page', (_event, result) => {
      const host = this.windowFromContents(wc);
      if (host?.find && !host.find.isDestroyed()) {
        host.find.webContents.send('cove:overlay', { mode: 'find', active: result.activeMatchOrdinal, total: result.matches });
      }
    });
    wc.on('zoom-changed', () => {
      const hostName = hostOf(wc.getURL());
      if (hostName) this.store.library.settings.siteZoom[hostName] = wc.getZoomFactor();
      this.refresh();
    });
  }

  private afterNavigate(item: Item, url: string): void {
    if (!url || url.startsWith('cove://app/error')) return;
    item.url = url;
    item.lastActiveAt = Date.now();
    const hostWin = [...this.windows.values()].find((win) => win.incognito && this.owner.get(item.id) === win.id);
    if (isWebUrl(url) && !item.ephemeral && !hostWin) {
      this.store.addHistory({ id: uid(), url, title: item.customTitle || item.title, at: Date.now(), profileId: item.profileId });
    }
    this.store.touch();
    this.refresh();
  }

  private async applyBoosts(wc: WebContents, url: string): Promise<void> {
    if (!isWebUrl(url) || wc.isDestroyed()) return;
    const host = hostOf(url);
    for (const boost of this.store.library.boosts) {
      if (!boost.enabled || !hostMatches(host, boost.host)) continue;
      if (boost.css) await wc.insertCSS(boost.css).catch(() => undefined);
      if (boost.js && (this.store.library.settings.boostJs || this.store.library.settings.developerMode)) {
        await wc.executeJavaScript(boost.js).catch(() => undefined);
      }
    }
  }

  private applyZoom(wc: WebContents, url: string): void {
    const factor = this.store.library.settings.siteZoom[hostOf(url)];
    if (factor && !wc.isDestroyed()) wc.setZoomFactor(factor);
  }

  private attach(live: Live, win: Win): void {
    if (live.windowId === win.id) return;
    if (live.windowId != null) {
      const previous = this.windows.get(live.windowId);
      if (previous && !previous.win.isDestroyed()) {
        try {
          previous.win.contentView.removeChildView(live.view);
        } catch {
          /* view already detached */
        }
        if (previous.activeTabId && this.views.get(previous.activeTabId)?.windowId === win.id) {
          previous.activeTabId = this.visibleItems(previous).find((item) => item.id !== previous.activeTabId)?.id || null;
        }
      }
    }
    win.win.contentView.addChildView(live.view);
    live.windowId = win.id;
  }

  private prepareSession(partition: string): void {
    if (!partition || this.sessionsReady.has(partition)) return;
    this.sessionsReady.add(partition);
    const ses = session.fromPartition(partition);
    handleCoveProtocol(__dirname, this.faviconDir, ses);
    ses.setUserAgent(this.ua);
    try {
      ses.setSpellCheckerLanguages(['en-US']);
    } catch {
      /* dictionary may be absent */
    }
    ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      const settings = this.store.library.settings;
      if (!settings.adBlock || details.resourceType === 'mainFrame') {
        callback({});
        return;
      }
      callback(isAdUrl(details.url, settings.blockedHosts) ? { cancel: true } : {});
    });
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders };
      const settings = this.store.library.settings;
      if (settings.doNotTrack) headers.DNT = '1';
      if (settings.blockThirdPartyCookies && details.resourceType !== 'mainFrame') {
        try {
          const requestHost = new URL(details.url).hostname;
          const pageHost = details.referrer ? new URL(details.referrer).hostname : requestHost;
          if (requestHost !== pageHost) delete headers.Cookie;
        } catch {
          /* ignore malformed referrers */
        }
      }
      callback({ requestHeaders: headers });
    });
    ses.setPermissionRequestHandler((wc, permission, callback, details) => {
      const origin = originOf(details.requestingUrl || wc.getURL());
      const saved = this.store.library.settings.permissions[origin]?.[permission];
      if (saved === 'allow') return callback(true);
      if (saved === 'deny') return callback(false);
      const ask = new Set(['media', 'geolocation', 'notifications', 'clipboard-sanitized-write', 'pointerLock', 'fullscreen']);
      if (!ask.has(permission)) return callback(permission === 'clipboard-sanitized-write');
      const win = this.windowFromContents(wc) || this.focused();
      void dialog
        .showMessageBox(win?.win || BrowserWindow.getFocusedWindow() || undefined, {
          type: 'question',
          message: `${hostOf(origin) || 'This site'} wants to use ${permission}`,
          buttons: ['Block', 'Allow'],
          defaultId: 0,
          cancelId: 0,
        })
        .then((choice) => {
          const allow = choice.response === 1;
          const record = this.store.library.settings.permissions[origin] || {};
          record[permission] = allow ? 'allow' : 'deny';
          this.store.library.settings.permissions[origin] = record;
          this.store.touch();
          callback(allow);
        });
    });
    ses.on('will-download', (_event, item, wc) => {
      const host = this.windowFromContents(wc);
      const incognito = !!host?.incognito;
      const dir = this.store.library.settings.downloadDir || app.getPath('downloads');
      mkdirSync(dir, { recursive: true });
      const filename = item.getFilename();
      const id = uid();
      const record: DownloadRec = {
        id,
        filename,
        url: item.getURL(),
        savePath: join(dir, filename),
        state: 'progressing',
        received: 0,
        total: item.getTotalBytes(),
        at: Date.now(),
        ephemeral: incognito,
        onShelf: true,
      };
      if (this.store.library.settings.askWhereToSave && host) {
        const picked = dialog.showSaveDialogSync(host.win, { defaultPath: record.savePath });
        if (!picked) {
          item.cancel();
          return;
        }
        record.savePath = picked;
        record.filename = picked.split('/').pop() || filename;
      }
      item.setSavePath(record.savePath);
      this.store.library.downloads.unshift(record);
      item.on('updated', () => {
        record.received = item.getReceivedBytes();
        record.total = item.getTotalBytes();
        record.state = item.isPaused() ? 'interrupted' : 'progressing';
        this.refresh();
      });
      item.once('done', (_done, state) => {
        record.state = state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted';
        record.received = item.getReceivedBytes();
        if (state === 'completed' && Notification.isSupported()) {
          new Notification({ title: 'Download complete', body: record.filename }).show();
        }
        this.store.touch();
        this.refresh();
      });
      (item as Electron.DownloadItem & { coveId?: string }).coveId = id;
      this.activeDownloads.set(id, item);
    });
    for (const dir of this.store.library.settings.extensionDirs || []) {
      if (existsSync(dir)) void ses.loadExtension(dir).catch(() => undefined);
    }
  }

  private activeDownloads = new Map<string, Electron.DownloadItem>();

  private async apply(action: Action, win: Win, sender?: WebContents): Promise<unknown> {
    switch (action.type) {
      case 'activate-tab':
        return this.activate(win, action.id);
      case 'activate-space':
        return this.activateSpace(win, action.id);
      case 'close-tab':
        return this.closeTab(win, action.id);
      case 'commit-omnibox':
        return this.commitOmnibox(win, action.query, action.target, sender);
      case 'back':
        return this.leafWeb(win)?.navigationHistory.goBack();
      case 'forward':
        return this.leafWeb(win)?.navigationHistory.goForward();
      case 'reload':
        return action.hard ? this.leafWeb(win)?.reloadIgnoringCache() : this.leafWeb(win)?.reload();
      case 'pin':
        return this.pin(this.resolve(win, action.id), true);
      case 'unpin':
        return this.pin(this.resolve(win, action.id), false);
      case 'favorite':
        return this.favorite(win, this.resolve(win, action.id));
      case 'archive-tab':
        return this.archiveItem(win, this.resolve(win, action.id));
      case 'restore-tab':
        return this.restore(win, action.id);
      case 'delete-item':
        return this.removeItem(this.item(action.id), true);
      case 'clear-today':
        return this.clearToday(win);
      case 'reopen':
        return this.reopen(win);
      case 'copy-url':
        return this.copyUrl(win, !!action.markdown);
      case 'rename-item': {
        const item = action.id ? this.item(action.id) : this.leaf(win);
        if (!item) return null;
        if (!action.title) {
          this.pendingRename = item.id;
          return { rename: item.id };
        }
        item.customTitle = action.title;
        item.title = action.title;
        this.pendingRename = null;
        return null;
      }
      case 'reset-pin': {
        const item = this.resolve(win, action.id);
        if (item?.pinnedUrl) this.navigate(win, item, item.pinnedUrl);
        return null;
      }
      case 'replace-pin': {
        const item = this.resolve(win, action.id);
        if (item) item.pinnedUrl = item.url;
        return null;
      }
      case 'duplicate': {
        const item = this.resolve(win, action.id);
        if (item?.url) this.openUrl(win, item.url, 'today');
        return null;
      }
      case 'move-tab': {
        const item = action.id ? this.item(action.id) : this.leaf(win);
        const space = this.space(action.spaceId);
        if (!item || !space) return null;
        this.detach(item);
        item.spaceId = space.id;
        item.profileId = space.profileId;
        item.section = action.section || item.section;
        item.parentId = null;
        item.order = this.nextOrder(space.id, item.section);
        return this.activate(win, item.id);
      }
      case 'reorder':
        return this.reorder(action.id, action.beforeId, action.parentId, action.section);
      case 'split-drop':
        return this.addSplit(win, action.orientation, this.item(action.ontoId), this.item(action.id));
      case 'new-folder':
        return this.makeItem(this.space(win.spaceId), {
          kind: 'folder',
          section: 'pinned',
          title: action.name || 'Folder',
        });
      case 'toggle-folder': {
        const folder = this.item(action.id);
        if (folder?.kind === 'folder') folder.collapsed = !folder.collapsed;
        return null;
      }
      case 'delete-folder': {
        const folder = this.item(action.id);
        if (!folder || folder.kind !== 'folder') return null;
        for (const child of this.children(folder)) {
          child.parentId = null;
          child.order = this.nextOrder(child.spaceId, child.section);
        }
        return this.removeItem(folder, false);
      }
      case 'new-space':
        return this.createSpace();
      case 'update-space':
        return this.updateSpace(action);
      case 'delete-space':
        return this.deleteSpace(win, action.id);
      case 'duplicate-space':
        return this.duplicateSpace(action.id);
      case 'reorder-spaces':
        return this.reorderSpaces(action.id, action.beforeId);
      case 'add-split':
        return this.addSplit(win, action.orientation, this.leaf(win), action.tabId ? this.item(action.tabId) : null, action.url);
      case 'close-split-pane':
        return this.closeSplitPane(win, false);
      case 'expand-split':
        return this.closeSplitPane(win, true);
      case 'focus-split-index':
        return this.focusPane(win, action.index);
      case 'set-split-weights': {
        const split = this.item(action.id);
        if (split?.kind === 'split') split.splitWeights = normalize(action.weights);
        return null;
      }
      case 'divider-drag':
        return this.dragDivider(win, action.id, action.index, action.delta);
      case 'toggle-split-orientation': {
        const split = this.activeSplit(win);
        if (split) split.splitOrientation = split.splitOrientation === 'horizontal' ? 'vertical' : 'horizontal';
        return null;
      }
      case 'new-note':
        return this.createDocument(win, 'note', !!action.split);
      case 'new-easel':
        return this.createDocument(win, 'easel', false);
      case 'update-note': {
        const note = this.item(action.id);
        if (!note) return null;
        if (typeof action.body === 'string') note.noteBody = action.body;
        if (action.title) {
          note.title = action.title;
          note.customTitle = action.title;
        }
        return null;
      }
      case 'update-easel': {
        const easel = this.item(action.id);
        if (easel) easel.easel = action.doc;
        return null;
      }
      case 'toggle-sidebar':
        this.store.library.settings.sidebarVisible = !this.store.library.settings.sidebarVisible;
        win.peeking = false;
        return null;
      case 'sidebar-peek':
        if (!this.store.library.settings.sidebarVisible) win.peeking = action.on;
        return null;
      case 'set-sidebar-width':
        this.store.library.settings.sidebarWidth = clamp(action.width, 260, 420);
        return null;
      case 'open-command':
        return this.openCommand(win, action.mode || 'new');
      case 'close-overlay':
        this.closeCommand(win);
        this.closeFind(win);
        this.hideOverlay(win.site);
        this.hideOverlay(win.preview);
        return null;
      case 'little-arc':
        return this.openLittle(action.url || this.leaf(win)?.url || 'cove://app/newtab');
      case 'open-in-cove':
        return this.openLittleInCove(win);
      case 'new-window': {
        const created = this.createWindow('main', { blank: action.blank });
        if (!action.blank) this.ensureStart(created);
        return null;
      }
      case 'incognito': {
        const created = this.createWindow('main', { incognito: true });
        this.openUrl(created, 'cove://app/newtab', 'today');
        return null;
      }
      case 'close-window':
        win.win.close();
        return null;
      case 'find-open':
        return this.openFind(win);
      case 'find':
        return this.find(win, action.text, action.forward !== false);
      case 'find-close':
        return this.closeFind(win);
      case 'zoom':
        return this.zoom(win, action.dir);
      case 'capture':
        return this.capture(win, !!action.full, sender);
      case 'translate':
        return this.translate(win);
      case 'print':
        this.leafWeb(win)?.print();
        return null;
      case 'devtools':
        this.leafWeb(win)?.toggleDevTools();
        return null;
      case 'mute':
        return this.mute(this.resolve(win, action.id));
      case 'media':
        return this.media(win, action.op);
      case 'toggle-live': {
        const item = this.resolve(win, action.id);
        if (item) item.live = !item.live;
        return null;
      }
      case 'update-membership':
        Object.assign(this.store.library.membership, action.patch);
        return this.store.library.membership;
      case 'update-settings':
        Object.assign(this.store.library.settings, action.patch);
        if (action.patch.littleOnTop != null) this.applyLittleOnTop();
        this.rebuildKeys();
        return null;
      case 'set-binding':
        this.store.library.settings.keybindings[action.command] = action.accelerator;
        for (const [id, accel] of Object.entries(this.store.library.settings.keybindings)) {
          if (id !== action.command && accel && accel === action.accelerator) this.store.library.settings.keybindings[id] = '';
        }
        this.rebuildKeys();
        return null;
      case 'reset-shortcuts':
        this.store.library.settings.keybindings = {};
        this.rebuildKeys();
        return null;
      case 'import-arc':
        return this.doImportArc(win);
      case 'export-library':
        return this.exportLibrary(win);
      case 'import-library':
        return this.importLibrary(win);
      case 'import-bookmarks':
        return this.importBookmarks(win);
      case 'import-passwords':
        return this.importPasswords(win);
      case 'export-passwords':
        return this.exportPasswords(win);
      case 'delete-password':
        this.store.deletePassword(action.id);
        return null;
      case 'fill-password':
        return this.fillPassword(win, action.id);
      case 'save-pending-password': {
        const pending = this.passwordPending.get(action.id);
        if (pending) this.store.savePassword(pending.origin, pending.username, pending.password);
        this.passwordPending.delete(action.id);
        this.hideOverlay(win.password);
        return null;
      }
      case 'dismiss-password': {
        const pending = this.passwordPending.get(action.id);
        if (action.never && pending) this.store.library.settings.passwordNever.push(pending.origin);
        this.passwordPending.delete(action.id);
        this.hideOverlay(win.password);
        return null;
      }
      case 'load-extension':
        return this.loadExtension(win);
      case 'remove-extension':
        return this.removeExtension(win, action.id);
      case 'set-permission': {
        const record = this.store.library.settings.permissions[action.origin] || {};
        record[action.perm] = action.value;
        this.store.library.settings.permissions[action.origin] = record;
        return null;
      }
      case 'clear-site-data':
        return this.clearSite(win, action.origin);
      case 'save-boost':
        return this.saveBoost(action.boost);
      case 'delete-boost':
        this.store.library.boosts = this.store.library.boosts.filter((boost) => boost.id !== action.id);
        return null;
      case 'open-page':
        return this.openPage(win, action.page, sender);
      case 'peek':
        return this.openPeek(win, action.url);
      case 'preview-tab':
        return this.showPreview(win, action.id, action.x, action.y);
      case 'hide-preview':
        this.hideOverlay(win.preview);
        return null;
      case 'download-action':
        return this.downloadAction(action.id, action.op);
      case 'new-profile': {
        const profile = { id: uid(), name: action.name || 'Profile', partition: `persist:cove-${uid().slice(0, 8)}` };
        this.store.library.profiles.push(profile);
        return profile;
      }
      case 'delete-profile':
        return this.deleteProfile(action.id);
      case 'go-tab-index':
        return this.goLeaf(win, action.index);
      case 'focus-space-index':
        return this.focusSpaceIndex(win, action.index);
      case 'cycle-tab':
        return this.cycleTab(win, action.delta);
      case 'commit-switcher':
        return this.commitSwitcher();
      case 'cancel-switcher':
        this.switcher = null;
        this.hideOverlay(win.switcher);
        return null;
      case 'cycle-space':
        return this.cycleSpace(win, action.delta);
      case 'cycle-sidebar':
        return this.cycleSidebar(win, action.delta);
      case 'home':
        return this.openPage(win, 'newtab', sender);
      case 'select-download-folder':
        return this.pickFolder(win, 'downloadDir');
      case 'select-sync-folder':
        return this.pickFolder(win, 'syncFolder');
      case 'clear-sync-folder':
        this.store.library.settings.syncFolder = null;
        return null;
      case 'sync-now':
        this.store.pullSync();
        this.store.flush();
        return null;
      case 'block-domain':
        if (action.host && !this.store.library.settings.blockedHosts.includes(action.host)) {
          this.store.library.settings.blockedHosts.push(action.host);
        }
        return null;
      case 'unblock-domain':
        this.store.library.settings.blockedHosts = this.store.library.settings.blockedHosts.filter((host) => host !== action.host);
        return null;
      case 'clear-history':
        this.store.history = [];
        return null;
      case 'clear-cache':
        return this.profileSession(win).clearCache();
      case 'clear-cookies':
        return this.profileSession(win).clearStorageData({ storages: ['cookies'] });
      case 'make-default-browser':
        app.setAsDefaultProtocolClient('http');
        app.setAsDefaultProtocolClient('https');
        await shell.openExternal('x-apple.systempreferences:com.apple.Desktop-Settings.extension').catch(() => undefined);
        return null;
      case 'open-file':
        return this.openFile(win);
      case 'join-call':
        return this.joinCall(win);
      case 'menu-tab':
        return this.tabMenu(win, action.id);
      case 'menu-space':
        this.editSpaceId = action.id;
        return null;
      case 'open-site-panel':
        return this.openSite(win);
      case 'auth-reply':
        this.authPending?.(action.cancel ? '' : action.username, action.cancel ? '' : action.password);
        this.authPending = null;
        this.hideOverlay(win.auth);
        return null;
      case 'allow-insecure': {
        const leaf = this.leaf(win);
        if (!leaf) return null;
        this.allowHttp.add(leaf.id);
        const errorUrl = this.leafWeb(win)?.getURL() || '';
        try {
          const original = new URL(errorUrl).searchParams.get('url');
          if (original) this.navigate(win, leaf, original);
        } catch {
          /* the error page did not include a url */
        }
        return null;
      }
      case 'library-query':
        return this.libraryRows(action.section, action.query, action.offset);
      case 'quit':
        app.quit();
        return null;
      default:
        return null;
    }
  }

  private get faviconDir(): string {
    return join(app.getPath('userData'), 'favicons');
  }

  private get thumbDir(): string {
    return join(app.getPath('userData'), 'thumbs');
  }

  private rebuildKeys(): void {
    this.keys = bindingMap(this.store.library.settings.keybindings);
  }

  private windowFromContents(wc: WebContents): Win | null {
    for (const candidate of this.windows.values()) {
      if (!candidate.shell.webContents.isDestroyed() && candidate.shell.webContents.id === wc.id) return candidate;
    }
    const host = BrowserWindow.fromWebContents(wc);
    if (host) {
      const direct = this.windows.get(host.id);
      if (direct) return direct;
      const parent = host.getParentWindow();
      if (parent && this.windows.get(parent.id)) return this.windows.get(parent.id) || null;
    }
    for (const [id, live] of this.views) {
      if (!live.view.webContents.isDestroyed() && live.view.webContents.id === wc.id) {
        return (live.windowId && this.windows.get(live.windowId)) || this.focused();
      }
    }
    return null;
  }

  private windowFromEvent(sender: WebContents): Win | null {
    return this.windowFromContents(sender) || this.focused();
  }

  private bindKeys(wc: WebContents, win: Win): void {
    wc.on('before-input-event', (event, input) => {
      if (this.handleKey(win, input)) event.preventDefault();
    });
  }

  private handleKey(win: Win, input: Electron.Input): boolean {
    if (input.type === 'keyUp' && /^control/i.test(input.key)) {
      if (this.switcher?.windowId === win.id) void this.dispatch({ type: 'commit-switcher' }, win);
      return false;
    }
    if (input.type !== 'keyDown') return false;
    if (!input.meta && !input.control && !input.alt && normalizeKey(input.key) === 'escape') {
      if (win.command?.isVisible()) {
        this.closeCommand(win);
        return true;
      }
      if (win.find?.isVisible()) {
        this.closeFind(win);
        return true;
      }
      if (this.switcher) {
        this.switcher = null;
        this.hideOverlay(win.switcher);
        return true;
      }
      if (win.mode !== 'main') {
        win.win.close();
        return true;
      }
      return false;
    }
    if (input.meta && !input.control && !input.alt && (input.key === '=' || input.key === '+')) {
      void this.dispatch({ type: 'zoom', dir: 'in' }, win);
      return true;
    }
    if (input.meta && !input.control && !input.alt && !input.shift && input.key === '-') {
      void this.dispatch({ type: 'zoom', dir: 'out' }, win);
      return true;
    }
    if (input.meta && !input.control && !input.alt && input.key === '0') {
      void this.dispatch({ type: 'zoom', dir: 'reset' }, win);
      return true;
    }
    const id = this.keys.get(keyToken(input));
    if (!id) return false;
    if (input.isAutoRepeat && !['next-tab', 'prev-tab', 'next-sidebar', 'prev-sidebar'].includes(id)) return false;
    if ((id === 'open-command' || id === 'edit-url') && win.command?.isVisible() && id === 'open-command') {
      this.closeCommand(win);
      return true;
    }
    void this.dispatch(commandAction(id), win);
    return true;
  }

  private spaces(): Space[] {
    return [...this.store.library.spaces].sort((a, b) => a.order - b.order);
  }

  private space(id: string | null | undefined): Space | null {
    return this.store.library.items && id ? this.store.library.spaces.find((space) => space.id === id) || null : this.spaces()[0] || null;
  }

  private item(id: string | null | undefined): Item | null {
    if (!id) return null;
    return this.store.library.items.find((entry) => entry.id === id) || null;
  }

  private profile(id: string) {
    return this.store.library.profiles.find((entry) => entry.id === id) || this.store.library.profiles[0];
  }

  private children(item: Item): Item[] {
    return item.children.map((id) => this.item(id)).filter((child): child is Item => !!child);
  }

  private leaf(win: Win): Item | null {
    const active = this.item(win.activeTabId);
    if (!active) return null;
    if (active.kind === 'split') {
      const focus = this.children(active).find((child) => child.id === this.splitFocus.get(active.id)) || this.children(active)[0];
      return focus || null;
    }
    return active.kind === 'folder' ? null : active;
  }

  private splitFocus = new Map<string, string>();

  private leafWeb(win: Win): WebContents | null {
    const leaf = this.leaf(win);
    const live = leaf ? this.views.get(leaf.id) : null;
    if (!live || live.view.webContents.isDestroyed()) return null;
    return live.view.webContents;
  }

  private resolve(win: Win, id?: string): Item | null {
    return id ? this.item(id) : this.leaf(win);
  }

  private makeItem(space: Space | null, partial: Partial<Item> & Pick<Item, 'kind' | 'section' | 'title'>): Item {
    const home = space || this.spaces()[0];
    const item: Item = {
      id: uid(),
      kind: partial.kind,
      spaceId: partial.spaceId || home?.id || '',
      profileId: partial.profileId || home?.profileId || this.store.library.profiles[0].id,
      parentId: partial.parentId ?? null,
      section: partial.section,
      title: partial.title,
      customTitle: partial.customTitle || '',
      url: partial.url || '',
      pinnedUrl: partial.pinnedUrl || '',
      favicon: partial.favicon || '',
      children: partial.children || [],
      collapsed: false,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      archivedAt: null,
      muted: false,
      unread: false,
      ephemeral: !!partial.ephemeral,
      live: false,
      order: partial.order ?? this.nextOrder(partial.spaceId || home?.id || '', partial.section),
      splitOrientation: partial.splitOrientation || 'horizontal',
      splitWeights: partial.splitWeights || [],
      noteBody: partial.noteBody || '',
      easel: partial.easel || null,
      sourceId: '',
    };
    this.store.library.items.push(item);
    return item;
  }

  private nextOrder(spaceId: string, section: Section): number {
    const orders = this.store.library.items.filter((item) => item.spaceId === spaceId && item.section === section).map((item) => item.order);
    return orders.length ? Math.max(...orders) + 1 : 0;
  }

  private openUrl(win: Win, url: string, section: Section): Item {
    const space = this.space(win.spaceId) || this.spaces()[0];
    const item = this.makeItem(space, {
      kind: 'tab',
      section: win.incognito || win.mode !== 'main' ? 'today' : section,
      title: hostOf(url) || 'New tab',
      url,
      ephemeral: win.incognito || win.mode !== 'main',
      profileId: space?.profileId,
    });
    if (item.ephemeral) this.owner.set(item.id, win.id);
    if (this.store.library.settings.soundEffects) this.sound += 1;
    this.activate(win, item.id);
    return item;
  }

  private navigate(win: Win, item: Item, url: string): void {
    item.url = url;
    item.lastActiveAt = Date.now();
    const live = this.ensureView(item, win);
    this.attach(live, win);
    void live.view.webContents.loadURL(this.prepareUrl(item, url));
    this.activate(win, item.parentId && this.item(item.parentId)?.kind === 'split' ? item.parentId : item.id);
  }

  private prepareUrl(item: Item, url: string): string {
    if (url.startsWith('http://') && this.store.library.settings.httpsOnly && !this.allowHttp.has(item.id)) {
      return `https://${url.slice('http://'.length)}`;
    }
    return url || 'cove://app/newtab';
  }

  private activate(win: Win, id: string): void {
    const item = this.item(id);
    if (!item) return;
    if (item.kind === 'folder') {
      item.collapsed = false;
      const first = this.children(item)[0];
      if (first) this.activate(win, first.id);
      return;
    }
    const parent = item.parentId ? this.item(item.parentId) : null;
    if (parent?.kind === 'split') {
      win.activeTabId = parent.id;
      this.splitFocus.set(parent.id, item.id);
    } else {
      win.activeTabId = item.id;
    }
    if (item.spaceId && !win.incognito && win.mode === 'main') win.spaceId = item.spaceId;
    item.unread = false;
    item.lastActiveAt = Date.now();
    if (item.live) {
      const seen = this.lastReload.get(item.id) || 0;
      if (Date.now() - seen > 5 * 60 * 1000) {
        this.views.get(item.id)?.view.webContents.reload();
        this.lastReload.set(item.id, Date.now());
      }
    }
    this.mru = [item.id, ...this.mru.filter((entry) => entry !== item.id)].slice(0, 30);
    this.touchLru(item.id);
    const title = item.customTitle || item.title;
    if (!win.win.isDestroyed()) win.win.setTitle(title ? `${title} — Cove` : 'Cove');
  }

  private activateSpace(win: Win, id: string): void {
    const space = this.space(id);
    if (!space || win.incognito) return;
    win.spaceId = space.id;
    const current = this.item(win.activeTabId);
    if (!current || current.spaceId !== space.id) {
      const next = this.sectionItems(space.id, 'today')[0] || this.sectionItems(space.id, 'pinned')[0] || this.sectionItems(space.id, 'favorites')[0];
      if (next) this.activate(win, next.kind === 'folder' ? next.children[0] || next.id : next.id);
      else this.openUrl(win, 'cove://app/newtab', 'today');
    }
  }

  private closeTab(win: Win, id?: string): void {
    const item = this.resolve(win, id);
    if (!item) {
      if (win.mode !== 'main') win.win.close();
      return;
    }
    const parent = item.parentId ? this.item(item.parentId) : null;
    if (item.kind === 'split') {
      const focus = this.children(item)[0];
      if (focus) this.closePane(win, item, focus, false);
      return;
    }
    if (parent?.kind === 'split') {
      this.closePane(win, parent, item, false);
      return;
    }
    this.destroyItem(win, item, true);
  }

  private destroyItem(win: Win, item: Item, remember: boolean): void {
    if (remember && !item.ephemeral) {
      const kids = this.children(item);
      this.store.library.closed.unshift({ item: { ...item }, children: kids.map((child) => ({ ...child })), at: Date.now() });
      this.store.library.closed = this.store.library.closed.slice(0, 40);
    }
    this.detach(item);
    this.destroyView(item.id);
    for (const child of this.children(item)) this.destroyItem(win, child, false);
    this.removeItem(item, false);
    if (win.activeTabId === item.id) {
      const next = this.visibleItems(win).find((candidate) => candidate.kind !== 'folder') || null;
      if (next) this.activate(win, next.id);
      else if (win.mode === 'main') this.openUrl(win, 'cove://app/newtab', 'today');
      else win.win.close();
    }
  }

  private removeItem(item: Item | null, destroyView: boolean): void {
    if (!item) return;
    this.detach(item);
    if (destroyView) this.destroyView(item.id);
    this.store.library.items = this.store.library.items.filter((entry) => entry.id !== item.id);
  }

  private detach(item: Item): void {
    if (!item.parentId) return;
    const parent = this.item(item.parentId);
    if (parent) parent.children = parent.children.filter((id) => id !== item.id);
    item.parentId = null;
  }

  private pin(item: Item | null, pinned: boolean): void {
    if (!item || item.kind === 'folder') return;
    this.detach(item);
    item.section = pinned ? 'pinned' : 'today';
    if (pinned && !item.pinnedUrl) item.pinnedUrl = item.url;
    item.order = this.nextOrder(item.spaceId, item.section);
  }

  private favorite(win: Win, item: Item | null): void {
    if (!item) return;
    const space = this.space(item.spaceId) || this.space(win.spaceId);
    this.detach(item);
    item.section = 'favorites';
    item.profileId = space?.profileId || item.profileId;
    item.pinnedUrl = item.pinnedUrl || item.url;
    item.order = this.nextOrder(item.spaceId, 'favorites');
  }

  private archiveItem(win: Win, item: Item | null): void {
    if (!item || item.section === 'archive') return;
    this.detach(item);
    item.section = 'archive';
    item.archivedAt = Date.now();
    this.destroyView(item.id);
    if (win.activeTabId === item.id) this.activateSpace(win, win.spaceId);
  }

  private restore(win: Win, id: string): void {
    const item = this.item(id);
    if (!item) return;
    item.section = 'today';
    item.archivedAt = null;
    item.order = this.nextOrder(item.spaceId, 'today');
    win.spaceId = item.spaceId;
    this.activate(win, item.id);
  }

  private clearToday(win: Win): void {
    const spaceId = win.spaceId;
    for (const item of this.store.library.items.filter((entry) => entry.spaceId === spaceId && entry.section === 'today' && !entry.parentId)) {
      this.archiveItem(win, item);
    }
    if (!this.leaf(win)) this.openUrl(win, 'cove://app/newtab', 'today');
  }

  private reopen(win: Win): void {
    const closed = this.store.library.closed.shift();
    if (!closed) return;
    this.store.library.items.push(closed.item, ...closed.children);
    this.activate(win, closed.item.id);
  }

  private copyUrl(win: Win, markdown: boolean): void {
    const item = this.leaf(win);
    if (!item?.url) return;
    const title = item.customTitle || item.title || item.url;
    clipboard.writeText(markdown ? `[${title}](${item.url})` : item.url);
  }

  private reorder(id: string, beforeId: string | null, parentId: string | null, section: Section): void {
    const item = this.item(id);
    if (!item) return;
    const parent = parentId ? this.item(parentId) : null;
    this.detach(item);
    item.parentId = parent?.kind === 'folder' ? parent.id : null;
    item.section = parent?.kind === 'folder' ? parent.section : section;
    if (parent?.kind === 'folder' && !parent.children.includes(item.id)) parent.children.push(item.id);
    const siblings = this.store.library.items
      .filter((entry) => entry.id !== item.id && entry.section === item.section && entry.spaceId === item.spaceId && entry.parentId === item.parentId)
      .sort((a, b) => a.order - b.order);
    const index = beforeId ? Math.max(0, siblings.findIndex((entry) => entry.id === beforeId)) : siblings.length;
    siblings.splice(index < 0 ? siblings.length : index, 0, item);
    siblings.forEach((entry, order) => {
      entry.order = order;
    });
    if (parent?.kind === 'folder') parent.children = siblings.filter((entry) => entry.parentId === parent.id).map((entry) => entry.id);
  }

  private addSplit(win: Win, orientation: 'horizontal' | 'vertical' | undefined, base: Item | null, extra: Item | null, url?: string): void {
    if (!base) base = this.leaf(win);
    if (!base) return;
    const parent = base.parentId ? this.item(base.parentId) : null;
    let split = parent?.kind === 'split' ? parent : null;
    const incoming = extra || this.makeItem(this.space(base.spaceId), {
      kind: url && !isWebUrl(url) && url.startsWith('cove://app/note') ? 'note' : 'tab',
      section: base.section,
      title: 'Split',
      url: url || 'cove://app/newtab',
      spaceId: base.spaceId,
      profileId: base.profileId,
      ephemeral: base.ephemeral,
    });
    if (incoming.ephemeral) this.owner.set(incoming.id, win.id);
    if (!split) {
      if (base.kind === 'split') split = base;
    }
    if (!split) {
      split = this.makeItem(this.space(base.spaceId), {
        kind: 'split',
        section: base.section,
        title: 'Split',
        spaceId: base.spaceId,
        profileId: base.profileId,
        parentId: base.parentId,
        order: base.order,
        splitOrientation: orientation || 'horizontal',
        ephemeral: base.ephemeral,
      });
      const folder = base.parentId ? this.item(base.parentId) : null;
      if (folder?.kind === 'folder') folder.children = folder.children.map((id) => (id === base!.id ? split!.id : id));
      base.parentId = split.id;
      incoming.parentId = split.id;
      incoming.section = split.section;
      split.children = [base.id, incoming.id];
      split.splitWeights = [0.5, 0.5];
    } else if (!split.children.includes(incoming.id) && split.children.length < 4) {
      this.detach(incoming);
      incoming.parentId = split.id;
      incoming.section = split.section;
      incoming.spaceId = split.spaceId;
      split.children.push(incoming.id);
      split.splitWeights = split.children.map(() => 1 / split.children.length);
      if (orientation) split.splitOrientation = orientation;
    }
    this.splitFocus.set(split.id, incoming.id);
    this.activate(win, split.id);
  }

  private closeSplitPane(win: Win, expand: boolean): void {
    const split = this.activeSplit(win);
    if (!split) return;
    const focus = this.children(split).find((child) => child.id === this.splitFocus.get(split.id)) || this.children(split)[0];
    if (!focus) return;
    if (expand) {
      for (const child of this.children(split)) if (child.id !== focus.id) this.destroyItem(win, child, true);
    }
    this.closePane(win, split, focus, expand);
  }

  private closePane(win: Win, split: Item, pane: Item, keepPane: boolean): void {
    if (!keepPane) {
      split.children = split.children.filter((id) => id !== pane.id);
      this.destroyItem(win, pane, true);
    }
    const rest = this.children(split);
    if (rest.length <= 1) {
      const survivor = rest[0];
      if (survivor) {
        survivor.parentId = split.parentId;
        survivor.section = split.section;
        survivor.order = split.order;
        const folder = split.parentId ? this.item(split.parentId) : null;
        if (folder) folder.children = folder.children.map((id) => (id === split.id ? survivor.id : id));
        win.activeTabId = survivor.id;
      }
      this.removeItem(split, false);
    } else {
      split.splitWeights = rest.map(() => 1 / rest.length);
      this.splitFocus.set(split.id, rest[0].id);
      win.activeTabId = split.id;
    }
  }

  private focusPane(win: Win, index: number): void {
    const split = this.activeSplit(win);
    const pane = split ? this.children(split)[index] : null;
    if (split && pane) {
      this.splitFocus.set(split.id, pane.id);
      this.activate(win, pane.id);
    }
  }

  private dragDivider(win: Win, id: string, index: number, delta: number): void {
    const split = this.item(id);
    if (!split || split.kind !== 'split') return;
    const [width, height] = win.win.getContentSize();
    const span = split.splitOrientation === 'horizontal' ? width : height;
    if (!span) return;
    const weights = normalize(split.splitWeights.length ? split.splitWeights : this.children(split).map(() => 1));
    const shift = delta / span;
    weights[index] = (weights[index] || 0) + shift;
    if (weights[index + 1] != null) weights[index + 1] -= shift;
    split.splitWeights = normalize(weights);
  }

  private createSpace(): Space {
    const space: Space = {
      id: uid(),
      name: `Space ${this.spaces().length + 1}`,
      icon: '✦',
      color: ['#3EBE8A', '#E09A3E', '#D85A78', '#7B6CF0', '#3D8BFF'][this.spaces().length % 5],
      appearance: 'auto',
      profileId: this.store.library.profiles[0].id,
      order: this.spaces().length,
      pinnedCollapsed: false,
      sourceId: '',
    };
    this.store.library.spaces.push(space);
    this.editSpaceId = space.id;
    return space;
  }

  private updateSpace(action: Extract<Action, { type: 'update-space' }>): void {
    const space = this.space(action.id);
    if (!space) return;
    if (action.name != null) space.name = action.name;
    if (action.icon != null) space.icon = action.icon;
    if (action.color != null) space.color = action.color;
    if (action.appearance != null) space.appearance = action.appearance;
    if (action.profileId != null) space.profileId = action.profileId;
    this.editSpaceId = null;
  }

  private deleteSpace(win: Win, id: string): void {
    if (this.spaces().length < 2) return;
    const fallback = this.spaces().find((space) => space.id !== id);
    if (!fallback) return;
    for (const item of this.store.library.items) if (item.spaceId === id) item.spaceId = fallback.id;
    this.store.library.spaces = this.store.library.spaces.filter((space) => space.id !== id);
    if (win.spaceId === id) this.activateSpace(win, fallback.id);
  }

  private duplicateSpace(id: string): Space | null {
    const space = this.space(id);
    if (!space) return null;
    const copy = this.createSpace();
    copy.name = `${space.name} copy`;
    copy.icon = space.icon;
    copy.color = space.color;
    copy.profileId = space.profileId;
    const map = new Map<string, string>();
    for (const item of this.store.library.items.filter((entry) => entry.spaceId === space.id && entry.section === 'pinned')) {
      const clone = this.makeItem(copy, { ...item, title: item.title, section: 'pinned', spaceId: copy.id, parentId: null, children: [] });
      map.set(item.id, clone.id);
    }
    for (const item of this.store.library.items.filter((entry) => entry.spaceId === space.id && entry.section === 'pinned')) {
      const clone = this.item(map.get(item.id) || '');
      if (!clone) continue;
      clone.parentId = item.parentId ? map.get(item.parentId) || null : null;
      clone.children = item.children.map((child) => map.get(child) || '').filter(Boolean);
    }
    return copy;
  }

  private reorderSpaces(id: string, beforeId: string | null): void {
    const spaces = this.spaces().filter((space) => space.id !== id);
    const moving = this.space(id);
    if (!moving) return;
    const index = beforeId ? spaces.findIndex((space) => space.id === beforeId) : spaces.length;
    spaces.splice(index < 0 ? spaces.length : index, 0, moving);
    spaces.forEach((space, order) => {
      space.order = order;
    });
  }

  private createDocument(win: Win, kind: 'note' | 'easel', split: boolean): Item {
    const space = this.space(win.spaceId);
    const item = this.makeItem(space, {
      kind,
      section: 'today',
      title: kind === 'note' ? 'Note' : 'Easel',
      url: '',
      noteBody: kind === 'note' ? '' : '',
      easel: kind === 'easel' ? { strokes: [], texts: [], camera: { x: 0, y: 0, zoom: 1 } } : null,
    });
    item.url = kind === 'note' ? `cove://app/note/${item.id}` : `cove://app/easel/${item.id}`;
    if (split) this.addSplit(win, 'horizontal', this.leaf(win), item);
    else this.activate(win, item.id);
    return item;
  }

  private commitOmnibox(win: Win, query: string, target: 'current' | 'new' | 'little', sender?: WebContents): void {
    const url = resolveQuery(query, this.store.library.settings.searchEngine);
    if (target === 'little') {
      this.openLittle(url);
      return;
    }
    if (target === 'new') {
      this.openUrl(win, url, 'today');
      return;
    }
    const fromSender = sender ? this.itemForContents(sender) : null;
    const leaf = fromSender || this.leaf(win);
    if (!leaf || leaf.kind === 'folder' || leaf.kind === 'split') this.openUrl(win, url, 'today');
    else this.navigate(win, leaf, url);
  }

  private itemForContents(wc: WebContents): Item | null {
    for (const [id, live] of this.views) {
      if (!live.view.webContents.isDestroyed() && live.view.webContents.id === wc.id) return this.item(id);
    }
    return null;
  }

  private openPage(win: Win, page: string, sender?: WebContents): void {
    const url = page.startsWith('cove://') ? page : `cove://app/${page.replace(/^\//, '')}`;
    const current = (sender && this.itemForContents(sender)) || this.leaf(win);
    if (current && /\/(newtab|welcome|error)(\?|$)/.test(current.url)) this.navigate(win, current, url);
    else this.openUrl(win, url, 'today');
  }

  private openLittle(url: string): Win {
    const win = this.createWindow('little');
    const space = this.spaces()[0];
    const item = this.makeItem(space, { kind: 'tab', section: 'today', title: 'Little Cove', url, ephemeral: true });
    this.owner.set(item.id, win.id);
    win.activeTabId = item.id;
    win.spaceId = space?.id || '';
    return win;
  }

  private openLittleInCove(win: Win): void {
    const item = this.leaf(win);
    const main = [...this.windows.values()].find((candidate) => candidate.mode === 'main' && !candidate.incognito) || this.createWindow('main');
    if (item?.url) this.openUrl(main, item.url, 'today');
    if (win.mode !== 'main') win.win.close();
    main.win.show();
    main.win.focus();
  }

  private openPeek(win: Win, url: string): void {
    const safe = safeHttpUrl(url);
    if (!safe) return;
    const peek = this.createWindow('peek', { parent: win });
    const space = this.space(win.spaceId);
    const item = this.makeItem(space, { kind: 'tab', section: 'today', title: 'Peek', url: safe, ephemeral: true });
    this.owner.set(item.id, peek.id);
    peek.activeTabId = item.id;
  }

  private async showPreview(win: Win, id: string, x: number, y: number): Promise<void> {
    if (!this.store.library.settings.previews) return;
    const item = this.item(id);
    if (!item) return;
    const overlay = this.overlay(win, 'preview', 340, 250);
    const image = join(this.thumbDir, `${id}.png`);
    this.position(overlay, win, x + 24, y - 20, 340, 250);
    const send = () => overlay.webContents.send('cove:overlay', {
      mode: 'preview',
      title: item.customTitle || item.title,
      url: item.url,
      image: existsSync(image) ? `file://${image}` : '',
    });
    if (overlay.webContents.isLoading()) overlay.webContents.once('did-finish-load', send);
    else send();
    overlay.show();
  }

  private openCommand(win: Win, mode: 'new' | 'edit'): void {
    const overlay = this.overlay(win, 'command', 680, 460);
    const leaf = this.leaf(win);
    const payload = { mode, query: mode === 'edit' ? leaf?.url || '' : '', select: mode === 'edit' };
    const bounds = win.win.getBounds();
    const side = this.store.library.settings.sidebarVisible ? Math.max(240, this.store.library.settings.sidebarWidth) : 76;
    const width = 560;
    const height = 360;
    overlay.setBounds({
      x: Math.round(bounds.x + side + (bounds.width - side - width) / 2),
      y: bounds.y + 150,
      width,
      height,
    });
    const send = () => overlay.webContents.send('cove:command', payload);
    if (overlay.webContents.isLoading()) overlay.webContents.once('did-finish-load', () => { send(); overlay.show(); overlay.focus(); });
    else { send(); overlay.show(); overlay.focus(); }
    win.command = overlay;
  }

  private closeCommand(win: Win): void {
    this.hideOverlay(win.command);
  }

  private openFind(win: Win): void {
    const overlay = this.overlay(win, 'find', 360, 48);
    const bounds = win.win.getContentBounds();
    overlay.setBounds({ x: bounds.x + bounds.width - 380, y: bounds.y + 12, width: 360, height: 48 });
    const send = () => overlay.webContents.send('cove:overlay', { mode: 'find', query: '', active: 0, total: 0 });
    if (overlay.webContents.isLoading()) overlay.webContents.once('did-finish-load', () => { send(); overlay.show(); overlay.focus(); });
    else { send(); overlay.show(); overlay.focus(); }
    win.find = overlay;
  }

  private find(win: Win, text: string, forward: boolean): void {
    this.leafWeb(win)?.findInPage(text, { forward, findNext: true });
  }

  private closeFind(win: Win): void {
    this.leafWeb(win)?.stopFindInPage('clearSelection');
    this.hideOverlay(win.find);
  }

  private openSite(win: Win): void {
    const leaf = this.leaf(win);
    const overlay = this.overlay(win, 'site', 320, 420);
    const bounds = win.win.getContentBounds();
    const left = 54 + this.store.library.settings.sidebarWidth;
    overlay.setBounds({ x: bounds.x + left + 12, y: bounds.y + 12, width: 320, height: 420 });
    const origin = originOf(leaf?.url || '');
    const payload = {
      mode: 'site',
      host: hostOf(leaf?.url || ''),
      url: leaf?.url || '',
      secure: leaf?.url?.startsWith('https:') ?? null,
      zoom: this.leafWeb(win)?.getZoomFactor() || 1,
      muted: !!leaf?.muted,
      permissions: this.store.library.settings.permissions[origin] || {},
      origin,
      boost: this.store.library.boosts.some((boost) => boost.enabled && hostMatches(hostOf(leaf?.url || ''), boost.host)),
    };
    const send = () => overlay.webContents.send('cove:overlay', payload);
    if (overlay.webContents.isLoading()) overlay.webContents.once('did-finish-load', () => { send(); overlay.show(); });
    else { send(); overlay.show(); }
    win.site = overlay;
  }

  private overlay(win: Win, name: 'command' | 'find' | 'site' | 'preview' | 'password' | 'auth' | 'switcher', width: number, height: number): BrowserWindow {
    const current = win[name];
    if (current && !current.isDestroyed()) return current;
    const overlay = new BrowserWindow({
      parent: win.win,
      width,
      height,
      frame: false,
      transparent: name !== 'command',
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      roundedCorners: true,
      hasShadow: true,
      backgroundColor: name === 'command' ? '#2c2c2e' : '#00000000',
      webPreferences: {
        preload: join(__dirname, 'ui.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const page = name === 'command' ? 'command.html' : 'overlay.html';
    void overlay.loadURL(`cove://app/${page}#${name}`);
    overlay.on('blur', () => {
      setTimeout(() => {
        if (!overlay.isDestroyed() && !overlay.isFocused() && name !== 'password' && name !== 'auth') overlay.hide();
      }, 120);
    });
    win[name] = overlay;
    return overlay;
  }

  private position(overlay: BrowserWindow, win: Win, x: number, y: number, width: number, height: number): void {
    const bounds = win.win.getBounds();
    overlay.setBounds({
      x: Math.round(Math.min(bounds.x + bounds.width - width - 12, Math.max(bounds.x + 80, x))),
      y: Math.round(y),
      width,
      height,
    });
  }

  private hideOverlay(overlay: BrowserWindow | null): void {
    if (overlay && !overlay.isDestroyed()) overlay.hide();
  }

  private zoom(win: Win, dir: 'in' | 'out' | 'reset'): void {
    const wc = this.leafWeb(win);
    if (!wc) return;
    const next = dir === 'reset' ? 1 : dir === 'in' ? Math.min(3, wc.getZoomFactor() + 0.1) : Math.max(0.3, wc.getZoomFactor() - 0.1);
    wc.setZoomFactor(next);
    const host = hostOf(wc.getURL());
    if (host) this.store.library.settings.siteZoom[host] = next;
  }

  private async capture(win: Win, full: boolean, sender?: WebContents): Promise<void> {
    const wc = (sender && !sender.isDestroyed() && isInternalPage(sender.getURL()) ? sender : null) || this.leafWeb(win);
    if (!wc) return;
    let image = await wc.capturePage();
    if (full) {
      try {
        wc.debugger.attach('1.3');
        const shot = await wc.debugger.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        wc.debugger.detach();
        const { nativeImage } = await import('electron');
        image = nativeImage.createFromBuffer(Buffer.from(shot.data, 'base64'));
      } catch {
        if (wc.debugger.isAttached()) wc.debugger.detach();
      }
    }
    clipboard.writeImage(image);
    const file = join(app.getPath('pictures'), `Cove ${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
    writeFileSync(file, image.toPNG());
    if (Notification.isSupported()) new Notification({ title: 'Captured', body: 'Saved to Pictures and copied.' }).show();
  }

  private translate(win: Win): void {
    const url = this.leaf(win)?.url;
    if (!url || !isWebUrl(url)) return;
    const lang = this.store.library.settings.translateTarget || 'en';
    this.openUrl(win, `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(lang)}&u=${encodeURIComponent(url)}`, 'today');
  }

  private mute(item: Item | null): void {
    if (!item) return;
    item.muted = !item.muted;
    const live = this.views.get(item.id);
    if (live && !live.view.webContents.isDestroyed()) live.view.webContents.setAudioMuted(item.muted);
  }

  private async media(win: Win, op: 'toggle' | 'pip'): Promise<void> {
    const wc = this.leafWeb(win);
    if (!wc) return;
    const script = op === 'pip'
      ? `(() => { const v = document.querySelector('video'); if (!v) return false; if (document.pictureInPictureElement) { document.exitPictureInPicture(); return true; } return v.requestPictureInPicture().then(() => true).catch(() => false); })()`
      : `(() => { const m = document.querySelector('video,audio'); if (!m) return false; if (m.paused) m.play(); else m.pause(); return true; })()`;
    await wc.executeJavaScript(script).catch(() => undefined);
  }

  private async doImportArc(win: Win): Promise<unknown> {
    if (this.importsRunning) return null;
    this.importsRunning = true;
    try {
      const data = importArc(homedir());
      this.mergeImport(data);
      this.store.library.settings.didOnboard = true;
      const first = this.spaces()[0];
      if (first && !this.space(win.spaceId)) this.activateSpace(win, first.id);
      if (process.env.COVE_SMOKE) return data.report;
      await dialog.showMessageBox(win.win, {
        message: 'Imported from Arc',
        detail: `${data.report.spaces} spaces, ${data.report.pinned} pinned tabs, ${data.report.favorites} favorites, ${data.report.today} today tabs, ${data.report.archive} archived, ${data.report.history} history entries. Cookies stay in Arc, so sites will ask you to sign in again. Export passwords from Arc and import the CSV before December 22.`,
      });
      return data.report;
    } finally {
      this.importsRunning = false;
    }
  }

  private mergeImport(data: ReturnType<typeof importArc>): void {
    const fresh = this.store.library.spaces.length <= 1 && this.store.library.items.length === 0;
    if (fresh) this.store.library.spaces = [];
    const profileIds = new Map<string, string>();
    for (const profile of data.profiles) {
      const existing = this.store.library.profiles.find((entry) => entry.name === profile.name);
      if (existing) profileIds.set(profile.id, existing.id);
      else {
        this.store.library.profiles.push(profile);
        profileIds.set(profile.id, profile.id);
      }
    }
    const spaceIds = new Map<string, string>();
    for (const space of data.spaces) {
      const existing = this.store.library.spaces.find((entry) => entry.sourceId && entry.sourceId === space.sourceId);
      space.profileId = profileIds.get(space.profileId) || space.profileId;
      if (existing) spaceIds.set(space.id, existing.id);
      else {
        this.store.library.spaces.push(space);
        spaceIds.set(space.id, space.id);
      }
    }
    const itemIds = new Map<string, string>();
    const added: Item[] = [];
    for (const item of data.items) {
      const existing = item.sourceId ? this.store.library.items.find((entry) => entry.sourceId === item.sourceId) : null;
      if (existing) {
        itemIds.set(item.id, existing.id);
        continue;
      }
      item.spaceId = spaceIds.get(item.spaceId) || item.spaceId;
      item.profileId = profileIds.get(item.profileId) || item.profileId;
      this.store.library.items.push(item);
      itemIds.set(item.id, item.id);
      added.push(item);
    }
    for (const item of added) {
      item.parentId = item.parentId ? itemIds.get(item.parentId) || null : null;
      item.children = item.children.map((id) => itemIds.get(id) || '').filter(Boolean);
    }
    const seen = new Set(this.store.history.map((entry) => entry.url));
    for (const entry of data.history) {
      if (seen.has(entry.url)) continue;
      entry.profileId = profileIds.get(entry.profileId) || entry.profileId;
      this.store.history.push(entry);
    }
    this.store.history.sort((a, b) => b.at - a.at);
    if (!this.store.library.ui.lastSpaceId) this.store.library.ui.lastSpaceId = this.spaces()[0]?.id || '';
  }

  private async exportLibrary(win: Win): Promise<void> {
    const picked = await dialog.showSaveDialog(win.win, { defaultPath: 'Cove Library.json' });
    if (!picked.filePath) return;
    writeFileSync(picked.filePath, JSON.stringify({ library: this.store.library, history: this.store.history }));
  }

  private async importLibrary(win: Win): Promise<void> {
    const picked = await dialog.showOpenDialog(win.win, { filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
    if (!picked.filePaths[0]) return;
    const parsed = JSON.parse(readFileSync(picked.filePaths[0], 'utf8'));
    const incoming = parsed.library || parsed;
    if (Array.isArray(incoming.spaces)) {
      for (const space of incoming.spaces) if (!this.store.library.spaces.some((entry) => entry.id === space.id)) this.store.library.spaces.push(space);
    }
    if (Array.isArray(incoming.items)) {
      for (const item of incoming.items) if (!this.store.library.items.some((entry) => entry.id === item.id)) this.store.library.items.push(item);
    }
    if (Array.isArray(parsed.history)) this.store.history.push(...parsed.history);
  }

  private async importBookmarks(win: Win): Promise<void> {
    const picked = await dialog.showOpenDialog(win.win, { filters: [{ name: 'HTML', extensions: ['html'] }], properties: ['openFile'] });
    if (!picked.filePaths[0]) return;
    const html = readFileSync(picked.filePaths[0], 'utf8');
    const space = this.space(win.spaceId);
    const folder = this.makeItem(space, { kind: 'folder', section: 'pinned', title: 'Imported bookmarks' });
    const matcher = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = matcher.exec(html))) {
      const url = match[1];
      if (!/^https?:/i.test(url)) continue;
      const title = match[2].replace(/<[^>]+>/g, '') || hostOf(url);
      const tab = this.makeItem(space, { kind: 'tab', section: 'pinned', title, url, pinnedUrl: url, parentId: folder.id });
      folder.children.push(tab.id);
      count += 1;
    }
    await dialog.showMessageBox(win.win, { message: `Imported ${count} bookmarks` });
  }

  private async importPasswords(win: Win): Promise<void> {
    const picked = await dialog.showOpenDialog(win.win, { filters: [{ name: 'CSV', extensions: ['csv'] }], properties: ['openFile'] });
    if (!picked.filePaths[0]) return;
    const rows = parseCsv(readFileSync(picked.filePaths[0], 'utf8'));
    const header = rows.shift()?.map((cell) => cell.toLowerCase()) || [];
    const urlIndex = header.indexOf('url');
    const userIndex = header.findIndex((cell) => cell.includes('user'));
    const passIndex = header.findIndex((cell) => cell.includes('pass'));
    const parsed = rows.map((row) => ({
      origin: originOf(row[urlIndex] || row[0] || '') || row[urlIndex] || '',
      username: row[userIndex] || '',
      password: row[passIndex] || '',
    }));
    const count = this.store.importPasswordRows(parsed);
    await dialog.showMessageBox(win.win, { message: `Saved ${count} passwords to the keychain` });
  }

  private async exportPasswords(win: Win): Promise<void> {
    const confirm = await dialog.showMessageBox(win.win, {
      message: 'Export passwords as a CSV?',
      detail: 'The file will contain passwords in plain text. Keep it private.',
      buttons: ['Cancel', 'Export'],
      defaultId: 0,
      cancelId: 0,
    });
    if (confirm.response !== 1) return;
    const picked = await dialog.showSaveDialog(win.win, { defaultPath: 'Cove Passwords.csv' });
    if (!picked.filePath) return;
    const lines = ['url,username,password'];
    for (const row of this.store.exportPasswordRows()) {
      lines.push([row.origin, row.username, row.password].map(csvEscape).join(','));
    }
    writeFileSync(picked.filePath, lines.join('\n'));
  }

  private async fillPassword(win: Win, id: string): Promise<void> {
    const secret = this.store.revealPassword(id);
    const wc = this.lastWeb() || this.leafWeb(win);
    if (!secret || !wc) return;
    const username = JSON.stringify(secret.username);
    const password = JSON.stringify(secret.password);
    await wc.executeJavaScript(`(() => {
      const pass = document.querySelector('input[type="password"]');
      if (!pass) return false;
      const inputs = [...document.querySelectorAll('input')];
      const user = inputs.find((input) => input !== pass && input.type !== 'password' && /email|user|login/i.test(input.name + input.id + input.autocomplete + input.type));
      const set = (el, value) => {
        const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
        proto?.set?.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      if (user) set(user, ${username});
      set(pass, ${password});
      return true;
    })()`).catch(() => undefined);
  }

  private lastWeb(): WebContents | null {
    for (const id of this.mru) {
      const item = this.item(id);
      const live = this.views.get(id);
      if (item && live && isWebUrl(item.url) && !live.view.webContents.isDestroyed()) return live.view.webContents;
    }
    return null;
  }

  private async loadExtension(win: Win): Promise<void> {
    const picked = await dialog.showOpenDialog(win.win, { properties: ['openDirectory'] });
    if (!picked.filePaths[0]) return;
    const dir = picked.filePaths[0];
    await this.profileSession(win).loadExtension(dir);
    if (!this.store.library.settings.extensionDirs.includes(dir)) this.store.library.settings.extensionDirs.push(dir);
  }

  private removeExtension(win: Win, id: string): void {
    const ses = this.profileSession(win);
    const ext = ses.getAllExtensions().find((entry) => entry.id === id);
    ses.removeExtension(id);
    if (ext?.path) this.store.library.settings.extensionDirs = this.store.library.settings.extensionDirs.filter((dir) => dir !== ext.path);
  }

  private async clearSite(win: Win, origin?: string): Promise<void> {
    const target = origin || originOf(this.leaf(win)?.url || '');
    if (!target) return;
    await this.profileSession(win).clearStorageData({ origin: target });
  }

  private saveBoost(boost: { id: string; name: string; host: string; css: string; js: string; enabled: boolean }): void {
    const id = !boost.id || boost.id === 'new' ? uid() : boost.id;
    const existing = this.store.library.boosts.find((entry) => entry.id === id);
    if (existing) Object.assign(existing, boost, { id });
    else this.store.library.boosts.push({ ...boost, id });
  }

  private profileSession(win: Win) {
    if (win.incognito) return session.fromPartition(win.partition);
    const space = this.space(win.spaceId);
    const partition = this.profile(space?.profileId || '')?.partition || this.store.library.profiles[0].partition;
    this.prepareSession(partition);
    return session.fromPartition(partition);
  }

  private async pickFolder(win: Win, key: 'downloadDir' | 'syncFolder'): Promise<void> {
    const picked = await dialog.showOpenDialog(win.win, { properties: ['openDirectory', 'createDirectory'] });
    if (!picked.filePaths[0]) return;
    if (key === 'downloadDir') this.store.library.settings.downloadDir = picked.filePaths[0];
    else this.store.library.settings.syncFolder = picked.filePaths[0];
  }

  private async openFile(win: Win): Promise<void> {
    const picked = await dialog.showOpenDialog(win.win, { properties: ['openFile'] });
    if (picked.filePaths[0]) this.openUrl(win, `file://${picked.filePaths[0]}`, 'today');
  }

  private joinCall(win: Win): void {
    const meeting = this.store.library.items.find((item) => item.section !== 'archive' && MEETING.test(item.url));
    if (meeting) this.activate(win, meeting.parentId && this.item(meeting.parentId)?.kind === 'split' ? meeting.parentId : meeting.id);
  }

  private deleteProfile(id: string): void {
    if (this.store.library.profiles.length < 2) return;
    const fallback = this.store.library.profiles.find((profile) => profile.id !== id);
    if (!fallback) return;
    for (const space of this.store.library.spaces) if (space.profileId === id) space.profileId = fallback.id;
    for (const item of this.store.library.items) if (item.profileId === id) item.profileId = fallback.id;
    this.store.library.profiles = this.store.library.profiles.filter((profile) => profile.id !== id);
  }

  private goLeaf(win: Win, index: number): void {
    const leaves = this.leaves(win);
    const item = index === 8 ? leaves[leaves.length - 1] : leaves[index];
    if (item) this.activate(win, item.id);
  }

  private leaves(win: Win): Item[] {
    const out: Item[] = [];
    const walk = (items: Item[]) => {
      for (const item of items) {
        if (item.kind === 'folder') {
          if (!item.collapsed) walk(this.children(item));
        } else out.push(item);
      }
    };
    const spaceId = win.spaceId;
    walk(this.favorites(spaceId));
    walk(this.sectionItems(spaceId, 'pinned').filter((item) => !item.parentId));
    walk(this.sectionItems(spaceId, 'today').filter((item) => !item.parentId));
    return out.filter((item) => !item.ephemeral || this.owner.get(item.id) === win.id);
  }

  private focusSpaceIndex(win: Win, index: number): void {
    const spaces = this.spaces();
    const space = index === 8 ? spaces[spaces.length - 1] : spaces[index];
    if (space) this.activateSpace(win, space.id);
  }

  private cycleSpace(win: Win, delta: number): void {
    const spaces = this.spaces();
    const index = spaces.findIndex((space) => space.id === win.spaceId);
    const next = spaces[(index + delta + spaces.length) % spaces.length];
    if (next) this.activateSpace(win, next.id);
  }

  private cycleSidebar(win: Win, delta: number): void {
    const leaves = this.leaves(win);
    const current = this.leaf(win)?.id;
    const index = Math.max(0, leaves.findIndex((item) => item.id === current));
    const next = leaves[(index + delta + leaves.length) % leaves.length];
    if (next) this.activate(win, next.id);
  }

  private cycleTab(win: Win, delta: number): void {
    if (!this.switcher || this.switcher.windowId !== win.id) {
      const ids = this.mru.filter((id) => {
        const item = this.item(id);
        return item && item.section !== 'archive' && (!item.ephemeral || this.owner.get(item.id) === win.id);
      });
      const active = this.leaf(win)?.id;
      if (active && !ids.includes(active)) ids.unshift(active);
      this.switcher = { ids, index: 0, windowId: win.id };
    }
    const count = this.switcher.ids.length;
    if (!count) return;
    this.switcher.index = (this.switcher.index + delta + count) % count;
    const overlay = this.overlay(win, 'switcher', 420, 360);
    const bounds = win.win.getBounds();
    overlay.setBounds({ x: Math.round(bounds.x + (bounds.width - 420) / 2), y: bounds.y + 140, width: 420, height: 360 });
    const rows = this.switcher.ids.map((id) => {
      const item = this.item(id);
      return { id, title: item?.customTitle || item?.title || 'Tab', url: item?.url || '', favicon: item?.favicon || '' };
    });
    const payload = { mode: 'switcher', rows, index: this.switcher.index };
    const send = () => overlay.webContents.send('cove:overlay', payload);
    if (overlay.webContents.isLoading()) overlay.webContents.once('did-finish-load', () => { send(); overlay.show(); });
    else { send(); overlay.show(); }
    win.switcher = overlay;
  }

  private commitSwitcher(): void {
    if (!this.switcher) return;
    const { ids, index, windowId } = this.switcher;
    this.switcher = null;
    const win = this.windows.get(windowId);
    if (win) this.hideOverlay(win.switcher);
    const id = ids[index];
    if (win && id) this.activate(win, id);
  }

  private async openSystem(url: string): Promise<void> {
    if (/^(mailto|tel):/i.test(url)) {
      await shell.openExternal(url).catch(() => undefined);
      return;
    }
    const protocol = url.split(':')[0];
    const choice = await dialog.showMessageBox({
      message: `Open this ${protocol} link in another app?`,
      buttons: ['Cancel', 'Open'],
      defaultId: 0,
      cancelId: 0,
    });
    if (choice.response === 1) await shell.openExternal(url).catch(() => undefined);
  }

  private askAuth(win: Win, host: string, callback: (username: string, password: string) => void): void {
    this.authPending = callback;
    const overlay = this.overlay(win, 'auth', 360, 220);
    const bounds = win.win.getBounds();
    overlay.setBounds({ x: Math.round(bounds.x + (bounds.width - 360) / 2), y: bounds.y + 160, width: 360, height: 220 });
    const send = () => overlay.webContents.send('cove:overlay', { mode: 'auth', host });
    if (overlay.webContents.isLoading()) overlay.webContents.once('did-finish-load', () => { send(); overlay.show(); });
    else { send(); overlay.show(); }
    win.auth = overlay;
  }

  private onGuest(sender: WebContents, payload: { type?: string; url?: string; origin?: string; username?: string; password?: string }): void {
    if (!payload || typeof payload !== 'object') return;
    const win = this.windowFromContents(sender) || this.focused();
    if (!win) return;
    if (payload.type === 'peek' && payload.url && safeHttpUrl(payload.url)) {
      let senderOrigin = '';
      try { senderOrigin = new URL(sender.getURL()).origin; } catch { /* ignore */ }
      if (senderOrigin) this.openPeek(win, payload.url);
      return;
    }
    if (payload.type === 'password-form' && payload.origin && payload.password) {
      let senderOrigin = '';
      try { senderOrigin = new URL(sender.getURL()).origin; } catch { return; }
      if (payload.origin !== senderOrigin) return;
      if (this.store.library.settings.passwordNever.includes(payload.origin)) return;
      if (payload.password.length > 2000 || (payload.username || '').length > 2000) return;
      const id = uid();
      this.passwordPending.set(id, { origin: payload.origin, username: payload.username || '', password: payload.password });
      const overlay = this.overlay(win, 'password', 380, 180);
      const bounds = win.win.getBounds();
      overlay.setBounds({ x: Math.round(bounds.x + (bounds.width - 380) / 2), y: bounds.y + 80, width: 380, height: 180 });
      const send = () => overlay.webContents.send('cove:overlay', { mode: 'password', id, origin: payload.origin, username: payload.username || '' });
      if (overlay.webContents.isLoading()) overlay.webContents.once('did-finish-load', () => { send(); overlay.show(); });
      else { send(); overlay.show(); }
      win.password = overlay;
    }
  }

  private tabMenu(win: Win, id: string): void {
    const item = this.item(id);
    if (!item) return;
    const spaces = this.spaces();
    const template: Electron.MenuItemConstructorOptions[] = [
      { label: item.section === 'pinned' ? 'Unpin' : 'Pin', click: () => void this.dispatch({ type: item.section === 'pinned' ? 'unpin' : 'pin', id }, win) },
      { label: 'Favorite', click: () => void this.dispatch({ type: 'favorite', id }, win) },
      { label: 'Rename', click: () => { this.pendingRename = id; this.refresh(); } },
      { label: 'Duplicate', click: () => void this.dispatch({ type: 'duplicate', id }, win) },
      { label: item.muted ? 'Unmute' : 'Mute', click: () => void this.dispatch({ type: 'mute', id }, win) },
      { label: item.live ? 'Stop reloading on return' : 'Reload when I return', click: () => void this.dispatch({ type: 'toggle-live', id }, win) },
      { type: 'separator' },
      { label: 'Move to space', submenu: spaces.map((space) => ({ label: space.name, click: () => void this.dispatch({ type: 'move-tab', id, spaceId: space.id }, win) })) },
      { label: 'Add to split', click: () => void this.dispatch({ type: 'add-split', tabId: id }, win) },
      { label: 'Archive', click: () => void this.dispatch({ type: 'archive-tab', id }, win) },
      { label: 'Copy URL', click: () => { if (item.url) clipboard.writeText(item.url); } },
      { type: 'separator' },
      { label: 'Close', click: () => void this.dispatch({ type: 'close-tab', id }, win) },
    ];
    Menu.buildFromTemplate(template).popup({ window: win.win });
  }

  private pageMenu(wc: WebContents, params: Electron.ContextMenuParams): void {
    const win = this.windowFromContents(wc) || this.focused();
    if (!win) return;
    const template: Electron.MenuItemConstructorOptions[] = [];
    for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
      template.push({ label: suggestion, click: () => wc.replaceMisspelling(suggestion) });
    }
    if (params.misspelledWord) template.push({ type: 'separator' });
    if (params.linkURL) {
      template.push(
        { label: 'Open link in new tab', click: () => this.openUrl(win, params.linkURL, 'today') },
        { label: 'Open in Little Cove', click: () => this.openLittle(params.linkURL) },
        { label: 'Peek', click: () => this.openPeek(win, params.linkURL) },
        { label: 'Copy link', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' },
      );
    }
    if (params.mediaType === 'image' && params.srcURL) {
      template.push(
        { label: 'Copy image', click: () => wc.copyImageAt(params.x, params.y) },
        { label: 'Save image', click: () => wc.downloadURL(params.srcURL) },
        { type: 'separator' },
      );
    }
    template.push(
      { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
      { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
      { label: 'Reload', click: () => wc.reload() },
      { type: 'separator' },
      { label: 'Copy', enabled: params.editFlags.canCopy, role: 'copy' },
      { label: 'Paste', enabled: params.editFlags.canPaste, role: 'paste' },
      { label: 'Select all', role: 'selectAll' },
      { type: 'separator' },
      { label: 'Inspect', click: () => wc.inspectElement(params.x, params.y) },
    );
    Menu.buildFromTemplate(template).popup({ window: win.win });
  }

  private downloadAction(id: string, op: 'cancel' | 'open' | 'show' | 'dismiss'): void {
    const record = this.store.library.downloads.find((entry) => entry.id === id);
    const active = this.activeDownloads.get(id);
    if (op === 'cancel') active?.cancel();
    if (op === 'dismiss' && record) record.onShelf = false;
    if (op === 'open' && record?.savePath) void shell.openPath(record.savePath);
    if (op === 'show' && record?.savePath) shell.showItemInFolder(record.savePath);
  }

  private visibleItems(win: Win): Item[] {
    return this.leaves(win);
  }

  private sectionItems(spaceId: string, section: Section): Item[] {
    return this.store.library.items
      .filter((item) => item.spaceId === spaceId && item.section === section)
      .sort((a, b) => a.order - b.order);
  }

  private favorites(spaceId: string): Item[] {
    const space = this.space(spaceId);
    return this.store.library.items
      .filter((item) => item.section === 'favorites' && item.profileId === space?.profileId && !item.parentId)
      .sort((a, b) => a.order - b.order);
  }

  private isActive(id: string): boolean {
    return [...this.windows.values()].some((win) => win.activeTabId === id || this.leaf(win)?.id === id);
  }

  private theme(win: Win) {
    if (win.incognito) return themeFor('#8E8E93', 'dark');
    const space = this.space(win.spaceId) || this.spaces()[0];
    const appearance = !space || space.appearance === 'auto' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : space.appearance;
    return themeFor(space?.color || '#3EBE8A', appearance);
  }

  private snapshot(win: Win): Snapshot {
    const space = this.space(win.spaceId) || this.spaces()[0];
    const leaf = this.leaf(win);
    const wc = this.leafWeb(win);
    const theme = this.theme(win);
    const row = (item: Item) => this.toRow(win, item);
    const pinned = win.incognito ? [] : this.sectionItems(win.spaceId, 'pinned').filter((item) => !item.parentId).map(row);
    const today = (win.incognito
      ? this.store.library.items.filter((item) => item.ephemeral && this.owner.get(item.id) === win.id && !item.parentId)
      : this.sectionItems(win.spaceId, 'today').filter((item) => !item.parentId)
    ).map(row);
    return {
      windowId: win.id,
      mode: win.mode,
      incognito: win.incognito,
      spaces: win.incognito
        ? [{ id: 'incognito', name: 'Incognito', icon: '🕶️', color: '#8E8E93', active: true }]
        : this.spaces().map((entry) => ({ id: entry.id, name: entry.name, icon: entry.icon, color: entry.color, active: entry.id === win.spaceId })),
      activeSpaceId: win.spaceId,
      favorites: win.incognito ? [] : this.favorites(win.spaceId).map(row),
      pinned,
      today,
      todayLabel: 'Today',
      activeTabId: leaf?.id || win.activeTabId,
      splitFocusId: this.activeSplit(win) ? this.splitFocus.get(this.activeSplit(win)!.id) || null : null,
      sidebarVisible: this.store.library.settings.sidebarVisible,
      sidebarPeek: win.peeking,
      sidebarWidth: this.store.library.settings.sidebarWidth,
      theme,
      loading: !!(leaf && this.loading.has(leaf.id)),
      canBack: !!wc && !wc.isDestroyed() && wc.navigationHistory.canGoBack(),
      canForward: !!wc && !wc.isDestroyed() && wc.navigationHistory.canGoForward(),
      downloads: this.store.library.downloads.filter((entry) => entry.onShelf).slice(0, 4),
      media: this.mediaState(win),
      title: leaf?.customTitle || leaf?.title || '',
      url: leaf?.url || '',
      secure: leaf?.url?.startsWith('https:') ? true : leaf?.url?.startsWith('http:') ? false : null,
      zoom: wc && !wc.isDestroyed() ? wc.getZoomFactor() : 1,
      sound: this.sound,
      profileName: this.profile(space?.profileId || '')?.name || '',
      profiles: this.store.library.profiles.map((profile) => ({ id: profile.id, name: profile.name })),
      pinnedCollapsed: !!space?.pinnedCollapsed,
      host: hostOf(leaf?.url || ''),
      renameId: this.pendingRename,
      editSpaceId: this.editSpaceId,
    };
  }

  private toRow(win: Win, item: Item): Snapshot['pinned'][number] {
    const kids = item.kind === 'folder' && !item.collapsed ? this.children(item) : [];
    const focusId = item.kind === 'split' ? this.splitFocus.get(item.id) : '';
    const focus = item.kind === 'split' ? this.children(item).find((child) => child.id === focusId) || this.children(item)[0] : item;
    const active = win.activeTabId === item.id || this.leaf(win)?.id === item.id;
    return {
      id: item.id,
      kind: item.kind,
      title: item.customTitle || focus?.customTitle || focus?.title || item.title,
      url: this.store.library.settings.showFullUrl || this.store.library.settings.developerMode ? item.url || focus?.url || '' : hostOf(item.url || focus?.url || ''),
      favicon: item.favicon || focus?.favicon || '',
      active,
      unread: item.unread,
      muted: item.muted,
      audible: this.audible.has(item.id),
      loading: this.loading.has(item.id),
      collapsed: item.collapsed,
      children: kids.map((child) => this.toRow(win, child)),
      paneCount: item.kind === 'split' ? item.children.length : 0,
    };
  }

  private mediaState(win: Win): Snapshot['media'] {
    for (const id of this.audible) {
      const item = this.item(id);
      if (!item) continue;
      return { tabId: id, title: item.customTitle || item.title, audible: true, muted: item.muted };
    }
    return null;
  }

  private search(win: Win, query: string, mode: 'new' | 'edit') {
    return queryCommands(this.store.library, query, {
      spaceId: win.spaceId,
      activeUrl: this.leaf(win)?.url || '',
      mru: this.mru,
      history: this.store.history,
    });
  }

  private boot(sender: WebContents) {
    const url = new URL(sender.getURL());
    const win = this.windowFromContents(sender);
    const space = win ? this.space(win.spaceId) : this.spaces()[0];
    const theme = win ? this.theme(win) : themeFor('#3EBE8A', 'light');
    const parts = url.pathname.split('/').filter(Boolean);
    const kind = parts[0];
    const id = parts[1] || '';
    const item = this.item(id);
    const counts = {
      topSites: topSites(this.store.history),
    };
    return {
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      theme,
      settings: this.store.library.settings,
      info: {
        greeting: greeting(),
        spaceName: space?.name || 'Cove',
        searchEngine: this.store.library.settings.searchEngine,
        arcAvailable: existsSync(join(homedir(), 'Library', 'Application Support', 'Arc', 'StorableSidebar.json')),
        incognito: !!win?.incognito,
        favorites: (space ? this.favorites(space.id) : []).map((fav) => ({ id: fav.id, title: fav.customTitle || fav.title, url: fav.url, favicon: fav.favicon })),
        topSites: counts.topSites,
        theme,
        currentHost: hostOf(this.lastWeb()?.getURL() || ''),
      },
      note: item?.kind === 'note' ? { id: item.id, title: item.title, body: item.noteBody } : null,
      easel: item?.kind === 'easel' ? { id: item.id, title: item.title, doc: item.easel } : null,
      boost: kind === 'boost' ? this.store.library.boosts.find((boost) => boost.id === id) || { id: 'new', name: '', host: url.searchParams.get('host') || '', css: '', js: '', enabled: true } : null,
      passwords: this.store.listPasswords(),
      extensions: win ? this.profileSession(win).getAllExtensions().map((ext) => ({ id: ext.id, name: ext.name, version: ext.version, path: ext.path })) : [],
      profiles: this.store.library.profiles,
      spaces: this.store.library.spaces,
      commands: commandList(this.store.library.settings.keybindings),
      membership: this.store.library.membership,
    };
  }

  private hydrateMembership(): void {
    if (this.store.library.membership.name) return;
    const imported = readArcMembership(homedir());
    if (!imported) return;
    this.store.library.membership = imported;
    this.store.touch();
  }

  private libraryRows(section: string, query: string, offset: number): { rows: LibRow[]; total: number } {
    const q = query.trim().toLowerCase();
    let rows: LibRow[] = [];
    if (section === 'history') {
      rows = this.store.history
        .filter((entry) => !q || `${entry.title} ${entry.url}`.toLowerCase().includes(q))
        .map((entry) => ({ id: entry.id, title: entry.title, url: entry.url, at: entry.at, space: '', kind: 'history' }));
    } else if (section === 'downloads') {
      rows = this.store.library.downloads
        .filter((entry) => !q || `${entry.filename} ${entry.url}`.toLowerCase().includes(q))
        .map((entry) => ({ id: entry.id, title: entry.filename, url: entry.url, at: entry.at, space: entry.state, kind: 'download' }));
    } else if (section === 'notes') {
      rows = this.store.library.items
        .filter((item) => (item.kind === 'note' || item.kind === 'easel') && (!q || item.title.toLowerCase().includes(q)))
        .map((item) => ({ id: item.id, title: item.title, url: item.url, at: item.lastActiveAt, space: this.space(item.spaceId)?.name || '', kind: item.kind }));
    } else {
      rows = this.store.library.items
        .filter((item) => item.section === 'archive' && item.kind === 'tab' && (!q || `${item.title} ${item.url}`.toLowerCase().includes(q)))
        .map((item) => ({ id: item.id, title: item.customTitle || item.title, url: item.url, at: item.archivedAt || item.lastActiveAt, space: this.space(item.spaceId)?.name || '', kind: 'archive' }));
    }
    return { rows: rows.slice(offset, offset + 80), total: rows.length };
  }

  private refresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      let unread = 0;
      for (const win of this.windows.values()) {
        if (win.win.isDestroyed()) continue;
        const snap = this.snapshot(win);
        if (!win.shell.webContents.isDestroyed()) win.shell.webContents.send('cove:snapshot', snap);
        unread += snap.today.filter((row) => row.unread).length;
      }
      app.setBadgeCount(unread);
    }, 30);
  }

  private refreshTimer: NodeJS.Timeout | null = null;

  private pollAudio(): void {
    const next = new Set<string>();
    for (const [id, live] of this.views) {
      if (live.view.webContents.isDestroyed()) continue;
      if (live.view.webContents.isCurrentlyAudible()) next.add(id);
    }
    const changed = next.size !== this.audible.size || [...next].some((id) => !this.audible.has(id));
    this.audible = next;
    if (changed) this.refresh();
  }

  private archiveSweep(): void {
    const hours = this.store.library.settings.archiveAfterHours;
    if (!hours) return;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    let changed = false;
    for (const item of [...this.store.library.items]) {
      if (item.section !== 'today' || item.kind !== 'tab' || item.ephemeral) continue;
      if (this.isActive(item.id)) continue;
      if (item.lastActiveAt < cutoff) {
        item.section = 'archive';
        item.archivedAt = Date.now();
        this.destroyView(item.id);
        changed = true;
      }
    }
    if (changed) {
      this.store.touch();
      this.refresh();
    }
  }

  private async cacheFavicon(item: Item, url: string): Promise<void> {
    try {
      let buffer: Buffer | null = null;
      if (url.startsWith('data:image')) {
        const match = url.match(/base64,(.+)$/);
        if (match) buffer = Buffer.from(match[1], 'base64');
      } else if (/^https?:/i.test(url)) {
        const response = await net.fetch(url);
        if (response.ok) buffer = Buffer.from(await response.arrayBuffer());
      }
      if (!buffer || buffer.length > 200_000) return;
      mkdirSync(this.faviconDir, { recursive: true });
      writeFileSync(join(this.faviconDir, item.id), buffer);
      item.favicon = `cove://app/favicon/${item.id}`;
      this.refresh();
    } catch {
      /* favicon is optional */
    }
  }

  private destroyView(id: string): void {
    const live = this.views.get(id);
    if (!live) return;
    this.views.delete(id);
    this.loading.delete(id);
    this.audible.delete(id);
    try {
      if (live.windowId != null) this.windows.get(live.windowId)?.win.contentView.removeChildView(live.view);
    } catch {
      /* already detached */
    }
    if (!live.view.webContents.isDestroyed()) live.view.webContents.close();
  }

  private touchLru(id: string): void {
    this.lru = this.lru.filter((entry) => entry !== id);
    this.lru.push(id);
  }

  private evict(): void {
    while (this.views.size > 18) {
      const id = this.lru.find((entry) => !this.isShowing(entry));
      if (!id) break;
      this.lru = this.lru.filter((entry) => entry !== id);
      this.destroyView(id);
    }
  }

  private lru: string[] = [];

  private isShowing(id: string): boolean {
    return [...this.windows.values()].some((win) => this.panes(win).some((pane) => pane.id === id));
  }

  private applyLittleOnTop(): void {
    for (const win of this.windows.values()) {
      if (win.mode === 'little') win.win.setAlwaysOnTop(this.store.library.settings.littleOnTop);
    }
  }
}

function normalize(weights: number[]): number[] {
  const clamped = weights.map((weight) => Math.max(0.12, weight || 0));
  const sum = clamped.reduce((total, weight) => total + weight, 0) || 1;
  return clamped.map((weight) => weight / sum);
}

function normalizeKey(key: string): string {
  const value = key.toLowerCase();
  if (value.startsWith('arrow')) return value.replace('arrow', '');
  return value;
}

function currentIsError(wc: WebContents): boolean {
  return !wc.isDestroyed() && wc.getURL().startsWith('cove://app/error');
}

function topSites(history: { title: string; url: string }[]): { title: string; url: string }[] {
  const counts = new Map<string, { title: string; url: string; n: number }>();
  for (const entry of history) {
    const key = hostOf(entry.url);
    if (!key) continue;
    const found = counts.get(key);
    if (found) found.n += 1;
    else counts.set(key, { title: entry.title || key, url: entry.url, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 8).map(({ title, url }) => ({ title, url }));
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (char !== '\r') cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

