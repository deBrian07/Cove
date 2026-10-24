import { contextBridge, ipcRenderer } from 'electron';
import type { CoveBridge } from '../shared/bridge';

const api: CoveBridge = {
  snapshot: () => ipcRenderer.invoke('cove:snapshot'),
  dispatch: (action: unknown) => ipcRenderer.invoke('cove:dispatch', action),
  setCommandResultCount: (count: number) => ipcRenderer.send('cove:command-size', count),
  search: (query: string, mode: 'new' | 'edit') => ipcRenderer.invoke('cove:search', query, mode),
  boot: () => ipcRenderer.invoke('cove:boot'),
  library: (section: string, query: string, offset: number) => ipcRenderer.invoke('cove:library', section, query, offset),
  onSnapshot: (cb) => subscribe('cove:snapshot', cb),
  onCommand: (cb) => subscribe('cove:command', cb),
  onOverlay: (cb) => subscribe('cove:overlay', cb),
};

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('cove', api);
