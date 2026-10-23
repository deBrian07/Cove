import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { app, BrowserWindow, WebContentsView } from 'electron';
import { Cove } from '../src/main/cove';
import { Store } from '../src/main/store';
import { handleCoveProtocol, registerCoveScheme } from '../src/main/protocol';
import type { Snapshot } from '../src/shared/types';

registerCoveScheme();
const profile = mkdtempSync(join(tmpdir(), 'cove-ui-check-'));
app.setPath('userData', profile);
const pause = (ms = 70) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check: () => Promise<boolean>, message: string) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await pause(); }
  throw new Error(`Timed out: ${message}`);
}

app.whenReady().then(async () => {
  try {
    app.setName('Cove UI check');
    handleCoveProtocol(__dirname, join(profile, 'favicons'));
    const server = createServer((_request, response) => { response.setHeader('Content-Type', 'text/html'); response.end('<title>UI check site</title><h1>Browser test page</h1>'); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    const testUrl = `http://127.0.0.1:${address.port}/`;
    const store = new Store();
    const cove = new Cove(store);
    cove.start();
    const win = cove.focused()!;
    const evaluate = <T>(code: string): Promise<T> => win.shell.webContents.executeJavaScript(code);
    await until(() => evaluate<boolean>('Boolean(document.querySelector(".row"))').catch(() => false), 'shell ready');
    const snapshot = () => evaluate<Snapshot>('window.cove.snapshot()');
    const create = async (title: string) => {
      await cove.run({ type: 'commit-omnibox', query: 'cove://app/newtab', target: 'new' });
      const id = (await snapshot()).activeTabId!;
      await cove.run({ type: 'rename-item', id, title });
      return id;
    };
    const favorite = await create('Calendar');
    await cove.run({ type: 'favorite', id: favorite });
    const pinned = await create('Design references');
    await cove.run({ type: 'pin', id: pinned });
    const first = await create('Reading list');
    const second = await create('Notes for today');
    await until(() => evaluate<boolean>('document.querySelector(".pinned-tabs")?.textContent.includes("Design references") && document.querySelector(".today-tabs")?.textContent.includes("Notes for today")'), 'tab sections');
    assert.equal(await evaluate<number>('document.querySelectorAll(".essential").length'), 1);
    assert.equal(await evaluate<string>('document.querySelector(".tab-divider").nextElementSibling.className'), 'today-tabs');
    assert.equal(await evaluate<number>('document.querySelectorAll("#topbar button").length'), 4);
    // Navigation exposes the actual address, and clicking it edits this tab.
    await cove.run({ type: 'commit-omnibox', query: testUrl, target: 'new' });
    const website = (await snapshot()).activeTabId!;
    await until(() => evaluate<boolean>('document.querySelector(".address-label").textContent === "127.0.0.1"'), 'current address');
    await evaluate('document.querySelector("#search").click()');
    await until(async () => BrowserWindow.getAllWindows().some((window) => window.webContents.getURL().includes('command.html')), 'address editor');
    const addressEditor = BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().includes('command.html'))!;
    await until(() => addressEditor.webContents.executeJavaScript(`document.querySelector('#query').value === ${JSON.stringify(testUrl)}`).catch(() => false), 'edit URL payload');
    await cove.run({ type: 'close-overlay' });
    await cove.run({ type: 'activate-tab', id: second });
    await pause();
    // Rename editing survives unrelated snapshots.
    await evaluate(`document.querySelector('[data-id="${second}"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
    await until(() => evaluate<boolean>('document.activeElement?.classList.contains("rename")'), 'rename focus');
    await evaluate('document.querySelector(".rename").value = "Unfinished rename"');
    await cove.run({ type: 'set-sidebar-width', width: 310 });
    await pause();
    assert.equal(await evaluate<string>('document.querySelector(".rename").value'), 'Unfinished rename');
    await evaluate('document.querySelector(".rename").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))');
    // Native page geometry stays fixed while the hidden sidebar peeks over it.
    await cove.run({ type: 'toggle-sidebar' });
    const page = win.win.contentView.children.find((view) => view !== win.shell && view instanceof WebContentsView && view.getVisible()) as WebContentsView;
    await until(() => evaluate<boolean>('document.body.classList.contains("collapsed")'), 'collapsed renderer');
    const collapsed = page.getBounds();
    assert.equal(collapsed.x, 8);
    await evaluate('document.dispatchEvent(new MouseEvent("mousemove", { clientX: 1, bubbles: true }))');
    await until(async () => (await snapshot()).sidebarPeek, 'edge hover peek');
    assert.deepEqual(page.getBounds(), collapsed);
    assert.equal(win.win.contentView.children.at(-1), win.shell);
    assert.equal(win.shell.getBounds().width, 310);
    await evaluate('document.documentElement.dispatchEvent(new MouseEvent("mouseleave"))');
    await until(async () => !(await snapshot()).sidebarPeek, 'peek dismiss');
    assert.equal(win.win.contentView.children[0], win.shell);
    await cove.run({ type: 'toggle-sidebar' });
    assert.equal(page.getBounds().x, 310);
    assert.equal(page.getBounds().y, 8);
    assert.equal(page.getBounds().height, win.win.getContentSize()[1] - 16);
    // Move between the visible sections and reorder without losing the tab.
    await cove.run({ type: 'reorder', id: second, beforeId: pinned, parentId: null, section: 'pinned' });
    assert.deepEqual((await snapshot()).pinned.map((row) => row.id), [second, pinned]);
    await cove.run({ type: 'reorder', id: second, beforeId: first, parentId: null, section: 'today' });
    assert.ok((await snapshot()).today.findIndex((row) => row.id === second) < (await snapshot()).today.findIndex((row) => row.id === first));
    await until(() => evaluate<boolean>(`document.querySelector('.today-tabs [data-id="${second}"]')?.parentElement.nextElementSibling?.querySelector('.row')?.dataset.id === '${first}'`), 'rendered tab order');
    await evaluate(`(() => {
      const target = document.querySelector('[data-id="${second}"]');
      const rect = target.getBoundingClientRect();
      const transfer = new DataTransfer(); transfer.setData('text/plain', '${website}');
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: rect.left + 12, clientY: rect.bottom - 2 }));
    })()`);
    await until(async () => { const rows = (await snapshot()).today; return rows.findIndex((row) => row.id === website) === rows.findIndex((row) => row.id === second) + 1; }, 'drop immediately below a tab');
    await cove.run({ type: 'new-folder', name: 'Projects' });
    const folder = store.library.items.find((item) => item.kind === 'folder')!;
    await cove.run({ type: 'reorder', id: folder.id, beforeId: null, parentId: folder.id, section: 'pinned' });
    assert.equal(folder.parentId, null);
    // Editor dismissal and command keyboard selection run against real renderers.
    await cove.run({ type: 'new-space' });
    await until(() => evaluate<boolean>('!document.querySelector("#editor").hidden'), 'space editor');
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))');
    await until(() => evaluate<boolean>('document.querySelector("#editor").hidden'), 'editor dismissal');
    await cove.run({ type: 'open-command', mode: 'new' });
    await until(async () => BrowserWindow.getAllWindows().some((window) => window.webContents.getURL().includes('command.html')), 'command window');
    const command = BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().includes('command.html'))!;
    await until(() => command.webContents.executeJavaScript('document.querySelectorAll(".result").length > 0').catch(() => false), 'command results');
    await until(() => command.webContents.executeJavaScript('document.activeElement.id === "query"'), 'command focus');
    await command.webContents.executeJavaScript('document.querySelector("#query").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))');
    assert.equal(await command.webContents.executeJavaScript('document.querySelector("#query").getAttribute("aria-activedescendant")'), 'result-1');
    await pause(200);
    if (process.env.COVE_UI_SCREENSHOTS) writeFileSync('/tmp/cove-command.png', (await command.webContents.capturePage()).toPNG());
    // Selecting a tab must dismiss the native palette, not rely on blur.
    await command.webContents.executeJavaScript('document.querySelector("#query").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))');
    await until(async () => !command.isVisible(), 'palette closes after tab selection');
    const submit = async (target: 'new' | 'edit', method: 'keyboard' | 'mouse') => {
      await cove.run({ type: 'open-command', mode: target });
      const url = `${testUrl}?palette=${target}`;
      await until(() => command.webContents.executeJavaScript('document.activeElement.id === "query"'), 'reopened palette focus');
      await command.webContents.executeJavaScript(`(() => {
        const input = document.querySelector('#query'); input.value = ${JSON.stringify(url)};
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await until(() => command.webContents.executeJavaScript(`document.querySelector('.result .title')?.textContent === ${JSON.stringify(`Open ${url}`)}`), 'URL suggestion');
      const before = (await snapshot()).activeTabId;
      await command.webContents.executeJavaScript(method === 'keyboard'
        ? 'document.querySelector("#query").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))'
        : 'document.querySelector(".result").dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }))');
      await until(async () => !command.isVisible(), `palette closes after ${target} ${method}`);
      await until(async () => (await snapshot()).url === url, 'submitted URL navigates');
      if (target === 'edit') assert.equal((await snapshot()).activeTabId, before);
      else assert.notEqual((await snapshot()).activeTabId, before);
      const active = win.win.contentView.children.find((view) => view !== win.shell && view instanceof WebContentsView && view.getVisible()) as WebContentsView;
      await until(async () => active.webContents.isFocused(), 'page regains keyboard focus');
    };
    await submit('new', 'keyboard');
    await submit('edit', 'mouse');
    // Enter before suggestions arrive uses the same dismissal path.
    await cove.run({ type: 'open-command', mode: 'new' });
    await until(() => command.webContents.executeJavaScript('document.activeElement.id === "query"'), 'raw query focus');
    await command.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('#query'); input.value = 'cove://app/newtab?palette=raw';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    })()`);
    await until(async () => !command.isVisible(), 'palette closes before suggestions arrive');
    await until(async () => (await snapshot()).url === 'cove://app/newtab?palette=raw', 'raw query navigates');
    await cove.run({ type: 'activate-tab', id: second });
    await cove.run({ type: 'update-space', id: win.spaceId, appearance: 'dark' });
    await pause(250);
    if (process.env.COVE_UI_SCREENSHOTS) execFileSync('screencapture', ['-x', '-o', '-l', win.win.getMediaSourceId().split(':')[1], '/tmp/cove-ui-dark.png']);
    await cove.run({ type: 'update-space', id: win.spaceId, appearance: 'light' });
    await pause();
    assert.equal(await evaluate<string>('document.body.dataset.appearance'), 'light');
    assert.equal(await page.webContents.executeJavaScript('document.body.classList.contains("dark")'), false);
    await cove.run({ type: 'open-command', mode: 'new' });
    await until(() => command.webContents.executeJavaScript('document.documentElement.dataset.appearance === "light"'), 'light command theme');
    await cove.run({ type: 'close-overlay' });
    await pause(250);
    if (process.env.COVE_UI_SCREENSHOTS) execFileSync('screencapture', ['-x', '-o', '-l', win.win.getMediaSourceId().split(':')[1], '/tmp/cove-ui-light.png']);
    console.log('PASS: native geometry, floating sidebar, tab sections, reorder, folder safety, rename, editor, command keyboard, light theme');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
app.on('quit', () => rmSync(profile, { recursive: true, force: true }));
