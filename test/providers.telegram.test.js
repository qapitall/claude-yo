import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as telegram from '../src/providers/telegram.js';

const VALID = { botToken: '12345:abcDEF_token-here', chatId: '987654321' };

function parseBody(req) {
  return JSON.parse(req.body);
}

test('telegram.validateConfig: rejects missing botToken', () => {
  assert.equal(telegram.validateConfig({ chatId: '1' }).ok, false);
});

test('telegram.validateConfig: rejects malformed botToken', () => {
  assert.equal(
    telegram.validateConfig({ botToken: 'no-colon', chatId: '1' }).ok,
    false,
  );
});

test('telegram.validateConfig: rejects missing chatId', () => {
  assert.equal(telegram.validateConfig({ botToken: VALID.botToken }).ok, false);
});

test('telegram.validateConfig: accepts numeric chatId', () => {
  assert.equal(
    telegram.validateConfig({ botToken: VALID.botToken, chatId: 1234 }).ok,
    true,
  );
});

test('telegram.validateConfig: accepts valid config', () => {
  assert.equal(telegram.validateConfig(VALID).ok, true);
});

test('telegram.buildRequest: posts to sendMessage with HTML body', () => {
  const req = telegram.buildRequest(VALID, {
    title: '✓ done',
    body: 'all good',
    priority: 'default',
  });
  assert.equal(
    req.url,
    'https://api.telegram.org/bot12345:abcDEF_token-here/sendMessage',
  );
  const payload = parseBody(req);
  assert.equal(payload.chat_id, '987654321');
  assert.equal(payload.parse_mode, 'HTML');
  assert.match(payload.text, /<b>✓ done<\/b>/);
  assert.match(payload.text, /all good/);
});

test('telegram.buildRequest: HTML-escapes < > & in title and body', () => {
  const req = telegram.buildRequest(VALID, {
    title: 'a<b>c',
    body: 'x&y>z',
  });
  const payload = parseBody(req);
  assert.match(payload.text, /a&lt;b&gt;c/);
  assert.match(payload.text, /x&amp;y&gt;z/);
});

test('telegram.buildRequest: throws when token missing', () => {
  assert.throws(
    () => telegram.buildRequest({ chatId: '1' }, { body: 'x' }),
    /botToken is required/,
  );
});

test('telegram.buildRequest: throws when chatId missing', () => {
  assert.throws(
    () => telegram.buildRequest({ botToken: VALID.botToken }, { body: 'x' }),
    /chatId is required/,
  );
});

test('telegram.buildRequest: truncates very long body', () => {
  const big = 'x'.repeat(5000);
  const req = telegram.buildRequest(VALID, { title: 't', body: big });
  const payload = parseBody(req);
  assert.ok(payload.text.length <= 4001);
});

test('telegram.redactConfig: hides botToken', () => {
  assert.equal(telegram.redactConfig(VALID).botToken, '[REDACTED]');
});

test('telegram.redactRequest: redacts token in URL and parses body', () => {
  const req = telegram.buildRequest(VALID, { title: 't', body: 'b' });
  const r = telegram.redactRequest(req);
  assert.match(r.url, /\/bot\[REDACTED\]\//);
  assert.ok(!r.url.includes(VALID.botToken));
  assert.equal(typeof r.body, 'object');
});
