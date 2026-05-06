import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRequest,
  send,
  redactConfig,
  redactRequest,
} from '../src/ntfy.js';

function parseBody(req) {
  return JSON.parse(req.body);
}

test('buildRequest: posts JSON to server root with topic in body', () => {
  const req = buildRequest(
    { topic: 'claude-watch-abc', server: 'https://ntfy.sh' },
    {
      title: 'Hello',
      body: 'World',
      priority: 'high',
      tags: ['robot', 'white_check_mark'],
    },
  );
  assert.equal(req.url, 'https://ntfy.sh/');
  assert.equal(req.method, 'POST');
  assert.equal(req.headers['Content-Type'], 'application/json');
  const payload = parseBody(req);
  assert.equal(payload.topic, 'claude-watch-abc');
  assert.equal(payload.title, 'Hello');
  assert.equal(payload.message, 'World');
  assert.equal(payload.priority, 4);
  assert.deepEqual(payload.tags, ['robot', 'white_check_mark']);
});

test('buildRequest: Unicode characters in title survive (regression: U+2713)', () => {
  const req = buildRequest(
    { topic: 't' },
    { title: '✓ done', body: 'ok', priority: 'default', tags: [] },
  );
  const payload = parseBody(req);
  assert.equal(payload.title, '✓ done');
});

test('buildRequest: strips trailing slashes from server', () => {
  const req = buildRequest(
    { topic: 't', server: 'https://example.com///' },
    { body: 'x' },
  );
  assert.equal(req.url, 'https://example.com/');
});

test('buildRequest: defaults to ntfy.sh', () => {
  const req = buildRequest({ topic: 't' }, { body: 'x' });
  assert.equal(req.url, 'https://ntfy.sh/');
});

test('buildRequest: adds Authorization header when authToken present', () => {
  const req = buildRequest(
    { topic: 't', authToken: 'tk_secret' },
    { body: 'x' },
  );
  assert.equal(req.headers.Authorization, 'Bearer tk_secret');
});

test('buildRequest: throws when topic missing', () => {
  assert.throws(() => buildRequest({}, { body: 'x' }), /topic is required/);
});

test('buildRequest: sanitizes title against CRLF injection', () => {
  const req = buildRequest(
    { topic: 't' },
    { title: 'evil\r\nX-Inject: 1', body: '' },
  );
  const payload = parseBody(req);
  assert.ok(!payload.title.includes('\r'));
  assert.ok(!payload.title.includes('\n'));
});

test('buildRequest: maps priority names to numbers', () => {
  const cases = [
    ['min', 1],
    ['low', 2],
    ['default', 3],
    ['high', 4],
    ['urgent', 5],
    ['max', 5],
  ];
  for (const [name, num] of cases) {
    const r = buildRequest({ topic: 't' }, { body: 'x', priority: name });
    assert.equal(parseBody(r).priority, num, `priority ${name}`);
  }
});

test('send: succeeds with mocked fetch', async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return { ok: true, status: 200 };
  };
  const r = await send(
    { topic: 'abc' },
    { body: 'hi', title: 'T' },
    { fetchImpl },
  );
  assert.equal(r.ok, true);
  assert.equal(r.status, 200);
  assert.equal(captured.url, 'https://ntfy.sh/');
  assert.equal(captured.init.method, 'POST');
  const payload = JSON.parse(captured.init.body);
  assert.equal(payload.topic, 'abc');
  assert.equal(payload.message, 'hi');
});

test('send: returns ok:false on non-2xx without throwing', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500 });
  const r = await send({ topic: 't' }, { body: '' }, { fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.status, 500);
});

test('send: returns ok:false on network error without throwing', async () => {
  const fetchImpl = async () => {
    throw new Error('boom');
  };
  const r = await send({ topic: 't' }, { body: '' }, { fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'boom');
});

test('send: returns timeout on AbortError', async () => {
  const fetchImpl = async () => {
    const e = new Error('aborted');
    e.name = 'AbortError';
    throw e;
  };
  const r = await send({ topic: 't' }, { body: '' }, { fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'timeout');
});

test('send: aborts when timeout fires', async () => {
  let abortSeen = false;
  const fetchImpl = async (url, init) => {
    return await new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => {
        abortSeen = true;
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      });
    });
  };
  const r = await send(
    { topic: 't' },
    { body: '' },
    { fetchImpl, timeoutMs: 20 },
  );
  assert.equal(abortSeen, true);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'timeout');
});

test('redactConfig: replaces authToken with [REDACTED]', () => {
  const r = redactConfig({ topic: 't', authToken: 'secret' });
  assert.equal(r.authToken, '[REDACTED]');
  assert.equal(r.topic, 't');
});

test('redactConfig: leaves null token alone', () => {
  const r = redactConfig({ topic: 't', authToken: null });
  assert.equal(r.authToken, null);
});

test('redactRequest: redacts Authorization header', () => {
  const req = {
    url: 'x',
    method: 'POST',
    headers: { Authorization: 'Bearer s' },
    body: JSON.stringify({ topic: 't' }),
  };
  const r = redactRequest(req);
  assert.equal(r.headers.Authorization, '[REDACTED]');
});

test('redactRequest: parses JSON body for readable display', () => {
  const req = {
    url: 'x',
    method: 'POST',
    headers: {},
    body: JSON.stringify({ topic: 't', message: 'hi' }),
  };
  const r = redactRequest(req);
  assert.equal(typeof r.body, 'object');
  assert.equal(r.body.topic, 't');
});
