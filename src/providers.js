import * as ntfy from './providers/ntfy.js';
import * as discord from './providers/discord.js';
import * as telegram from './providers/telegram.js';

const PROVIDERS = {
  [ntfy.name]: ntfy,
  [discord.name]: discord,
  [telegram.name]: telegram,
};

const DEFAULT_TIMEOUT_MS = 5000;

export function getProvider(name) {
  if (!name) return PROVIDERS.ntfy;
  return PROVIDERS[name] ?? null;
}

export function listProviders() {
  return Object.keys(PROVIDERS);
}

export function activeProviderName(config) {
  return config?.provider ?? 'ntfy';
}

export function activeProvider(config) {
  const name = activeProviderName(config);
  const p = getProvider(name);
  if (!p) {
    throw new Error(
      `unknown provider "${name}" (must be one of: ${listProviders().join(', ')})`,
    );
  }
  return p;
}

export function buildRequest(config, notification) {
  const p = activeProvider(config);
  return p.buildRequest(config[p.name], notification);
}

export function redactRequest(config, req) {
  const p = activeProvider(config);
  return p.redactRequest ? p.redactRequest(req) : req;
}

export function validateProviderConfig(config) {
  const p = activeProvider(config);
  return p.validateConfig(config[p.name]);
}

export async function send(
  config,
  notification,
  { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const req = buildRequest(config, notification);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      signal: controller.signal,
    });
    if (!res || !res.ok) {
      const status = res?.status ?? 'unknown';
      return { ok: false, status, error: `provider responded ${status}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err?.name === 'AbortError' ? 'timeout' : (err?.message ?? 'error'),
    };
  } finally {
    clearTimeout(timer);
  }
}
