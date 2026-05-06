import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHookPayload } from '../src/hookParser.js';

test('parseHookPayload: empty input is rejected', () => {
  const r = parseHookPayload('');
  assert.equal(r.ok, false);
});

test('parseHookPayload: whitespace-only input is rejected', () => {
  const r = parseHookPayload('   \n  ');
  assert.equal(r.ok, false);
});

test('parseHookPayload: invalid JSON is rejected gracefully', () => {
  const r = parseHookPayload('{ not valid json');
  assert.equal(r.ok, false);
  assert.match(r.reason, /JSON/);
});

test('parseHookPayload: array payload is rejected', () => {
  const r = parseHookPayload('[]');
  assert.equal(r.ok, false);
});

test('parseHookPayload: null payload is rejected', () => {
  const r = parseHookPayload('null');
  assert.equal(r.ok, false);
});

test('parseHookPayload: Stop event normalized', () => {
  const r = parseHookPayload(
    JSON.stringify({
      hook_event_name: 'Stop',
      stop_hook_reason: 'end_turn',
      transcript_path: '/tmp/t.jsonl',
      session_id: 'abc',
      cwd: '/Users/x/projects/myapp',
    }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.payload.event, 'Stop');
  assert.equal(r.payload.eventKnown, true);
  assert.equal(r.payload.transcriptPath, '/tmp/t.jsonl');
  assert.equal(r.payload.sessionId, 'abc');
  assert.equal(r.payload.cwd, '/Users/x/projects/myapp');
  assert.equal(r.payload.stopHookReason, 'end_turn');
  assert.equal(r.payload.message, null);
});

test('parseHookPayload: Notification event with message', () => {
  const r = parseHookPayload(
    JSON.stringify({
      hook_event_name: 'Notification',
      message: 'Claude is waiting for your input',
    }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.payload.event, 'Notification');
  assert.equal(r.payload.message, 'Claude is waiting for your input');
});

test('parseHookPayload: unknown event flagged but accepted', () => {
  const r = parseHookPayload(
    JSON.stringify({ hook_event_name: 'SomethingNew' }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.payload.event, 'SomethingNew');
  assert.equal(r.payload.eventKnown, false);
});

test('parseHookPayload: missing event name yields null event', () => {
  const r = parseHookPayload(JSON.stringify({ cwd: '/tmp/x' }));
  assert.equal(r.ok, true);
  assert.equal(r.payload.event, null);
  assert.equal(r.payload.cwd, '/tmp/x');
});

test('parseHookPayload: wrong field types are coerced to null', () => {
  const r = parseHookPayload(
    JSON.stringify({
      hook_event_name: 'Stop',
      transcript_path: 12,
      cwd: { not: 'a string' },
      message: ['x'],
    }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.payload.transcriptPath, null);
  assert.equal(r.payload.cwd, null);
  assert.equal(r.payload.message, null);
});
