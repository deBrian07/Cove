import type { Input } from 'electron';
import { COMMANDS, acceleratorFor } from '../shared/commands';

const KEY_MAP: Record<string, string> = {
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  escape: 'escape',
  esc: 'escape',
  ' ': 'space',
  plus: '=',
  minus: '-',
  return: 'enter',
};

export function keyToken(input: Input): string {
  const parts: string[] = [];
  if (input.meta) parts.push('meta');
  if (input.control) parts.push('ctrl');
  if (input.alt) parts.push('alt');
  if (input.shift) parts.push('shift');
  parts.push(normalizeKey(input.key));
  return parts.join('+');
}

export function accelToken(accel: string): string {
  if (!accel) return '';
  const bits = accel.split('+').map((p) => p.trim().toLowerCase());
  const key = bits.pop() || '';
  let meta = false;
  let ctrl = false;
  let alt = false;
  let shift = false;
  for (const bit of bits) {
    if (bit === 'commandorctrl' || bit === 'cmdorctrl' || bit === 'mod') {
      if (process.platform === 'darwin') meta = true;
      else ctrl = true;
    } else if (bit === 'command' || bit === 'cmd' || bit === 'meta') meta = true;
    else if (bit === 'control' || bit === 'ctrl') ctrl = true;
    else if (bit === 'alt' || bit === 'option') alt = true;
    else if (bit === 'shift') shift = true;
  }
  const parts: string[] = [];
  if (meta) parts.push('meta');
  if (ctrl) parts.push('ctrl');
  if (alt) parts.push('alt');
  if (shift) parts.push('shift');
  parts.push(normalizeKey(key));
  return parts.join('+');
}

export function normalizeKey(key: string): string {
  const k = key.toLowerCase();
  return KEY_MAP[k] || k;
}

export function bindingMap(overrides: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  const ids = new Set<string>(Object.keys(overrides));
  for (const command of COMMANDS) ids.add(command.id);
  for (const id of ids) {
    const accel = acceleratorFor(id, overrides);
    const token = accelToken(accel);
    if (token) map.set(token, id);
  }
  return map;
}
