import { sanitizeHeaderValue } from '../summarizer.js';

export const name = 'discord';

export const defaults = {
  webhookUrl: null,
};

const WEBHOOK_PREFIX = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/;

const COLOR_BY_PRIORITY = {
  min: 0x95a5a6,
  low: 0x95a5a6,
  default: 0x2ecc71,
  high: 0xe67e22,
  urgent: 0xe74c3c,
  max: 0xe74c3c,
};

export function validateConfig(c) {
  if (!c || typeof c !== 'object') {
    return { ok: false, reason: 'discord section missing' };
  }
  if (typeof c.webhookUrl !== 'string' || c.webhookUrl === '') {
    return { ok: false, reason: 'discord.webhookUrl is required' };
  }
  if (!WEBHOOK_PREFIX.test(c.webhookUrl)) {
    return {
      ok: false,
      reason:
        'discord.webhookUrl does not look like a Discord webhook URL (expected https://discord.com/api/webhooks/<id>/<token>)',
    };
  }
  return { ok: true };
}

export function buildRequest(config, notification) {
  const url = config?.webhookUrl;
  if (!url || typeof url !== 'string') {
    throw new Error('discord webhookUrl is required');
  }
  const title = sanitizeHeaderValue(notification?.title ?? '');
  const body =
    typeof notification?.body === 'string' ? notification.body : '';
  const color = COLOR_BY_PRIORITY[notification?.priority] ?? COLOR_BY_PRIORITY.default;

  const embed = { color };
  if (title) embed.title = title;
  if (body) embed.description = body.length > 4000 ? body.slice(0, 3997) + '…' : body;
  if (!embed.title && !embed.description) embed.description = '(no content)';

  const payload = {
    username: 'Claude Code',
    embeds: [embed],
  };

  return {
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

function redactWebhookUrl(url) {
  if (typeof url !== 'string') return url;
  return url.replace(
    /(\/api\/webhooks\/\d+\/)[A-Za-z0-9_-]+/,
    '$1[REDACTED]',
  );
}

export function redactConfig(config) {
  if (!config) return config;
  return {
    ...config,
    webhookUrl: config.webhookUrl ? redactWebhookUrl(config.webhookUrl) : null,
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
  return { ...req, url: redactWebhookUrl(req.url), body };
}
