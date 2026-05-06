import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInQuietHours } from '../src/quietHours.js';

function at(hour, minute = 0) {
  const d = new Date(2026, 4, 6, hour, minute, 0, 0);
  return d;
}

test('quiet hours disabled returns false always', () => {
  const cfg = { enabled: false, start: '00:00', end: '23:59' };
  assert.equal(isInQuietHours(at(2), cfg), false);
  assert.equal(isInQuietHours(at(14), cfg), false);
});

test('normal range: inside is true', () => {
  const cfg = { enabled: true, start: '09:00', end: '17:00' };
  assert.equal(isInQuietHours(at(10), cfg), true);
  assert.equal(isInQuietHours(at(16, 59), cfg), true);
});

test('normal range: outside is false', () => {
  const cfg = { enabled: true, start: '09:00', end: '17:00' };
  assert.equal(isInQuietHours(at(8, 59), cfg), false);
  assert.equal(isInQuietHours(at(17), cfg), false);
});

test('cross-midnight range: 23:00-08:00 covers night and early morning', () => {
  const cfg = { enabled: true, start: '23:00', end: '08:00' };
  assert.equal(isInQuietHours(at(2), cfg), true);
  assert.equal(isInQuietHours(at(23, 30), cfg), true);
  assert.equal(isInQuietHours(at(7, 59), cfg), true);
});

test('cross-midnight range: 23:00-08:00 excludes daytime', () => {
  const cfg = { enabled: true, start: '23:00', end: '08:00' };
  assert.equal(isInQuietHours(at(8), cfg), false);
  assert.equal(isInQuietHours(at(14), cfg), false);
  assert.equal(isInQuietHours(at(22, 59), cfg), false);
});

test('boundary: exactly start is inside, exactly end is outside', () => {
  const cfg = { enabled: true, start: '09:00', end: '17:00' };
  assert.equal(isInQuietHours(at(9, 0), cfg), true);
  assert.equal(isInQuietHours(at(17, 0), cfg), false);
});

test('invalid times are treated as not-in-range', () => {
  assert.equal(
    isInQuietHours(at(2), { enabled: true, start: 'oops', end: '08:00' }),
    false,
  );
  assert.equal(
    isInQuietHours(at(2), { enabled: true, start: '25:00', end: '08:00' }),
    false,
  );
});

test('null/undefined config returns false', () => {
  assert.equal(isInQuietHours(at(2), null), false);
  assert.equal(isInQuietHours(at(2), undefined), false);
});

test('start === end returns false (zero-length range)', () => {
  const cfg = { enabled: true, start: '08:00', end: '08:00' };
  assert.equal(isInQuietHours(at(8), cfg), false);
});
