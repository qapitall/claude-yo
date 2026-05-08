import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  arm,
  disarm,
  isArmed,
  readArmState,
} from '../src/armState.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'cwn-arm-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('arm: writes file with timestamp and message', async () => {
  await withTempDir(async (dir) => {
    const p = join(dir, '.armed');
    await arm('hello', p);
    assert.equal(await isArmed(p), true);
    const state = await readArmState(p);
    assert.ok(state);
    assert.equal(state.message, 'hello');
    assert.match(state.armedAt, /^\d{4}-\d{2}-\d{2}T/);
  });
});

test('disarm: removes file, returns true', async () => {
  await withTempDir(async (dir) => {
    const p = join(dir, '.armed');
    await arm('', p);
    assert.equal(await disarm(p), true);
    assert.equal(await isArmed(p), false);
  });
});

test('disarm: returns false when nothing to remove', async () => {
  await withTempDir(async (dir) => {
    const p = join(dir, '.armed');
    assert.equal(await disarm(p), false);
  });
});

test('isArmed: false when file missing', async () => {
  await withTempDir(async (dir) => {
    assert.equal(await isArmed(join(dir, '.armed')), false);
  });
});

test('readArmState: returns null when missing or unparseable', async () => {
  await withTempDir(async (dir) => {
    assert.equal(await readArmState(join(dir, 'nope')), null);
  });
});
