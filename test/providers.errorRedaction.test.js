import { test } from 'node:test';
import assert from 'node:assert/strict';
import { send } from '../src/providers.js';

const telegramConfig = {
  provider: 'telegram',
  telegram: { botToken: '12345:abcDEF_token-here', chatId: '999' },
};

const discordConfig = {
  provider: 'discord',
  discord: {
    webhookUrl:
      'https://discord.com/api/webhooks/123456789/abcDEF_xyz-token123',
  },
};

test('send: telegram bot token is redacted in fetch error message', async () => {
  const fetchImpl = async () => {
    // Simulate a connection error that includes the URL.
    throw new Error(
      'fetch failed for https://api.telegram.org/bot12345:abcDEF_token-here/sendMessage: ECONNREFUSED',
    );
  };
  const r = await send(
    telegramConfig,
    { title: 't', body: 'b' },
    { fetchImpl },
  );
  assert.equal(r.ok, false);
  assert.ok(!r.error.includes('abcDEF_token-here'), 'token leaked');
  assert.match(r.error, /\[REDACTED\]/);
});

test('send: discord webhook token is redacted in fetch error message', async () => {
  const fetchImpl = async () => {
    throw new Error(
      'fetch failed for https://discord.com/api/webhooks/123456789/abcDEF_xyz-token123',
    );
  };
  const r = await send(
    discordConfig,
    { title: 't', body: 'b' },
    { fetchImpl },
  );
  assert.equal(r.ok, false);
  assert.ok(!r.error.includes('abcDEF_xyz'), 'webhook token leaked');
  assert.match(r.error, /\[REDACTED\]/);
});

test('send: ntfy authToken bearer is redacted in error message', async () => {
  const fetchImpl = async () => {
    throw new Error('Authorization: Bearer my-secret-token failed');
  };
  const r = await send(
    {
      provider: 'ntfy',
      ntfy: { topic: 't', server: 'https://ntfy.sh', authToken: 'my-secret-token' },
    },
    { title: 't', body: 'b' },
    { fetchImpl },
  );
  assert.equal(r.ok, false);
  assert.ok(!r.error.includes('my-secret-token'), 'authToken leaked');
});

test('send: timeout message is preserved (no false redaction)', async () => {
  const fetchImpl = async () => {
    const e = new Error('aborted');
    e.name = 'AbortError';
    throw e;
  };
  const r = await send(
    telegramConfig,
    { title: 't', body: 'b' },
    { fetchImpl },
  );
  assert.equal(r.error, 'timeout');
});
