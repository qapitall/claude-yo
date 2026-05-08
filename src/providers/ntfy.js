import { sanitizeHeaderValue } from '../summarizer.js';

export const name = 'ntfy';

export const defaults = {
  topic: null,
  server: 'https://ntfy.sh',
  authToken: null,
};

const PRIORITY_MAP = {
  min: 1,
  low: 2,
  default: 3,
  high: 4,
  urgent: 5,
  max: 5,
};

export function validateConfig(c) {
  if (!c || typeof c !== 'object') {
    return { ok: false, reason: 'ntfy section missing' };
  }
  if (typeof c.topic !== 'string' || c.topic === '') {
    return { ok: false, reason: 'ntfy.topic is required' };
  }
  if (typeof c.server !== 'string' || c.server === '') {
    return { ok: false, reason: 'ntfy.server is required' };
  }
  if (!/^https?:\/\//i.test(c.server)) {
    return {
      ok: false,
      reason: 'ntfy.server must start with http:// or https://',
    };
  }
  return { ok: true };
}

function normalizeServer(server) {
  return (server ?? defaults.server).replace(/\/+$/, '');
}

// JSON publish endpoint — Unicode-safe titles (HTTP header ByteString limit
// rejects non-Latin-1 chars, so we put title/priority/tags in the body).
export function buildRequest(config, notification) {
  const { topic, server, authToken } = config ?? {};
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

  const priorityNum = PRIORITY_MAP[notification?.priority];
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

export function redactConfig(config) {
  if (!config) return config;
  return {
    ...config,
    authToken: config.authToken ? '[REDACTED]' : null,
  };
}

export function redactRequest(req) {
  if (!req) return req;
  const headers = { ...req.headers };
  if (headers.Authorization) headers.Authorization = '[REDACTED]';
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      /* keep as string */
    }
  }
  return { ...req, headers, body };
}
