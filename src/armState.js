import { readFile, writeFile, unlink, stat, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_ARM_PATH = join(homedir(), '.claude-yo.armed');

export async function arm(message = '', path = DEFAULT_ARM_PATH) {
  const payload = JSON.stringify(
    { armedAt: new Date().toISOString(), message: message ?? '' },
    null,
    2,
  );
  await writeFile(path, payload + '\n', 'utf8');
  // Other local users shouldn't be able to read user-supplied arm messages
  // (no-op on Windows; safe to ignore failures).
  await chmod(path, 0o600).catch(() => {});
  return path;
}

export async function disarm(path = DEFAULT_ARM_PATH) {
  try {
    await unlink(path);
    return true;
  } catch (err) {
    if (err && err.code === 'ENOENT') return false;
    throw err;
  }
}

export async function isArmed(path = DEFAULT_ARM_PATH) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function readArmState(path = DEFAULT_ARM_PATH) {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
