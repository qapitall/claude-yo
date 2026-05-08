import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import {
  planInstall,
  installHooks,
  HOOK_EVENTS,
} from '../src/hookInstaller.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'cwn-hooks-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function captureStream() {
  const chunks = [];
  const w = new Writable({
    write(c, _e, cb) {
      chunks.push(c.toString());
      cb();
    },
  });
  w.read = () => chunks.join('');
  return w;
}

test('planInstall: empty settings → adds Stop and Notification', () => {
  const { next, changes } = planInstall({});
  assert.equal(changes.length, 2);
  assert.equal(
    changes.filter((c) => c.action === 'added').length,
    2,
  );
  for (const ev of HOOK_EVENTS) {
    assert.ok(Array.isArray(next.hooks[ev]));
    assert.equal(next.hooks[ev].length, 1);
    assert.match(next.hooks[ev][0].hooks[0].command, /claude-watch-notify/);
  }
});

test('planInstall: existing claude-watch hooks are kept (idempotent)', () => {
  const existing = {
    hooks: {
      Stop: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'command',
              command: 'claude-watch-notify --event Stop',
              timeout: 8,
            },
          ],
        },
      ],
    },
  };
  const { changes, next } = planInstall(existing);
  const stopChange = changes.find((c) => c.event === 'Stop');
  assert.equal(stopChange.action, 'kept');
  assert.equal(next.hooks.Stop.length, 1);
});

test('planInstall: preserves unrelated existing hooks', () => {
  const existing = {
    hooks: {
      Stop: [
        {
          matcher: '*',
          hooks: [
            { type: 'command', command: 'echo other', timeout: 5 },
          ],
        },
      ],
    },
  };
  const { next } = planInstall(existing);
  // Both the existing one and the new claude-watch-notify entry exist.
  assert.equal(next.hooks.Stop.length, 2);
  assert.equal(next.hooks.Stop[0].hooks[0].command, 'echo other');
  assert.match(next.hooks.Stop[1].hooks[0].command, /claude-watch-notify/);
});

test('installHooks: writes file when missing and confirm returns true', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'settings.json');
    const out = captureStream();
    const result = await installHooks({
      path,
      confirm: async () => true,
      out,
      err: captureStream(),
    });
    assert.equal(result.ok, true);
    assert.equal(result.changed, true);
    const written = JSON.parse(await readFile(path, 'utf8'));
    assert.ok(Array.isArray(written.hooks.Stop));
    assert.ok(Array.isArray(written.hooks.Notification));
  });
});

test('installHooks: aborts when confirm returns false', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'settings.json');
    const out = captureStream();
    const result = await installHooks({
      path,
      confirm: async () => false,
      out,
      err: captureStream(),
    });
    assert.equal(result.ok, false);
    // file should not exist
    let exists = true;
    try {
      await readFile(path);
    } catch {
      exists = false;
    }
    assert.equal(exists, false);
  });
});

test('installHooks: idempotent — second run reports nothing to do', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'settings.json');
    await installHooks({
      path,
      confirm: async () => true,
      out: captureStream(),
      err: captureStream(),
    });
    const out = captureStream();
    const r2 = await installHooks({
      path,
      confirm: async () => true,
      out,
      err: captureStream(),
    });
    assert.equal(r2.ok, true);
    assert.equal(r2.changed, false);
    assert.match(out.read(), /already installed/);
  });
});

test('installHooks: backs up existing file before overwriting', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'settings.json');
    await writeFile(path, '{"existingKey":42}');
    await installHooks({
      path,
      confirm: async () => true,
      out: captureStream(),
      err: captureStream(),
    });
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(dir);
    const backup = files.find((f) => f.startsWith('settings.json.backup-'));
    assert.ok(backup, 'backup should exist');
    const bkContent = JSON.parse(await readFile(join(dir, backup), 'utf8'));
    assert.equal(bkContent.existingKey, 42);
  });
});

test('installHooks: malformed JSON in existing file is reported', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'settings.json');
    await writeFile(path, '{ not json');
    const err = captureStream();
    const r = await installHooks({
      path,
      confirm: async () => true,
      out: captureStream(),
      err,
    });
    assert.equal(r.ok, false);
    assert.match(err.read(), /✗/);
  });
});
