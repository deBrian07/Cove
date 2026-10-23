import { contextBridge, ipcRenderer } from 'electron';

const api = {
  snapshot: () => ipcRenderer.invoke('cove:snapshot'),
  dispatch: (action: unknown) => ipcRenderer.invoke('cove:dispatch', action),
  search: (query: string, mode: 'new' | 'edit') => ipcRenderer.invoke('cove:search', query, mode),
  boot: () => ipcRenderer.invoke('cove:boot'),
  library: (section: string, query: string, offset: number) => ipcRenderer.invoke('cove:library', section, query, offset),
  onSnapshot: (cb: (snapshot: unknown) => void) => subscribe('cove:snapshot', cb),
  onCommand: (cb: (payload: unknown) => void) => subscribe('cove:command', cb),
  onOverlay: (cb: (payload: unknown) => void) => subscribe('cove:overlay', cb),
};

function subscribe(channel: string, cb: (payload: unknown) => void): () => void {
  const listener = (_event: unknown, payload: unknown) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('cove', api);
