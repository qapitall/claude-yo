import { sanitizeHeaderValue } from './summarizer.js';

const DEFAULT_SERVER = 'https://ntfy.sh';
const DEFAULT_TIMEOUT_MS = 5000;

// ntfy priority names → numeric values (used by the JSON publish API).
const PRIORITY_MAP = {
  min: 1,
  low: 2,
  default: 3,
  high: 4,
  urgent: 5,
  max: 5,
};

function normalizeServer(server) {
  return (server ?? DEFAULT_SERVER).replace(/\/+$/, '');
}

// Use ntfy's JSON publish endpoint. HTTP header values are ByteStrings
// (Latin-1) under WHATWG fetch, so Unicode characters in titles like ✓ or ⚠
// fail with "Cannot convert argument to a ByteString" if sent via headers.
// Posting a JSON body to the server root with `topic` inside avoids that.
export function buildRequest({ topic, server, authToken }, notification) {
  if (!topic || typeof topic !== 'string') {
    throw new Error('ntfy topic is required');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const payload = {
    topic,
    message: typeof notification?.body === 'string' ? notification.body : '',
  };

  const title = sanitizeHeaderValue(notification?.title ?? '');
  if (title) payload.title = title;

  const priorityName = notification?.priority;
  const priorityNum = PRIORITY_MAP[priorityName];
  if (priorityNum) payload.priority = priorityNum;

  const tags = Array.isArray(notification?.tags) ? notification.tags : [];
  const cleanedTags = tags
    .map((t) => sanitizeHeaderValue(String(t)))
    .filter(Boolean);
  if (cleanedTags.length > 0) payload.tags = cleanedTags;

  return {
    url: normalizeServer(server) + '/',
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
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

// Returns a copy of the request suitable for printing in --dry-run output:
// Authorization is redacted and the JSON body is parsed for readability.
export function redactRequest(req) {
  if (!req) return req;
  const headers = { ...req.headers };
  if (headers.Authorization) headers.Authorization = '[REDACTED]';
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // Leave non-JSON bodies as-is.
    }
  }
  return { ...req, headers, body };
}
