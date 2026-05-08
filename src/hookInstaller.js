import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const DEFAULT_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

export const HOOK_EVENTS = ['Stop', 'Notification'];

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function buildHookEntry(eventName) {
  return {
    matcher: '*',
    hooks: [
      {
        type: 'command',
        command: `claude-watch-notify --event ${eventName}`,
        timeout: 8,
      },
    ],
  };
}

function entryAlreadyInstalled(matcherEntry) {
  if (!isPlainObject(matcherEntry)) return false;
  const hooks = Array.isArray(matcherEntry.hooks) ? matcherEntry.hooks : [];
  return hooks.some(
    (h) =>
      isPlainObject(h) &&
      typeof h.command === 'string' &&
      h.command.includes('claude-watch-notify'),
  );
}

export function planInstall(existingSettings) {
  const settings = isPlainObject(existingSettings)
    ? JSON.parse(JSON.stringify(existingSettings))
    : {};
  if (!isPlainObject(settings.hooks)) settings.hooks = {};
  const changes = [];

  for (const ev of HOOK_EVENTS) {
    const list = Array.isArray(settings.hooks[ev]) ? settings.hooks[ev] : [];
    const alreadyHas = list.some(entryAlreadyInstalled);
    if (alreadyHas) {
      changes.push({ event: ev, action: 'kept', reason: 'already installed' });
      settings.hooks[ev] = list;
    } else {
      settings.hooks[ev] = [...list, buildHookEntry(ev)];
      changes.push({ event: ev, action: 'added' });
    }
  }
  return { next: settings, changes };
}

export function diffPreview(prev, next) {
  const a = JSON.stringify(prev ?? {}, null, 2);
  const b = JSON.stringify(next ?? {}, null, 2);
  if (a === b) return '(no changes)';
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  // Tiny line-by-line diff: rather than a real LCS, we just show before/after.
  return [
    '--- before',
    a,
    '+++ after',
    b,
    `(${Math.abs(bLines.length - aLines.length)} line(s) of difference)`,
  ].join('\n');
}

async function readSettings(path) {
  try {
    const raw = await readFile(path, 'utf8');
    if (raw.trim() === '') return { ok: true, settings: {}, exists: true };
    return { ok: true, settings: JSON.parse(raw), exists: true };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return { ok: true, settings: {}, exists: false };
    }
    return { ok: false, reason: err?.message ?? 'unknown read error' };
  }
}

async function backup(path) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${path}.backup-${stamp}`;
  try {
    await copyFile(path, backupPath);
    return backupPath;
  } catch {
    return null;
  }
}

export async function installHooks({
  path = DEFAULT_SETTINGS_PATH,
  confirm,
  out = process.stdout,
  err = process.stderr,
} = {}) {
  const read = await readSettings(path);
  if (!read.ok) {
    err.write(`✗ cannot read ${path}: ${read.reason}\n`);
    return { ok: false, reason: read.reason };
  }
  const { next, changes } = planInstall(read.settings);

  out.write(`Settings file: ${path}\n`);
  if (!read.exists) out.write(`(file does not exist yet — will be created)\n`);
  out.write('\nPlanned changes:\n');
  for (const c of changes) {
    out.write(
      `  - ${c.event}: ${c.action}${c.reason ? ` (${c.reason})` : ''}\n`,
    );
  }

  const allKept = changes.every((c) => c.action === 'kept');
  if (allKept) {
    out.write(`\n✓ Hooks already installed; nothing to do.\n`);
    return { ok: true, changed: false };
  }

  out.write('\nDiff:\n');
  out.write(diffPreview(read.settings, next) + '\n\n');

  if (typeof confirm === 'function') {
    const yes = await confirm();
    if (!yes) {
      out.write('aborted; nothing written.\n');
      return { ok: false, reason: 'user declined' };
    }
  }

  if (read.exists) {
    const bk = await backup(path);
    if (bk) out.write(`backup written to ${bk}\n`);
  } else {
    await mkdir(dirname(path), { recursive: true });
  }

  await writeFile(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
  out.write(`✓ wrote ${path}\n`);
  return { ok: true, changed: true };
}
