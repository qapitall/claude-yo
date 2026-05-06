import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRequest,
  send,
  redactConfig,
  redactRequest,
} from '../src/ntfy.js';

test('buildRequest: builds correct URL, headers, body', () => {
  const req = buildRequest(
    { topic: 'claude-watch-abc', server: 'https://ntfy.sh' },
    {
      title: 'Hello',
      body: 'World',
      priority: 'high',
      tags: ['robot', 'white_check_mark'],
    },
  );
  assert.equal(req.url, 'https://ntfy.sh/claude-watch-abc');
  assert.equal(req.method, 'POST');
  assert.equal(req.headers.Title, 'Hello');
  assert.equal(req.headers.Priority, 'high');
  assert.equal(req.headers.Tags, 'robot,white_check_mark');
  assert.equal(req.body, 'World');
});

test('buildRequest: strips trailing slashes from server', () => {
  const req = buildRequest(
    { topic: 't', server: 'https://example.com///' },
    { body: 'x' },
  );
  assert.equal(req.url, 'https://example.com/t');
});

test('buildRequest: defaults to ntfy.sh', () => {
  const req = buildRequest({ topic: 't' }, { body: 'x' });
  assert.equal(req.url, 'https://ntfy.sh/t');
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

test('buildRequest: sanitizes Title against CRLF injection', () => {
  const req = buildRequest(
    { topic: 't' },
    { title: 'evil\r\nX-Inject: 1', body: '' },
  );
  assert.ok(!req.headers.Title.includes('\r'));
  assert.ok(!req.headers.Title.includes('\n'));
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
  assert.equal(captured.url, 'https://ntfy.sh/abc');
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.body, 'hi');
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
    body: '',
  };
  const r = redactRequest(req);
  assert.equal(r.headers.Authorization, '[REDACTED]');
});
