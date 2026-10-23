import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the bundled renderer with a small DOM/IPC double. Native focus,
// painting and window behavior still need an Electron smoke test.
class Element {
  constructor(tag = 'div') {
    this.tag = tag;
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.value = '';
    this.className = '';
    this.scrollTop = 0;
    this.scrolled = false;
    this.classList = {
      add: (name) => { this.className = [...new Set([...this.className.split(' '), name])].join(' '); },
      remove: (name) => { this.className = this.className.split(' ').filter((entry) => entry !== name).join(' '); },
    };
  }
  append(...nodes) {
    this.children.push(...nodes.flatMap((node) => node.tag === 'fragment' ? node.children : [node]));
  }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector(selector) { return this.children.find((node) => node.className.split(' ').includes(selector.slice(1))); }
  focus() {}
  select() {}
  scrollIntoView() { this.scrolled = true; }
  emit(name, event = {}) { this.listeners.get(name)?.(event); }
}

const input = new Element('input');
const list = new Element();
const requests = [];
const actions = [];
let openCommand;
const document = {
  documentElement: { dataset: {} },
  querySelector: (selector) => selector === '#query' ? input : list,
  createElement: (tag) => new Element(tag),
  createDocumentFragment: () => new Element('fragment'),
};
const window = {
  cove: {
    search: (query) => new Promise((resolve) => requests.push({ query, resolve })),
    dispatch: (action) => actions.push(action),
    onCommand: (listener) => { openCommand = listener; },
  },
};
const source = readFileSync(new URL('../dist/command.js', import.meta.url), 'utf8');
vm.runInNewContext(source, { document, window }, { filename: 'command.js' });
const flush = () => new Promise((resolve) => setImmediate(resolve));
const suggestion = (title) => ({
  id: title,
  title,
  subtitle: `https://${title}.example`,
  kind: 'url',
  action: { type: 'commit-omnibox', query: title, target: 'new' },
});
const key = (name, modifiers = {}) => input.emit('keydown', {
  key: name, preventDefault() {}, metaKey: false, altKey: false, ...modifiers,
});
const type = (query) => { input.value = query; input.emit('input'); };
const titleOf = (row) => row.children[1].children[0].textContent;

openCommand({ query: 'first', mode: 'new', select: false });
type('second');
requests[1].resolve([suggestion('second')]);
await flush();
requests[0].resolve([suggestion('first')]);
await flush();
assert.equal(titleOf(list.children[0]), 'second', 'An older response must not replace the newest query');
assert.equal(input.attributes.get('aria-activedescendant'), 'result-0');
assert.equal(list.children[0].attributes.get('role'), 'option');
assert.equal(list.children[0].attributes.get('aria-selected'), 'true');
assert.equal(list.attributes.get('aria-busy'), 'false');

const previousRow = list.children[0];
previousRow.emit('mousemove');
assert.equal(list.children[0], previousRow, 'Hover must preserve the result DOM');

type('third');
assert.equal(input.attributes.has('aria-activedescendant'), false, 'Pending searches must clear the active result');
assert.equal(list.attributes.get('aria-busy'), 'true');
previousRow.emit('mousedown', { preventDefault() {}, metaKey: false, altKey: false });
assert.equal(actions.length, 0, 'A visible result from the previous query must not be clickable');
key('ArrowDown');
key('Enter');
assert.equal(actions.at(-1).query, 'third', 'Enter during a pending search must use the current input');
requests[2].resolve([suggestion('third'), suggestion('fourth')]);
await flush();

const rows = [...list.children];
key('ArrowUp');
assert.equal(input.attributes.get('aria-activedescendant'), 'result-1', 'Up should wrap to the last result');
assert.equal(rows[1].scrolled, true, 'Keyboard selection must scroll the result into view');
assert.equal(rows[0].attributes.get('aria-selected'), 'false');
assert.equal(rows[1].attributes.get('aria-selected'), 'true');
key('ArrowDown');
assert.equal(input.attributes.get('aria-activedescendant'), 'result-0', 'Down should wrap to the first result');
rows[1].emit('mousemove');
assert.equal(list.children[1], rows[1], 'Hover selection must not rebuild neighboring rows');
assert.equal(input.attributes.get('aria-activedescendant'), 'result-1');

input.emit('compositionstart');
key('Enter');
assert.equal(actions.length, 1, 'IME composition Enter must not activate a suggestion');
input.emit('compositionend');
requests[3].resolve([suggestion('third')]);
await flush();
key('Enter', { isComposing: true });
assert.equal(actions.length, 1, 'A native composing key event must not activate a suggestion');

console.log('Command checks passed: stale responses, stable hover, pending Enter/clicks, keyboard wrapping/scroll, IME, ARIA selection.');
