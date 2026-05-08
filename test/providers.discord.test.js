import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as discord from '../src/providers/discord.js';

const VALID_URL =
  'https://discord.com/api/webhooks/123456789/abcDEF_xyz-token123';

function parseBody(req) {
  return JSON.parse(req.body);
}

test('discord.validateConfig: rejects missing webhookUrl', () => {
  assert.equal(discord.validateConfig({}).ok, false);
});

test('discord.validateConfig: rejects bogus URL', () => {
  assert.equal(
    discord.validateConfig({ webhookUrl: 'http://example.com/foo' }).ok,
    false,
  );
});

test('discord.validateConfig: accepts valid webhook URL', () => {
  assert.equal(discord.validateConfig({ webhookUrl: VALID_URL }).ok, true);
});

test('discord.buildRequest: posts embed with title and description', () => {
  const req = discord.buildRequest(
    { webhookUrl: VALID_URL },
    { title: '✓ done', body: 'all good', priority: 'default' },
  );
  assert.equal(req.url, VALID_URL);
  const payload = parseBody(req);
  assert.ok(Array.isArray(payload.embeds));
  assert.equal(payload.embeds[0].title, '✓ done');
  assert.equal(payload.embeds[0].description, 'all good');
  assert.equal(typeof payload.embeds[0].color, 'number');
});

test('discord.buildRequest: high priority gets red-ish color', () => {
  const req = discord.buildRequest(
    { webhookUrl: VALID_URL },
    { title: 't', body: '', priority: 'urgent' },
  );
  const payload = parseBody(req);
  assert.notEqual(payload.embeds[0].color, 0x2ecc71);
});

test('discord.buildRequest: empty title and body still produces something', () => {
  const req = discord.buildRequest(
    { webhookUrl: VALID_URL },
    { title: '', body: '' },
  );
  const payload = parseBody(req);
  assert.ok(payload.embeds[0].description);
});

test('discord.buildRequest: throws when webhook missing', () => {
  assert.throws(
    () => discord.buildRequest({}, { body: 'x' }),
    /webhookUrl is required/,
  );
});

test('discord.redactConfig: redacts token in URL', () => {
  const r = discord.redactConfig({ webhookUrl: VALID_URL });
  assert.match(r.webhookUrl, /\[REDACTED\]/);
  assert.ok(!r.webhookUrl.includes('abcDEF_xyz'));
});

test('discord.redactRequest: redacts URL and parses body', () => {
  const req = {
    url: VALID_URL,
    method: 'POST',
    headers: {},
    body: JSON.stringify({ embeds: [] }),
  };
  const r = discord.redactRequest(req);
  assert.match(r.url, /\[REDACTED\]/);
  assert.equal(typeof r.body, 'object');
});
