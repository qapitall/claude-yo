import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const DEFAULT_CONFIG_PATH = join(
  homedir(),
  '.claude-watch-notify.json',
);

export const DEFAULT_CONFIG = Object.freeze({
  ntfy: {
    topic: null,
    server: 'https://ntfy.sh',
    authToken: null,
  },
  filters: {
    minDurationSeconds: 30,
    events: ['Stop', 'Notification'],
  },
  quietHours: {
    enabled: false,
    start: '23:00',
    end: '08:00',
    allowHighPriority: true,
  },
  summary: {
    maxLength: 100,
    includeProjectName: true,
  },
});

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, override) {
  if (!isPlainObject(override)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (isPlainObject(v) && isPlainObject(base[k])) {
      out[k] = deepMerge(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

export async function loadConfig(path = DEFAULT_CONFIG_PATH) {
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return { ok: false, reason: 'config not found', config: cloneDefaults() };
    }
    return {
      ok: false,
      reason: `cannot read config: ${err?.message ?? 'error'}`,
      config: cloneDefaults(),
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      reason: 'config file is not valid JSON',
      config: cloneDefaults(),
    };
  }
  const merged = deepMerge(cloneDefaults(), parsed);
  const validation = validateConfig(merged);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason, config: merged };
  }
  return { ok: true, config: merged };
}

export function validateConfig(config) {
  if (!isPlainObject(config)) return { ok: false, reason: 'config not object' };
  if (!isPlainObject(config.ntfy)) {
    return { ok: false, reason: 'ntfy section missing' };
  }
  if (typeof config.ntfy.topic !== 'string' || config.ntfy.topic === '') {
    return { ok: false, reason: 'ntfy.topic is required' };
  }
  if (typeof config.ntfy.server !== 'string' || config.ntfy.server === '') {
    return { ok: false, reason: 'ntfy.server is required' };
  }
  return { ok: true };
}

export async function saveConfig(config, path = DEFAULT_CONFIG_PATH) {
  await mkdir(dirname(path), { recursive: true });
  const json = JSON.stringify(config, null, 2) + '\n';
  await writeFile(path, json, 'utf8');
  // 0600 — secrets like authToken should not be world-readable.
  await chmod(path, 0o600).catch(() => {});
  return path;
}

export function redactForDisplay(config) {
  const c = JSON.parse(JSON.stringify(config));
  if (c?.ntfy?.authToken) c.ntfy.authToken = '[REDACTED]';
  return c;
}
