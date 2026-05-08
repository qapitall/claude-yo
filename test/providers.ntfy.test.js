import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ntfy from '../src/providers/ntfy.js';

function parseBody(req) {
  return JSON.parse(req.body);
}

test('ntfy.validateConfig: rejects missing topic', () => {
  const r = ntfy.validateConfig({ server: 'https://ntfy.sh' });
  assert.equal(r.ok, false);
});

test('ntfy.validateConfig: rejects missing server', () => {
  const r = ntfy.validateConfig({ topic: 't', server: '' });
  assert.equal(r.ok, false);
});

test('ntfy.validateConfig: accepts valid config', () => {
  const r = ntfy.validateConfig({ topic: 't', server: 'https://ntfy.sh' });
  assert.equal(r.ok, true);
});

test('ntfy.buildRequest: posts JSON to server root with topic in body', () => {
  const req = ntfy.buildRequest(
    { topic: 'claude-watch-abc', server: 'https://ntfy.sh' },
    {
      title: 'Hello',
      body: 'World',
      priority: 'high',
      tags: ['robot'],
    },
  );
  assert.equal(req.url, 'https://ntfy.sh/');
  const payload = parseBody(req);
  assert.equal(payload.topic, 'claude-watch-abc');
  assert.equal(payload.title, 'Hello');
  assert.equal(payload.message, 'World');
  assert.equal(payload.priority, 4);
  assert.deepEqual(payload.tags, ['robot']);
});

test('ntfy.buildRequest: Unicode title survives (regression)', () => {
  const req = ntfy.buildRequest(
    { topic: 't' },
    { title: '✓ done', body: 'ok' },
  );
  assert.equal(parseBody(req).title, '✓ done');
});

test('ntfy.buildRequest: sanitizes CRLF in title', () => {
  const req = ntfy.buildRequest(
    { topic: 't' },
    { title: 'evil\r\nX-Inject: 1', body: '' },
  );
  const payload = parseBody(req);
  assert.ok(!payload.title.includes('\r'));
  assert.ok(!payload.title.includes('\n'));
});

test('ntfy.buildRequest: maps priority names to numbers', () => {
  for (const [n, num] of [
    ['min', 1],
    ['low', 2],
    ['default', 3],
    ['high', 4],
    ['urgent', 5],
    ['max', 5],
  ]) {
    const r = ntfy.buildRequest({ topic: 't' }, { body: 'x', priority: n });
    assert.equal(parseBody(r).priority, num, `priority ${n}`);
  }
});

test('ntfy.buildRequest: throws when topic missing', () => {
  assert.throws(() => ntfy.buildRequest({}, { body: 'x' }), /topic is required/);
});

test('ntfy.buildRequest: adds Authorization when authToken present', () => {
  const req = ntfy.buildRequest(
    { topic: 't', authToken: 'tk' },
    { body: 'x' },
  );
  assert.equal(req.headers.Authorization, 'Bearer tk');
});

test('ntfy.redactConfig: hides authToken', () => {
  assert.equal(
    ntfy.redactConfig({ topic: 't', authToken: 'secret' }).authToken,
    '[REDACTED]',
  );
});

test('ntfy.redactRequest: redacts Authorization and parses body', () => {
  const req = {
    url: 'x',
    method: 'POST',
    headers: { Authorization: 'Bearer s' },
    body: JSON.stringify({ topic: 't' }),
  };
  const r = ntfy.redactRequest(req);
  assert.equal(r.headers.Authorization, '[REDACTED]');
  assert.equal(typeof r.body, 'object');
});
