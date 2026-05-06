import { sanitizeHeaderValue } from './summarizer.js';

const DEFAULT_SERVER = 'https://ntfy.sh';
const DEFAULT_TIMEOUT_MS = 5000;

function joinUrl(server, topic) {
  const base = (server ?? DEFAULT_SERVER).replace(/\/+$/, '');
  return `${base}/${encodeURIComponent(topic)}`;
}

export function buildRequest({ topic, server, authToken }, notification) {
  if (!topic || typeof topic !== 'string') {
    throw new Error('ntfy topic is required');
  }
  const headers = { 'Content-Type': 'text/plain; charset=utf-8' };
  const title = sanitizeHeaderValue(notification?.title ?? '');
  if (title) headers['Title'] = title;

  const priority = notification?.priority;
  if (priority) headers['Priority'] = sanitizeHeaderValue(String(priority));

  const tags = Array.isArray(notification?.tags) ? notification.tags : [];
  if (tags.length > 0) {
    headers['Tags'] = tags
      .map((t) => sanitizeHeaderValue(String(t)))
      .filter(Boolean)
      .join(',');
  }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  return {
    url: joinUrl(server, topic),
    method: 'POST',
    headers,
    body: typeof notification?.body === 'string' ? notification.body : '',
  };
}

export async function send(
  ntfyConfig,
  notification,
  { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const req = buildRequest(ntfyConfig, notification);
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
      return { ok: false, status, error: `ntfy responded ${status}` };
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

export function redactConfig(ntfyConfig) {
  if (!ntfyConfig) return ntfyConfig;
  return {
    ...ntfyConfig,
    authToken: ntfyConfig.authToken ? '[REDACTED]' : null,
  };
}

export function redactRequest(req) {
  if (!req) return req;
  const headers = { ...req.headers };
  if (headers.Authorization) headers.Authorization = '[REDACTED]';
  return { ...req, headers };
}
