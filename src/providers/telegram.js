import { sanitizeHeaderValue } from '../summarizer.js';

export const name = 'telegram';

export const defaults = {
  botToken: null,
  chatId: null,
};

const TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]+$/;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function validateConfig(c) {
  if (!c || typeof c !== 'object') {
    return { ok: false, reason: 'telegram section missing' };
  }
  if (typeof c.botToken !== 'string' || c.botToken === '') {
    return { ok: false, reason: 'telegram.botToken is required' };
  }
  if (!TOKEN_PATTERN.test(c.botToken)) {
    return {
      ok: false,
      reason:
        'telegram.botToken does not look like a bot token (expected <id>:<secret>)',
    };
  }
  if (
    (typeof c.chatId !== 'string' || c.chatId === '') &&
    typeof c.chatId !== 'number'
  ) {
    return { ok: false, reason: 'telegram.chatId is required' };
  }
  return { ok: true };
}

export function buildRequest(config, notification) {
  const { botToken, chatId } = config ?? {};
  if (!botToken || typeof botToken !== 'string') {
    throw new Error('telegram botToken is required');
  }
  if (chatId === undefined || chatId === null || chatId === '') {
    throw new Error('telegram chatId is required');
  }
  const title = sanitizeHeaderValue(notification?.title ?? '');
  const body =
    typeof notification?.body === 'string' ? notification.body : '';

  const lines = [];
  if (title) lines.push(`<b>${escapeHtml(title)}</b>`);
  if (body) lines.push(escapeHtml(body));
  let text = lines.join('\n');
  if (text === '') text = '(no content)';
  // Telegram message limit is 4096 chars.
  if (text.length > 4000) text = text.slice(0, 3997) + '…';

  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  return {
    url: `https://api.telegram.org/bot${botToken}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

function redactBotUrl(url) {
  if (typeof url !== 'string') return url;
  return url.replace(/\/bot[^/]+\//, '/bot[REDACTED]/');
}

export function redactConfig(config) {
  if (!config) return config;
  return {
    ...config,
    botToken: config.botToken ? '[REDACTED]' : null,
  };
}

export function redactRequest(req) {
  if (!req) return req;
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      /* keep */
    }
  }
  return { ...req, url: redactBotUrl(req.url), body };
}
