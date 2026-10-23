import type { Action, LibRow, Result, Snapshot } from './types';

export interface CommandPayload {
  appearance?: 'light' | 'dark';
  query: string;
  mode: 'new' | 'edit';
  select: boolean;
}

/** The isolated preload API shared by the browser chrome renderers. */
export interface CoveBridge {
  snapshot(): Promise<Snapshot>;
  dispatch(action: Action): Promise<unknown>;
  search(query: string, mode: 'new' | 'edit'): Promise<Result[]>;
  boot(): Promise<unknown>;
  library(section: string, query: string, offset: number): Promise<{ rows: LibRow[]; total: number }>;
  onSnapshot(cb: (snapshot: Snapshot) => void): () => void;
  onCommand(cb: (payload: CommandPayload) => void): () => void;
  onOverlay(cb: (payload: Record<string, unknown>) => void): () => void;
}
