import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readTranscriptTail,
  extractTranscriptInfo,
} from '../src/transcriptReader.js';

async function withTempFile(contents, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'cyo-'));
  const path = join(dir, 'transcript.jsonl');
  await writeFile(path, contents);
  try {
    return await fn(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('readTranscriptTail: returns lines for small files', async () => {
  const lines = [
    JSON.stringify({ role: 'user', text: 'hi' }),
    JSON.stringify({ role: 'assistant', text: 'hello' }),
  ].join('\n');
  await withTempFile(lines, async (p) => {
    const r = await readTranscriptTail(p);
    assert.equal(r.ok, true);
    assert.equal(r.lines.length, 2);
  });
});

test('readTranscriptTail: drops likely-truncated first line on tail read', async () => {
  const big = 'A'.repeat(70 * 1024);
  const content = big + '\n' + JSON.stringify({ role: 'assistant' });
  await withTempFile(content, async (p) => {
    const r = await readTranscriptTail(p, 1024);
    assert.equal(r.ok, true);
    assert.equal(r.lines.length, 1);
    assert.match(r.lines[0], /assistant/);
  });
});

test('readTranscriptTail: missing file returns ok:false', async () => {
  const r = await readTranscriptTail('/does/not/exist/transcript.jsonl');
  assert.equal(r.ok, false);
  assert.equal(r.lines.length, 0);
});

test('readTranscriptTail: non-string path returns ok:false', async () => {
  const r = await readTranscriptTail(null);
  assert.equal(r.ok, false);
});

test('extractTranscriptInfo: finds last assistant text and timestamps', () => {
  const lines = [
    JSON.stringify({
      role: 'user',
      content: 'hi',
      timestamp: '2026-05-06T10:00:00Z',
    }),
    JSON.stringify({
      role: 'assistant',
      content: [{ type: 'text', text: 'first reply' }],
      timestamp: '2026-05-06T10:00:30Z',
    }),
    JSON.stringify({
      role: 'user',
      content: 'more',
      timestamp: '2026-05-06T10:01:00Z',
    }),
    JSON.stringify({
      role: 'assistant',
      content: [{ type: 'text', text: 'last reply' }],
      timestamp: '2026-05-06T10:02:00Z',
    }),
  ];
  const info = extractTranscriptInfo(lines);
  assert.equal(info.lastAssistantText, 'last reply');
  assert.equal(
    info.firstUserTimestamp,
    Date.parse('2026-05-06T10:00:00Z'),
  );
  assert.equal(
    info.lastAssistantTimestamp,
    Date.parse('2026-05-06T10:02:00Z'),
  );
});

test('extractTranscriptInfo: handles claude-code message.role shape', () => {
  const lines = [
    JSON.stringify({
      message: { role: 'user', content: 'hi' },
      timestamp: '2026-05-06T10:00:00Z',
    }),
    JSON.stringify({
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'wrapped reply' }],
      },
      timestamp: '2026-05-06T10:00:05Z',
    }),
  ];
  const info = extractTranscriptInfo(lines);
  assert.equal(info.lastAssistantText, 'wrapped reply');
});

test('extractTranscriptInfo: skips malformed lines', () => {
  const lines = [
    'not json',
    JSON.stringify({ role: 'assistant', content: 'kept' }),
    'still not json',
  ];
  const info = extractTranscriptInfo(lines);
  assert.equal(info.lastAssistantText, 'kept');
});

test('extractTranscriptInfo: empty input yields nulls', () => {
  const info = extractTranscriptInfo([]);
  assert.equal(info.lastAssistantText, null);
  assert.equal(info.firstUserTimestamp, null);
  assert.equal(info.lastAssistantTimestamp, null);
});

test('extractTranscriptInfo: string content is accepted', () => {
  const lines = [JSON.stringify({ role: 'assistant', content: 'plain' })];
  const info = extractTranscriptInfo(lines);
  assert.equal(info.lastAssistantText, 'plain');
});
