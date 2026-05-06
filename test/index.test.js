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
  assert.equal(obj.url, 'https://ntfy.sh/test-topic');
  assert.equal(obj.headers.Title, '✓ myapp - Task done');
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

test('run: event not in allowlist is skipped', async () => {
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
