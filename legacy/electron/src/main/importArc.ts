import { execFileSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SPACE_COLORS } from '../shared/theme';
import type { HistoryEntry, Item, Membership, Profile, Section, Space } from '../shared/types';
import { uid } from '../shared/url';

export interface ArcImport {
  profiles: Profile[];
  spaces: Space[];
  items: Item[];
  history: HistoryEntry[];
  report: {
    spaces: number;
    pinned: number;
    today: number;
    favorites: number;
    folders: number;
    splits: number;
    archive: number;
    history: number;
    bookmarks: number;
    profiles: number;
    sampleYear: number;
    warnings: string[];
  };
}

const ARC_ICONS: Record<string, string> = {
  planet: '🌐',
  star: '⭐',
  heart: '❤️',
  book: '📚',
  bolt: '⚡',
  flame: '🔥',
  leaf: '🍃',
  moon: '🌙',
  sun: '☀️',
  music: '🎵',
  game: '🎮',
  code: '💻',
  briefcase: '💼',
  house: '🏠',
  home: '🏠',
  person: '👤',
  smile: '😊',
  pin: '📍',
  folder: '📁',
  cloud: '☁️',
  camera: '📷',
  mail: '✉️',
  calendar: '📅',
  gift: '🎁',
  rocket: '🚀',
  coffee: '☕',
  compass: '🧭',
  bulb: '💡',
  paw: '🐾',
  cart: '🛒',
  lock: '🔒',
  bell: '🔔',
  flag: '🚩',
};

export function readArcMembership(home: string): Membership | null {
  const root = arcSupportDir(home);
  const cardPath = join(root, 'StorableMembershipCard.json');
  const authPath = join(root, 'StorableAuthState.json');
  if (!existsSync(cardPath) && !existsSync(authPath)) return null;
  let card: any = {};
  let auth: any = {};
  try {
    if (existsSync(cardPath)) card = JSON.parse(readFileSync(cardPath, 'utf8'));
  } catch {
    card = {};
  }
  try {
    if (existsSync(authPath)) auth = JSON.parse(readFileSync(authPath, 'utf8'));
  } catch {
    auth = {};
  }
  const user = auth?.session?.user || {};
  const blob = Array.isArray(card.backgroundBlobInfo) ? card.backgroundBlobInfo.map(Number).filter((n: number) => Number.isFinite(n)) : [];
  return {
    name: typeof user.name === 'string' ? user.name : '',
    title: typeof card.title === 'string' ? card.title : '',
    joinedAt: arcDate(user.createdAt),
    palette: Number(card.paletteNumber) || 1,
    shape: typeof card.shapeName === 'string' ? card.shapeName : 'Shape3',
    blob: blob.length ? blob : [6, 6, 12, 4, 7, 9, 4, 6, 12, 11, 8, 5, 11, 2, 7],
  };
}

export function arcSupportDir(home: string): string {
  return join(home, 'Library', 'Application Support', 'Arc');
}

export function importArc(home: string): ArcImport {
  const root = arcSupportDir(home);
  const warnings: string[] = [];
  const sidebarPath = join(root, 'StorableSidebar.json');
  if (!existsSync(sidebarPath)) {
    throw new Error('Arc sidebar was not found in Application Support.');
  }
  const sidebar = JSON.parse(readFileSync(sidebarPath, 'utf8'));
  const rawItems = mergePairs(sidebar?.firebaseSyncState?.syncData?.items, sidebar?.sidebarSyncState?.items);
  const rawSpaces = mergePairs(
    sidebar?.firebaseSyncState?.syncData?.spaceModels,
    sidebar?.sidebarSyncState?.spaceModels,
  );
  const ordered: string[] =
    sidebar?.firebaseSyncState?.syncData?.orderedSpaceIDs?.value ||
    sidebar?.sidebarSyncState?.container?.value?.orderedSpaceIDs ||
    [];

  const profiles = new Map<string, Profile>();
  const ensureProfile = (key: string) => {
    const name = key === 'default' ? 'Default' : key;
    const idKey = name || 'Default';
    let profile = profiles.get(idKey);
    if (!profile) {
      profile = { id: uid(), name: idKey, partition: `persist:cove-${slug(idKey)}` };
      profiles.set(idKey, profile);
    }
    return profile;
  };

  const spaces: Space[] = [];
  const pinnedContainer = new Map<string, string>();
  const todayContainer = new Map<string, string>();
  rawSpaces.forEach((raw, index) => {
    const profile = ensureProfile(profileKey(raw.profile));
    const space: Space = {
      id: uid(),
      name: stringOf(raw.title) || 'Space',
      icon: iconOf(raw.customInfo),
      color: colorOf(raw.customInfo) || SPACE_COLORS[index % SPACE_COLORS.length],
      appearance: appearanceOf(raw.customInfo),
      profileId: profile.id,
      order: index,
      pinnedCollapsed: false,
      sourceId: stringOf(raw.id),
    };
    spaces.push(space);
    for (const pair of stringPairs(raw.containerIDs)) {
      if (pair.key === 'pinned') pinnedContainer.set(pair.id, space.id);
      if (pair.key === 'unpinned') todayContainer.set(pair.id, space.id);
    }
  });
  if (Array.isArray(ordered) && ordered.length) {
    const rank = new Map(ordered.map((id, i) => [id, i]));
    spaces.sort((a, b) => (rank.get(a.sourceId) ?? 999) - (rank.get(b.sourceId) ?? 999));
    spaces.forEach((s, i) => {
      s.order = i;
    });
  }

  const bySource = new Map(rawItems.map((r) => [stringOf(r.id), r]));
  const favoriteContainerProfile = new Map<string, string>();
  for (const raw of rawItems) {
    const top = raw.data?.itemContainer?.containerType?.topApps;
    if (!top) continue;
    favoriteContainerProfile.set(stringOf(raw.id), profileKey(top._0 || top));
  }

  const items: Item[] = [];
  const sourceToItem = new Map<string, Item>();

  const make = (partial: Partial<Item> & Pick<Item, 'kind' | 'section' | 'spaceId' | 'profileId'>): Item => {
    const item: Item = {
      id: uid(),
      kind: partial.kind,
      spaceId: partial.spaceId,
      profileId: partial.profileId,
      parentId: partial.parentId ?? null,
      section: partial.section,
      title: partial.title || 'Untitled',
      customTitle: partial.customTitle || '',
      url: partial.url || '',
      pinnedUrl: partial.pinnedUrl || '',
      favicon: '',
      children: [],
      collapsed: false,
      createdAt: partial.createdAt || Date.now(),
      lastActiveAt: partial.lastActiveAt || partial.createdAt || Date.now(),
      archivedAt: partial.archivedAt ?? null,
      muted: !!partial.muted,
      unread: !!partial.unread,
      ephemeral: false,
      live: false,
      order: partial.order ?? 0,
      splitOrientation: partial.splitOrientation || 'horizontal',
      splitWeights: partial.splitWeights || [],
      noteBody: '',
      easel: null,
      sourceId: partial.sourceId || '',
    };
    items.push(item);
    if (item.sourceId) sourceToItem.set(item.sourceId, item);
    return item;
  };

  for (const raw of rawItems) {
    const data = raw.data || {};
    if (data.itemContainer) continue;
    const sourceId = stringOf(raw.id);
    const loc = locate(sourceId, bySource, pinnedContainer, todayContainer, favoriteContainerProfile, spaces);
    if (!loc) continue;
    const space = spaces.find((s) => s.id === loc.spaceId) || spaces[0];
    if (!space) continue;
    if (data.tabGroup || data.list) {
      make({
        kind: 'folder',
        section: loc.section,
        spaceId: space.id,
        profileId: space.profileId,
        title: stringOf(raw.title) || stringOf(data.tabGroup?.title) || 'Folder',
        sourceId,
        createdAt: arcDate(raw.createdAt),
        order: loc.order,
      });
    } else if (data.splitView) {
      const orient = String(data.splitView.layoutOrientation || '').toLowerCase().includes('vertical')
        ? 'vertical'
        : 'horizontal';
      make({
        kind: 'split',
        section: loc.section,
        spaceId: space.id,
        profileId: space.profileId,
        title: stringOf(raw.title) || 'Split',
        sourceId,
        createdAt: arcDate(raw.createdAt),
        lastActiveAt: arcDate(data.splitView.timeLastActiveAt),
        splitOrientation: orient,
        splitWeights: Array.isArray(data.splitView.itemWidthFactors) ? data.splitView.itemWidthFactors.map(Number) : [],
        order: loc.order,
      });
    } else if (data.tab) {
      const url = stringOf(data.tab.savedURL);
      if (!url || /^(javascript|chrome|arc):/i.test(url)) continue;
      const muted = /mute|block/i.test(stringOf(data.tab.savedMuteStatus));
      make({
        kind: 'tab',
        section: loc.section,
        spaceId: space.id,
        profileId: loc.section === 'favorites' ? ensureProfile(loc.profileKey || 'default').id : space.profileId,
        title: stringOf(raw.title) || stringOf(data.tab.savedTitle) || hostTitle(url),
        url,
        pinnedUrl: loc.section === 'pinned' || loc.section === 'favorites' ? url : '',
        sourceId,
        createdAt: arcDate(raw.createdAt),
        lastActiveAt: arcDate(data.tab.timeLastActiveAt),
        unread: !!raw.isUnread,
        muted,
        order: loc.order,
      });
    }
  }

  for (const raw of rawItems) {
    const parent = sourceToItem.get(stringOf(raw.parentID));
    const self = sourceToItem.get(stringOf(raw.id));
    if (!parent || !self) continue;
    if (parent.kind === 'folder' || parent.kind === 'split') {
      self.parentId = parent.id;
      self.section = parent.section;
      self.spaceId = parent.spaceId;
      if (!parent.children.includes(self.id)) parent.children.push(self.id);
    }
  }
  for (const raw of rawItems) {
    const self = sourceToItem.get(stringOf(raw.id));
    if (!self || (self.kind !== 'folder' && self.kind !== 'split')) continue;
    const ids = Array.isArray(raw.childrenIds) ? raw.childrenIds : [];
    const orderedKids = ids.map((id: string) => sourceToItem.get(String(id))?.id).filter(Boolean) as string[];
    if (orderedKids.length) self.children = orderedKids;
    self.children.forEach((id, index) => {
      const kid = items.find((i) => i.id === id);
      if (kid) kid.order = index;
    });
  }

  const archivePath = join(root, 'StorableArchiveItems.json');
  if (existsSync(archivePath)) {
    try {
      const archive = JSON.parse(readFileSync(archivePath, 'utf8'));
      const rows = Array.isArray(archive.items) ? archive.items : [];
      for (let i = 0; i < rows.length - 1; i += 2) {
        const wrap = rows[i + 1];
        if (!wrap || typeof wrap !== 'object') continue;
        const side = wrap.sidebarItem;
        if (!side?.data?.tab) continue;
        const sourceId = stringOf(side.id);
        if (sourceToItem.has(sourceId)) continue;
        const url = stringOf(side.data.tab.savedURL);
        if (!isKeepable(url)) continue;
        const spaceSource = asId(wrap.source?.space?._0 || wrap.source?.space);
        const space = spaces.find((s) => s.sourceId === spaceSource) || spaces[0];
        if (!space) continue;
        make({
          kind: 'tab',
          section: 'archive',
          spaceId: space.id,
          profileId: space.profileId,
          title: stringOf(side.title) || stringOf(side.data.tab.savedTitle) || hostTitle(url),
          url,
          sourceId,
          createdAt: arcDate(side.createdAt),
          lastActiveAt: arcDate(side.data.tab.timeLastActiveAt),
          archivedAt: arcDate(wrap.archivedAt),
          order: items.length,
        });
      }
    } catch {
      warnings.push('Archive could not be read.');
    }
  }

  let bookmarks = 0;
  const userData = join(root, 'User Data');
  for (const profile of profiles.values()) {
    const dir = profile.name === 'Default' ? 'Default' : profile.name;
    const bookmarkFile = join(userData, dir, 'Bookmarks');
    if (!existsSync(bookmarkFile)) continue;
    try {
      const json = JSON.parse(readFileSync(bookmarkFile, 'utf8'));
      const collected: { title: string; url: string }[] = [];
      walkBookmarks(json.roots?.bookmark_bar, collected);
      walkBookmarks(json.roots?.other, collected);
      if (!collected.length) continue;
      const space = spaces.find((s) => s.profileId === profile.id) || spaces[0];
      if (!space) continue;
      const folder = make({
        kind: 'folder',
        section: 'pinned',
        spaceId: space.id,
        profileId: profile.id,
        title: 'Imported bookmarks',
        order: 10_000,
      });
      collected.forEach((b, index) => {
        if (!isKeepable(b.url)) return;
        const tab = make({
          kind: 'tab',
          section: 'pinned',
          spaceId: space.id,
          profileId: profile.id,
          parentId: folder.id,
          title: b.title || hostTitle(b.url),
          url: b.url,
          pinnedUrl: b.url,
          order: index,
        });
        folder.children.push(tab.id);
        bookmarks += 1;
      });
    } catch {
      warnings.push(`Bookmarks for ${profile.name} were skipped.`);
    }
  }

  const history: HistoryEntry[] = [];
  for (const profile of profiles.values()) {
    const dir = profile.name === 'Default' ? 'Default' : profile.name;
    const db = join(userData, dir, 'History');
    if (!existsSync(db)) continue;
    try {
      history.push(...readHistory(db, profile.id));
    } catch {
      warnings.push(`History for ${profile.name} was skipped.`);
    }
  }

  const sample = items.find((i) => i.kind === 'tab' && i.lastActiveAt)?.lastActiveAt || Date.now();
  const count = (section: Section, kind?: Item['kind']) =>
    items.filter((i) => i.section === section && (!kind || i.kind === kind) && !i.parentId).length;

  return {
    profiles: [...profiles.values()],
    spaces,
    items,
    history,
    report: {
      spaces: spaces.length,
      pinned: items.filter((i) => i.section === 'pinned' && i.kind === 'tab').length,
      today: items.filter((i) => i.section === 'today' && i.kind === 'tab').length,
      favorites: items.filter((i) => i.section === 'favorites').length,
      folders: items.filter((i) => i.kind === 'folder').length,
      splits: items.filter((i) => i.kind === 'split').length,
      archive: items.filter((i) => i.section === 'archive').length,
      history: history.length,
      bookmarks,
      profiles: profiles.size,
      sampleYear: new Date(sample).getUTCFullYear(),
      warnings,
    },
  };
}

function locate(
  id: string,
  bySource: Map<string, any>,
  pinned: Map<string, string>,
  today: Map<string, string>,
  favorites: Map<string, string>,
  spaces: Space[],
): { section: Section; spaceId: string; order: number; profileKey?: string } | null {
  const seen = new Set<string>();
  let cursor = id;
  let order = 0;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const raw = bySource.get(cursor);
    const parent = stringOf(raw?.parentID);
    if (pinned.has(parent)) return { section: 'pinned', spaceId: pinned.get(parent)!, order: indexIn(bySource.get(parent), id) };
    if (today.has(parent)) return { section: 'today', spaceId: today.get(parent)!, order: indexIn(bySource.get(parent), id) };
    if (favorites.has(parent)) {
      const space = spaces[0];
      return {
        section: 'favorites',
        spaceId: space?.id || '',
        order: indexIn(bySource.get(parent), id),
        profileKey: favorites.get(parent),
      };
    }
    if (pinned.has(cursor) || today.has(cursor) || favorites.has(cursor)) return null;
    order += 1;
    cursor = parent;
    if (order > 12) break;
  }
  return null;
}

function indexIn(container: any, id: string): number {
  const kids: string[] = Array.isArray(container?.childrenIds) ? container.childrenIds.map(String) : [];
  const idx = kids.indexOf(id);
  return idx >= 0 ? idx : 0;
}

function mergePairs(a: unknown, b: unknown): any[] {
  const map = new Map<string, any>();
  for (const arr of [a, b]) {
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i < arr.length - 1; i += 2) {
      if (typeof arr[i] !== 'string' || !arr[i + 1] || typeof arr[i + 1] !== 'object') continue;
      const obj = arr[i + 1];
      const value = obj.value ?? obj;
      const date = Number(obj.lastChangeDate || 0);
      const id = String(value.id || arr[i]);
      const prev = map.get(id);
      if (!prev || date >= prev.__date) map.set(id, { ...value, id, __date: date });
    }
  }
  return [...map.values()];
}

function stringPairs(arr: unknown): { key: string; id: string }[] {
  if (!Array.isArray(arr)) return [];
  const out: { key: string; id: string }[] = [];
  for (let i = 0; i < arr.length - 1; i += 2) {
    if (typeof arr[i] === 'string' && typeof arr[i + 1] === 'string') out.push({ key: arr[i], id: arr[i + 1] });
  }
  return out;
}

function profileKey(profile: any): string {
  if (!profile) return 'default';
  if (profile.default) return 'default';
  const custom = profile.custom?._0 ?? profile.custom ?? profile._0?.custom?._0 ?? profile._0;
  if (typeof custom === 'string') return custom;
  if (custom?.directoryBasename) return String(custom.directoryBasename);
  if (profile.directoryBasename) return String(profile.directoryBasename);
  return 'default';
}

function iconOf(info: any): string {
  const t = info?.iconType;
  if (!t) return '✦';
  if (typeof t.emoji_v2 === 'string' && t.emoji_v2) return t.emoji_v2;
  if (typeof t.emoji === 'number' && t.emoji > 0) return String.fromCodePoint(t.emoji);
  if (typeof t.icon === 'string') return ARC_ICONS[t.icon] || '✦';
  return '✦';
}

function colorOf(info: any): string | null {
  const m = info?.windowTheme?.primaryColorPalette?.midTone;
  if (!m) return null;
  const ch = (n: unknown) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return 120;
    return v > 1 ? Math.max(0, Math.min(255, Math.round(v))) : Math.round(Math.max(0, Math.min(1, v)) * 255);
  };
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(ch(m.red))}${hex(ch(m.green))}${hex(ch(m.blue))}`;
}

function appearanceOf(info: any): Space['appearance'] {
  const a = info?.windowTheme?.background?.single?._0?.contentOverBackgroundAppearance;
  if (a === 'light' || a === 'dark') return a;
  if (a && typeof a === 'object') {
    if ('dark' in a && !('light' in a)) return 'dark';
    if ('light' in a && !('dark' in a)) return 'light';
  }
  return 'auto';
}

export function arcDate(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return Date.now();
  if (v > 1e14) return Math.round(v / 1000);
  if (v > 1e12) return Math.round(v);
  if (v > 1.2e9 && v < 2.2e9) return Math.round(v * 1000);
  if (v > 5e8 && v < 1.2e9) return Math.round((v + 978307200) * 1000);
  return Date.now();
}

function stringOf(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asId(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const o = v as any;
    if (typeof o.id === 'string') return o.id;
    if (o._0) return asId(o._0);
  }
  return '';
}

function hostTitle(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Tab';
  }
}

function isKeepable(url: string): boolean {
  return !!url && !/^(javascript|chrome|arc|about):/i.test(url);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
}

function walkBookmarks(node: any, out: { title: string; url: string }[]) {
  if (!node) return;
  if (node.type === 'url' && typeof node.url === 'string') out.push({ title: String(node.name || ''), url: node.url });
  if (Array.isArray(node.children)) for (const child of node.children) walkBookmarks(child, out);
}

function readHistory(db: string, profileId: string): HistoryEntry[] {
  const dir = join(tmpdir(), `cove-history-${uid()}`);
  mkdirSync(dir, { recursive: true });
  try {
    copyFileSync(db, join(dir, 'History'));
    for (const ext of ['-wal', '-shm']) {
      if (existsSync(db + ext)) copyFileSync(db + ext, join(dir, 'History' + ext));
    }
    const sql =
      "SELECT url, title, last_visit_time FROM urls WHERE url LIKE 'http%' ORDER BY last_visit_time DESC LIMIT 4000;";
    const out = execFileSync('/usr/bin/sqlite3', ['-json', join(dir, 'History'), sql], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      timeout: 8000,
    });
    if (!out.trim()) return [];
    const rows = JSON.parse(out) as { url: string; title: string; last_visit_time: number }[];
    return rows
      .filter((r) => r.url && !r.url.startsWith('chrome'))
      .map((r) => ({
        id: uid(),
        url: r.url,
        title: r.title || hostTitle(r.url),
        at: chromeTime(r.last_visit_time),
        profileId,
      }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function chromeTime(v: number): number {
  if (!v) return Date.now();
  return Math.round(v / 1000 - 11644473600000);
}
