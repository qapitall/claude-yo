import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldSend,
  eventPriority,
  isHighPriorityEvent,
} from '../src/filters.js';

test('shouldSend: allows event in allowlist', () => {
  const r = shouldSend(
    { event: 'Stop', durationSec: 100, isHighPriority: false },
    { filters: { events: ['Stop', 'Notification'], minDurationSeconds: 30 } },
  );
  assert.equal(r.send, true);
});

test('shouldSend: blocks event not in allowlist', () => {
  const r = shouldSend(
    { event: 'PreToolUse', durationSec: 100, isHighPriority: false },
    { filters: { events: ['Stop'], minDurationSeconds: 0 } },
  );
  assert.equal(r.send, false);
  assert.match(r.reason, /allowlist/);
});

test('shouldSend: blocks below minDurationSeconds', () => {
  const r = shouldSend(
    { event: 'Stop', durationSec: 5, isHighPriority: false },
    { filters: { minDurationSeconds: 30 } },
  );
  assert.equal(r.send, false);
  assert.match(r.reason, /minDurationSeconds/);
});

test('shouldSend: missing duration skips duration filter', () => {
  const r = shouldSend(
    { event: 'Stop', durationSec: null, isHighPriority: false },
    { filters: { minDurationSeconds: 30 } },
  );
  assert.equal(r.send, true);
});

test('shouldSend: in quiet hours blocks low priority', () => {
  const r = shouldSend(
    { event: 'Stop', durationSec: 100, isHighPriority: false },
    {
      filters: {},
      quietHours: { enabled: true, allowHighPriority: true, __inRange: true },
    },
  );
  assert.equal(r.send, false);
  assert.match(r.reason, /quiet hours/);
});

test('shouldSend: in quiet hours allows high priority when configured', () => {
  const r = shouldSend(
    { event: 'Notification', durationSec: 100, isHighPriority: true },
    {
      filters: {},
      quietHours: { enabled: true, allowHighPriority: true, __inRange: true },
    },
  );
  assert.equal(r.send, true);
});

test('shouldSend: in quiet hours blocks high priority when allowHighPriority=false', () => {
  const r = shouldSend(
    { event: 'Notification', durationSec: 100, isHighPriority: true },
    {
      filters: {},
      quietHours: { enabled: true, allowHighPriority: false, __inRange: true },
    },
  );
  assert.equal(r.send, false);
});

test('shouldSend: empty events array means no allowlist filtering', () => {
  const r = shouldSend(
    { event: 'Stop', durationSec: 100, isHighPriority: false },
    { filters: { events: null, minDurationSeconds: 0 } },
  );
  assert.equal(r.send, true);
});

test('eventPriority: Notification is high, others default', () => {
  assert.equal(eventPriority('Notification'), 'high');
  assert.equal(eventPriority('Stop'), 'default');
  assert.equal(eventPriority('Whatever'), 'default');
});

test('isHighPriorityEvent: only Notification', () => {
  assert.equal(isHighPriorityEvent('Notification'), true);
  assert.equal(isHighPriorityEvent('Stop'), false);
});
