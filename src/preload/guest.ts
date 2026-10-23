import { contextBridge, ipcRenderer } from 'electron';

const page = {
  boot: () => ipcRenderer.invoke('cove:boot'),
  act: (action: unknown) => ipcRenderer.invoke('cove:dispatch', action),
  library: (section: string, query: string, offset: number) => ipcRenderer.invoke('cove:library', section, query, offset),
};

contextBridge.exposeInMainWorld('covePage', page);

window.addEventListener('DOMContentLoaded', () => {
  if (window.location.protocol === 'cove:') return;
  document.addEventListener(
    'click',
    (event) => {
      if (!event.isTrusted || !event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
      const href = anchor?.href;
      if (!href || !/^https?:/i.test(href)) return;
      event.preventDefault();
      event.stopPropagation();
      ipcRenderer.send('cove:guest', { type: 'peek', url: href });
    },
    true,
  );

  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;
      const password = form.querySelector('input[type="password"]') as HTMLInputElement | null;
      if (!password?.value) return;
      const fields = [...form.querySelectorAll('input')] as HTMLInputElement[];
      const user = fields.find((input) => {
        if (input === password || input.type === 'password' || input.type === 'hidden') return false;
        const hint = `${input.type} ${input.name} ${input.id} ${input.autocomplete}`.toLowerCase();
        return hint.includes('user') || hint.includes('email') || input.type === 'email' || input.type === 'text';
      });
      ipcRenderer.send('cove:guest', {
        type: 'password-form',
        origin: window.location.origin,
        username: user?.value || '',
        password: password.value,
      });
    },
    true,
  );
});
