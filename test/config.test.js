import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadConfig,
  saveConfig,
  validateConfig,
  DEFAULT_CONFIG,
} from '../src/config.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'cwn-cfg-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('loadConfig: missing file returns defaults with ok:false', async () => {
  await withTempDir(async (dir) => {
    const r = await loadConfig(join(dir, 'nope.json'));
    assert.equal(r.ok, false);
    assert.equal(r.config.ntfy.server, DEFAULT_CONFIG.ntfy.server);
    assert.equal(r.config.filters.minDurationSeconds, 30);
  });
});

test('loadConfig: invalid JSON returns defaults with ok:false', async () => {
  await withTempDir(async (dir) => {
    const p = join(dir, 'bad.json');
    await writeFile(p, '{ not json');
    const r = await loadConfig(p);
    assert.equal(r.ok, false);
    assert.match(r.reason, /JSON/);
  });
});

test('loadConfig: deep-merges user config with defaults', async () => {
  await withTempDir(async (dir) => {
    const p = join(dir, 'cfg.json');
    await writeFile(
      p,
      JSON.stringify({
        ntfy: { topic: 'mine' },
        filters: { minDurationSeconds: 5 },
      }),
    );
    const r = await loadConfig(p);
    assert.equal(r.ok, true);
    assert.equal(r.config.ntfy.topic, 'mine');
    assert.equal(r.config.ntfy.server, 'https://ntfy.sh');
    assert.equal(r.config.filters.minDurationSeconds, 5);
    assert.deepEqual(r.config.filters.events, ['Stop', 'Notification']);
  });
});

test('loadConfig: missing topic fails validation', async () => {
  await withTempDir(async (dir) => {
    const p = join(dir, 'cfg.json');
    await writeFile(p, JSON.stringify({ ntfy: { server: 'https://x' } }));
    const r = await loadConfig(p);
    assert.equal(r.ok, false);
    assert.match(r.reason, /topic/);
  });
});

test('saveConfig: writes parseable JSON', async () => {
  await withTempDir(async (dir) => {
    const p = join(dir, 'cfg.json');
    const cfg = { ntfy: { topic: 't', server: 'https://ntfy.sh' } };
    await saveConfig(cfg, p);
    const r = await loadConfig(p);
    assert.equal(r.ok, true);
    assert.equal(r.config.ntfy.topic, 't');
  });
});

test('validateConfig: rejects when ntfy section missing', () => {
  const r = validateConfig({});
  assert.equal(r.ok, false);
});

