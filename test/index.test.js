import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { run, buildNotification } from '../src/index.js';

function captureStream() {
  const chunks = [];
  const w = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  w.read = () => chunks.join('');
  return w;
}

const baseConfig = {
  mode: 'always',
  provider: 'ntfy',
  ntfy: { topic: 'test-topic', server: 'https://ntfy.sh', authToken: null },
  filters: { minDurationSeconds: 0, events: ['Stop', 'Notification'] },
  quietHours: { enabled: false, start: '00:00', end: '00:00', allowHighPriority: true },
  summary: { maxLength: 100, includeProjectName: true },
};

test('buildNotification: Stop event uses checkmark and project name', async () => {
  const n = await buildNotification({
    payload: { event: 'Stop', cwd: '/Users/x/projects/myapp' },
    config: baseConfig,
    transcriptInfo: { lastAssistantText: 'all done' },
  });
  assert.equal(n.title, '✓ myapp - Task done');
  assert.equal(n.body, 'all done');
  assert.equal(n.priority, 'default');
  assert.deepEqual(n.tags, ['white_check_mark', 'robot']);
});

test('buildNotification: Notification event uses warning and message field', async () => {
  const n = await buildNotification({
    payload: {
      event: 'Notification',
      cwd: '/Users/x/projects/myapp',
      message: 'Claude is waiting for your input',
    },
    config: baseConfig,
    transcriptInfo: null,
  });
  assert.equal(n.title, '⚠ myapp - Input needed');
  assert.equal(n.body, 'Claude is waiting for your input');
  assert.equal(n.priority, 'high');
  assert.deepEqual(n.tags, ['warning', 'bell']);
});

test('buildNotification: includeProjectName=false omits project segment', async () => {
  const n = await buildNotification({
    payload: { event: 'Stop', cwd: '/Users/x/projects/myapp' },
    config: { ...baseConfig, summary: { maxLength: 100, includeProjectName: false } },
    transcriptInfo: { lastAssistantText: '' },
  });
  assert.equal(n.title, '✓ Task done');
});

test('run: invalid stdin yields no send and writes warning', async () => {
  const err = captureStream();
  const out = captureStream();
  const r = await run({
    rawStdin: 'not json',
    config: baseConfig,
    err,
    out,
  });
  assert.equal(r.sent, false);
  assert.match(err.read(), /⚠/);
});

test('run: dry-run prints request to stdout, does not send', async () => {
  const out = captureStream();
  const err = captureStream();
  const r = await run({
    rawStdin: JSON.stringify({
      hook_event_name: 'Stop',
      cwd: '/tmp/myapp',
    }),
    config: baseConfig,
    dryRun: true,
    out,
    err,
  });
  assert.equal(r.sent, false);
  assert.equal(r.reason, 'dry-run');
  const printed = out.read();
  const obj = JSON.parse(printed);
  assert.equal(obj.url, 'https://ntfy.sh/');
  assert.equal(obj.body.topic, 'test-topic');
  assert.equal(obj.body.title, '✓ myapp - Task done');
});

test('run: in quiet hours blocks low-priority Stop', async () => {
  const err = captureStream();
  const cfg = {
    ...baseConfig,
    quietHours: {
      enabled: true,
      start: '00:00',
      end: '23:59',
      allowHighPriority: true,
    },
  };
  const r = await run({
    rawStdin: JSON.stringify({ hook_event_name: 'Stop', cwd: '/tmp/x' }),
    config: cfg,
    err,
    out: captureStream(),
    now: new Date(2026, 4, 6, 12, 0, 0),
  });
  assert.equal(r.sent, false);
  assert.match(r.reason, /quiet hours/);
});

test('run: dry-run redacts authToken in printed request', async () => {
  const out = captureStream();
  const cfg = {
    ...baseConfig,
    ntfy: { ...baseConfig.ntfy, authToken: 'super-secret' },
  };
  const r = await run({
    rawStdin: JSON.stringify({ hook_event_name: 'Stop', cwd: '/tmp/x' }),
    config: cfg,
    dryRun: true,
    out,
    err: captureStream(),
  });
  assert.equal(r.sent, false);
  const printed = out.read();
  assert.match(printed, /\[REDACTED\]/);
  assert.ok(!printed.includes('super-secret'));
});

test('run: event not in allowlist is skipped (always mode)', async () => {
  const cfg = {
    ...baseConfig,
    filters: { minDurationSeconds: 0, events: ['Stop'] },
  };
  const err = captureStream();
  const r = await run({
    rawStdin: JSON.stringify({ hook_event_name: 'Notification' }),
    config: cfg,
    err,
    out: captureStream(),
  });
  assert.equal(r.sent, false);
  assert.match(r.reason, /allowlist/);
});

test('run: on-demand mode skips immediately without parsing', async () => {
  const cfg = { ...baseConfig, mode: 'on-demand' };
  const err = captureStream();
  const r = await run({
    rawStdin: JSON.stringify({ hook_event_name: 'Stop' }),
    config: cfg,
    err,
    out: captureStream(),
  });
  assert.equal(r.sent, false);
  assert.match(r.reason, /on-demand/);
});

test('run: armed mode skips when not armed', async () => {
  const cfg = { ...baseConfig, mode: 'armed' };
  const r = await run({
    rawStdin: JSON.stringify({ hook_event_name: 'Stop', cwd: '/tmp/x' }),
    config: cfg,
    err: captureStream(),
    out: captureStream(),
    armChecker: async () => false,
    armReader: async () => null,
    armClearer: async () => true,
  });
  assert.equal(r.sent, false);
  assert.match(r.reason, /not armed/);
});

test('run: armed mode bypasses filter allowlist', async () => {
  const cfg = {
    ...baseConfig,
    mode: 'armed',
    filters: { minDurationSeconds: 9999, events: [] },
  };
  let cleared = false;
  const out = captureStream();
  const r = await run({
    rawStdin: JSON.stringify({ hook_event_name: 'Stop', cwd: '/tmp/x' }),
    config: cfg,
    dryRun: true,
    err: captureStream(),
    out,
    armChecker: async () => true,
    armReader: async () => ({ message: 'arm-msg' }),
    armClearer: async () => {
      cleared = true;
      return true;
    },
  });
  assert.equal(r.sent, false); // dry-run
  assert.equal(r.reason, 'dry-run');
  // Body should come from arm message
  const obj = JSON.parse(out.read());
  assert.equal(obj.body.message, 'arm-msg');
});

test('run: armed mode clears arm state after successful send', async () => {
  let cleared = false;
  let fetchCalled = false;
  const fetchImpl = async () => {
    fetchCalled = true;
    return { ok: true, status: 200 };
  };
  // Inject fetch via a custom config? No — providers.send uses globalThis.fetch.
  // We override it temporarily.
  const orig = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const cfg = { ...baseConfig, mode: 'armed' };
    const r = await run({
      rawStdin: JSON.stringify({ hook_event_name: 'Stop', cwd: '/tmp/x' }),
      config: cfg,
      err: captureStream(),
      out: captureStream(),
      armChecker: async () => true,
      armReader: async () => ({}),
      armClearer: async () => {
        cleared = true;
        return true;
      },
    });
    assert.equal(r.sent, true);
    assert.equal(fetchCalled, true);
    assert.equal(cleared, true);
  } finally {
    globalThis.fetch = orig;
  }
});
