export type ItemKind = 'tab' | 'folder' | 'split' | 'note' | 'easel';
export type Section = 'favorites' | 'pinned' | 'today' | 'archive';
export type Appearance = 'auto' | 'light' | 'dark';
export type SearchEngine = 'google' | 'duckduckgo' | 'bing' | 'kagi';
export type PermChoice = 'allow' | 'deny';

export interface EaselText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
}

export interface EaselStroke {
  tool: 'pen' | 'highlight' | 'erase';
  color: string;
  size: number;
  points: number[];
}

export interface EaselDoc {
  strokes: EaselStroke[];
  texts: EaselText[];
  camera: { x: number; y: number; zoom: number };
}

export interface Item {
  id: string;
  kind: ItemKind;
  spaceId: string;
  profileId: string;
  parentId: string | null;
  section: Section;
  title: string;
  customTitle: string;
  url: string;
  pinnedUrl: string;
  favicon: string;
  children: string[];
  collapsed: boolean;
  createdAt: number;
  lastActiveAt: number;
  archivedAt: number | null;
  muted: boolean;
  unread: boolean;
  ephemeral: boolean;
  live: boolean;
  order: number;
  splitOrientation: 'horizontal' | 'vertical';
  splitWeights: number[];
  noteBody: string;
  easel: EaselDoc | null;
  sourceId: string;
}

export interface Space {
  id: string;
  name: string;
  icon: string;
  color: string;
  appearance: Appearance;
  profileId: string;
  order: number;
  pinnedCollapsed: boolean;
  sourceId: string;
}

export interface Profile {
  id: string;
  name: string;
  partition: string;
}

export interface Boost {
  id: string;
  name: string;
  host: string;
  css: string;
  js: string;
  enabled: boolean;
}

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  at: number;
  profileId: string;
}

export interface DownloadRec {
  id: string;
  filename: string;
  url: string;
  savePath: string;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  received: number;
  total: number;
  at: number;
  ephemeral: boolean;
  onShelf: boolean;
}

export interface ClosedRec {
  item: Item;
  children: Item[];
  at: number;
}

export interface Settings {
  searchEngine: SearchEngine;
  archiveAfterHours: number;
  sidebarWidth: number;
  sidebarVisible: boolean;
  openExternalIn: 'space' | 'little';
  adBlock: boolean;
  doNotTrack: boolean;
  httpsOnly: boolean;
  blockThirdPartyCookies: boolean;
  restoreSession: boolean;
  downloadDir: string;
  askWhereToSave: boolean;
  soundEffects: boolean;
  boostJs: boolean;
  syncFolder: string | null;
  translateTarget: string;
  keybindings: Record<string, string>;
  siteZoom: Record<string, number>;
  permissions: Record<string, Record<string, PermChoice>>;
  blockedHosts: string[];
  passwordNever: string[];
  didOnboard: boolean;
  previews: boolean;
  showFullUrl: boolean;
  littleOnTop: boolean;
  developerMode: boolean;
  extensionDirs: string[];
}

export interface Membership {
  name: string;
  title: string;
  joinedAt: number;
  palette: number;
  shape: string;
  blob: number[];
}

export interface Library {
  version: 1;
  settings: Settings;
  membership: Membership;
  profiles: Profile[];
  spaces: Space[];
  items: Item[];
  boosts: Boost[];
  downloads: DownloadRec[];
  closed: ClosedRec[];
  commandScores: Record<string, number>;
  ui: {
    lastSpaceId: string;
    lastTabId: string | null;
    bounds: { x: number; y: number; width: number; height: number } | null;
  };
}

export interface Theme {
  bg: string;
  fg: string;
  muted: string;
  hover: string;
  active: string;
  line: string;
  accent: string;
  appearance: 'light' | 'dark';
}

export interface Row {
  id: string;
  kind: ItemKind;
  title: string;
  url: string;
  favicon: string;
  active: boolean;
  unread: boolean;
  muted: boolean;
  audible: boolean;
  loading: boolean;
  collapsed: boolean;
  children: Row[];
  paneCount: number;
}

export interface SpaceChip {
  id: string;
  name: string;
  icon: string;
  color: string;
  active: boolean;
}

export interface MediaState {
  tabId: string;
  title: string;
  audible: boolean;
  muted: boolean;
}

export interface Snapshot {
  windowId: number;
  mode: 'main' | 'little' | 'peek';
  incognito: boolean;
  spaces: SpaceChip[];
  activeSpaceId: string;
  favorites: Row[];
  pinned: Row[];
  today: Row[];
  todayLabel: string;
  activeTabId: string | null;
  splitFocusId: string | null;
  sidebarVisible: boolean;
  sidebarPeek: boolean;
  sidebarWidth: number;
  theme: Theme;
  loading: boolean;
  canBack: boolean;
  canForward: boolean;
  downloads: DownloadRec[];
  media: MediaState | null;
  title: string;
  url: string;
  secure: boolean | null;
  zoom: number;
  sound: number;
  profileName: string;
  profiles: { id: string; name: string }[];
  pinnedCollapsed: boolean;
  host: string;
  renameId: string | null;
  editSpaceId: string | null;
}

export type Action =
  | { type: 'activate-tab'; id: string }
  | { type: 'activate-space'; id: string }
  | { type: 'close-tab'; id?: string }
  | { type: 'commit-omnibox'; query: string; target: 'current' | 'new' | 'little' }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'reload'; hard?: boolean }
  | { type: 'pin'; id?: string }
  | { type: 'unpin'; id?: string }
  | { type: 'favorite'; id?: string }
  | { type: 'archive-tab'; id?: string }
  | { type: 'restore-tab'; id: string }
  | { type: 'delete-item'; id: string }
  | { type: 'clear-today' }
  | { type: 'reopen' }
  | { type: 'copy-url'; markdown?: boolean }
  | { type: 'rename-item'; id: string; title: string }
  | { type: 'reset-pin'; id?: string }
  | { type: 'replace-pin'; id?: string }
  | { type: 'duplicate'; id?: string }
  | { type: 'move-tab'; id: string; spaceId: string; section?: Section }
  | { type: 'reorder'; id: string; beforeId: string | null; parentId: string | null; section: Section }
  | { type: 'split-drop'; id: string; ontoId: string; orientation: 'horizontal' | 'vertical' }
  | { type: 'new-folder'; name?: string }
  | { type: 'toggle-folder'; id: string }
  | { type: 'delete-folder'; id: string }
  | { type: 'new-space' }
  | { type: 'update-space'; id: string; name?: string; icon?: string; color?: string; appearance?: Appearance; profileId?: string }
  | { type: 'delete-space'; id: string }
  | { type: 'duplicate-space'; id: string }
  | { type: 'reorder-spaces'; id: string; beforeId: string | null }
  | { type: 'add-split'; orientation?: 'horizontal' | 'vertical'; url?: string; tabId?: string }
  | { type: 'close-split-pane' }
  | { type: 'expand-split' }
  | { type: 'focus-split-index'; index: number }
  | { type: 'set-split-weights'; id: string; weights: number[] }
  | { type: 'divider-drag'; id: string; index: number; delta: number }
  | { type: 'toggle-split-orientation' }
  | { type: 'new-note'; split?: boolean }
  | { type: 'new-easel'; split?: boolean }
  | { type: 'update-note'; id: string; body?: string; title?: string }
  | { type: 'update-easel'; id: string; doc: EaselDoc }
  | { type: 'toggle-sidebar' }
  | { type: 'sidebar-peek'; on: boolean }
  | { type: 'set-sidebar-width'; width: number }
  | { type: 'open-command'; mode?: 'new' | 'edit' }
  | { type: 'close-overlay' }
  | { type: 'little-arc'; url?: string }
  | { type: 'open-in-cove' }
  | { type: 'new-window'; blank?: boolean }
  | { type: 'incognito' }
  | { type: 'close-window' }
  | { type: 'find-open' }
  | { type: 'find'; text: string; forward?: boolean }
  | { type: 'find-close' }
  | { type: 'zoom'; dir: 'in' | 'out' | 'reset' }
  | { type: 'capture'; full?: boolean }
  | { type: 'translate' }
  | { type: 'print' }
  | { type: 'devtools' }
  | { type: 'mute'; id?: string }
  | { type: 'media'; op: 'toggle' | 'pip' }
  | { type: 'toggle-live'; id?: string }
  | { type: 'update-settings'; patch: Partial<Settings> }
  | { type: 'update-membership'; patch: Partial<Membership> }
  | { type: 'set-binding'; command: string; accelerator: string }
  | { type: 'reset-shortcuts' }
  | { type: 'import-arc' }
  | { type: 'export-library' }
  | { type: 'import-library' }
  | { type: 'import-bookmarks' }
  | { type: 'import-passwords' }
  | { type: 'export-passwords' }
  | { type: 'delete-password'; id: string }
  | { type: 'fill-password'; id: string }
  | { type: 'save-pending-password'; id: string }
  | { type: 'dismiss-password'; id: string; never?: boolean }
  | { type: 'load-extension' }
  | { type: 'remove-extension'; id: string }
  | { type: 'set-permission'; origin: string; perm: string; value: PermChoice }
  | { type: 'clear-site-data'; origin?: string }
  | { type: 'save-boost'; boost: Boost }
  | { type: 'delete-boost'; id: string }
  | { type: 'open-page'; page: string }
  | { type: 'peek'; url: string }
  | { type: 'preview-tab'; id: string; x: number; y: number }
  | { type: 'hide-preview' }
  | { type: 'download-action'; id: string; op: 'cancel' | 'open' | 'show' | 'dismiss' }
  | { type: 'new-profile'; name: string }
  | { type: 'delete-profile'; id: string }
  | { type: 'go-tab-index'; index: number }
  | { type: 'focus-space-index'; index: number }
  | { type: 'cycle-tab'; delta: number }
  | { type: 'commit-switcher' }
  | { type: 'cancel-switcher' }
  | { type: 'cycle-space'; delta: number }
  | { type: 'cycle-sidebar'; delta: number }
  | { type: 'home' }
  | { type: 'select-download-folder' }
  | { type: 'select-sync-folder' }
  | { type: 'clear-sync-folder' }
  | { type: 'sync-now' }
  | { type: 'block-domain'; host: string }
  | { type: 'unblock-domain'; host: string }
  | { type: 'clear-history' }
  | { type: 'clear-cache' }
  | { type: 'clear-cookies' }
  | { type: 'make-default-browser' }
  | { type: 'open-file' }
  | { type: 'join-call' }
  | { type: 'menu-tab'; id: string }
  | { type: 'menu-space'; id: string }
  | { type: 'open-site-panel' }
  | { type: 'auth-reply'; username: string; password: string; cancel?: boolean }
  | { type: 'allow-insecure' }
  | { type: 'library-query'; section: string; query: string; offset: number }
  | { type: 'quit' };

export interface Result {
  id: string;
  title: string;
  subtitle: string;
  kind: 'command' | 'tab' | 'history' | 'archive' | 'space' | 'search' | 'url' | 'password';
  action: Action;
}

export interface PageInfo {
  greeting: string;
  spaceName: string;
  searchEngine: SearchEngine;
  arcAvailable: boolean;
  incognito: boolean;
  favorites: { id: string; title: string; url: string; favicon: string }[];
  topSites: { title: string; url: string }[];
  theme: Theme;
  currentHost: string;
}

export interface LibRow {
  id: string;
  title: string;
  url: string;
  at: number;
  space: string;
  kind: string;
}

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  path: string;
}

export interface PasswordMeta {
  id: string;
  origin: string;
  username: string;
}

export interface CommandInfo {
  id: string;
  title: string;
  accelerator: string;
  group: string;
}
