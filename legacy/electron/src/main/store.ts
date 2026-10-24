import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import { defaultMembership } from '../shared/membership';
import type { HistoryEntry, Library, PasswordMeta, Settings } from '../shared/types';
import { SPACE_COLORS } from '../shared/theme';
import { uid } from '../shared/url';

interface PasswordRecord {
  id: string;
  origin: string;
  username: string;
  data: string;
}

export function defaultSettings(): Settings {
  return {
    searchEngine: 'google',
    archiveAfterHours: 12,
    sidebarWidth: 250,
    sidebarStyleVersion: 1,
    sidebarVisible: true,
    openExternalIn: 'little',
    adBlock: true,
    doNotTrack: false,
    httpsOnly: false,
    blockThirdPartyCookies: false,
    restoreSession: true,
    downloadDir: app.getPath('downloads'),
    askWhereToSave: false,
    soundEffects: false,
    boostJs: true,
    syncFolder: null,
    translateTarget: 'en',
    keybindings: {},
    siteZoom: {},
    permissions: {},
    blockedHosts: [],
    passwordNever: [],
    didOnboard: false,
    previews: true,
    showFullUrl: false,
    littleOnTop: true,
    developerMode: false,
    extensionDirs: [],
  };
}

export function blankLibrary(): Library {
  const profile = { id: uid(), name: 'Personal', partition: 'persist:cove-personal' };
  const space = {
    id: uid(),
    name: 'Personal',
    icon: '🏡',
    color: '#6d6784',
    appearance: 'dark' as const,
    profileId: profile.id,
    order: 0,
    pinnedCollapsed: false,
    sourceId: '',
  };
  return {
    version: 1,
    settings: defaultSettings(),
    profiles: [profile],
    spaces: [space],
    items: [],
    boosts: [
      {
        id: uid(),
        name: 'Readable Wikipedia',
        host: 'wikipedia.org',
        enabled: false,
        js: '',
        css: 'body{font-family:Georgia,serif}#content{max-width:820px;margin:0 auto;background:#fff}',
      },
    ],
    downloads: [],
    closed: [],
    membership: defaultMembership(),
    commandScores: {},
    ui: { lastSpaceId: space.id, lastTabId: null, bounds: null },
  };
}

export class Store {
  library: Library;
  history: HistoryEntry[] = [];
  private passwordRecords: PasswordRecord[] = [];
  private timer: NodeJS.Timeout | null = null;
  private writingSync = false;

  constructor() {
    this.library = blankLibrary();
  }

  get dir(): string {
    return app.getPath('userData');
  }

  load(): void {
    mkdirSync(this.dir, { recursive: true });
    const libPath = join(this.dir, 'library.json');
    if (existsSync(libPath)) {
      try {
        const parsed = JSON.parse(readFileSync(libPath, 'utf8')) as Library;
        const blank = blankLibrary();
        this.library = {
          ...blank,
          ...parsed,
          settings: { ...blank.settings, ...parsed.settings },
          membership: { ...blank.membership, ...parsed.membership },
          ui: { ...blank.ui, ...parsed.ui },
        };
        // Narrow the old factory width once; retain explicitly resized widths.
        if (!parsed.settings?.sidebarStyleVersion && parsed.settings?.sidebarWidth === 300) {
          this.library.settings.sidebarWidth = 250;
        }
        this.library.settings.sidebarStyleVersion = 1;
      } catch {
        this.library = blankLibrary();
      }
    }
    const histPath = join(this.dir, 'history.json');
    if (existsSync(histPath)) {
      try {
        this.history = JSON.parse(readFileSync(histPath, 'utf8'));
      } catch {
        this.history = [];
      }
    }
    const passPath = join(this.dir, 'passwords.json');
    if (existsSync(passPath)) {
      try {
        this.passwordRecords = JSON.parse(readFileSync(passPath, 'utf8'));
      } catch {
        this.passwordRecords = [];
      }
    }
    this.pullSync();
  }

  touch(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    mkdirSync(this.dir, { recursive: true });
    const library = {
      ...this.library,
      items: this.library.items.filter((i) => !i.ephemeral),
      downloads: this.library.downloads.filter((d) => !d.ephemeral).slice(0, 400),
      closed: this.library.closed.slice(0, 40),
    };
    atomic(join(this.dir, 'library.json'), JSON.stringify(library));
    atomic(join(this.dir, 'history.json'), JSON.stringify(this.history.slice(0, 8000)));
    atomic(join(this.dir, 'passwords.json'), JSON.stringify(this.passwordRecords));
    this.pushSync(library);
  }

  listPasswords(): PasswordMeta[] {
    return this.passwordRecords.map(({ id, origin, username }) => ({ id, origin, username }));
  }

  savePassword(origin: string, username: string, password: string): void {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('The system keychain is unavailable.');
    const data = safeStorage.encryptString(password).toString('base64');
    const existing = this.passwordRecords.find((p) => p.origin === origin && p.username === username);
    if (existing) existing.data = data;
    else this.passwordRecords.push({ id: uid(), origin, username, data });
    this.touch();
  }

  deletePassword(id: string): void {
    this.passwordRecords = this.passwordRecords.filter((p) => p.id !== id);
    this.touch();
  }

  revealPassword(id: string): { origin: string; username: string; password: string } | null {
    const rec = this.passwordRecords.find((p) => p.id === id);
    if (!rec || !safeStorage.isEncryptionAvailable()) return null;
    try {
      const password = safeStorage.decryptString(Buffer.from(rec.data, 'base64'));
      return { origin: rec.origin, username: rec.username, password };
    } catch {
      return null;
    }
  }

  importPasswordRows(rows: { origin: string; username: string; password: string }[]): number {
    let n = 0;
    for (const row of rows) {
      if (!row.origin || !row.password) continue;
      this.savePassword(row.origin, row.username || '', row.password);
      n += 1;
    }
    return n;
  }

  exportPasswordRows(): { origin: string; username: string; password: string }[] {
    const out: { origin: string; username: string; password: string }[] = [];
    for (const rec of this.passwordRecords) {
      const revealed = this.revealPassword(rec.id);
      if (revealed) out.push(revealed);
    }
    return out;
  }

  addHistory(entry: HistoryEntry): void {
    if (this.history[0]?.url === entry.url) {
      this.history[0].at = entry.at;
      this.history[0].title = entry.title || this.history[0].title;
      return;
    }
    this.history.unshift(entry);
    if (this.history.length > 8000) this.history.length = 8000;
    this.touch();
  }

  private pushSync(library: Library): void {
    const folder = this.library.settings.syncFolder;
    if (!folder) return;
    try {
      this.writingSync = true;
      mkdirSync(folder, { recursive: true });
      atomic(join(folder, 'cove-library.json'), JSON.stringify(library));
      atomic(join(folder, 'cove-history.json'), JSON.stringify(this.history.slice(0, 8000)));
    } catch {
      /* folder may be unavailable */
    } finally {
      setTimeout(() => {
        this.writingSync = false;
      }, 500);
    }
  }

  pullSync(): void {
    const folder = this.library.settings.syncFolder;
    if (!folder || this.writingSync) return;
    const file = join(folder, 'cove-library.json');
    if (!existsSync(file)) return;
    try {
      const remote = JSON.parse(readFileSync(file, 'utf8')) as Library;
      if (!remote?.spaces?.length) return;
      this.library = { ...this.library, ...remote, settings: { ...this.library.settings, ...remote.settings, syncFolder: folder } };
      const hist = join(folder, 'cove-history.json');
      if (existsSync(hist)) this.history = JSON.parse(readFileSync(hist, 'utf8'));
    } catch {
      /* ignore unreadable sync file */
    }
  }
}

function atomic(file: string, contents: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, contents);
  renameSync(tmp, file);
}
