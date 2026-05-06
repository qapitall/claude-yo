import { open, stat } from 'node:fs/promises';

const TAIL_BYTES = 64 * 1024;

export async function readTranscriptTail(path, tailBytes = TAIL_BYTES) {
  if (typeof path !== 'string' || path === '') {
    return { ok: false, lines: [] };
  }
  let info;
  try {
    info = await stat(path);
  } catch {
    return { ok: false, lines: [] };
  }
  if (!info.isFile()) return { ok: false, lines: [] };

  const size = info.size;
  const start = Math.max(0, size - tailBytes);
  const length = size - start;
  if (length === 0) return { ok: true, lines: [] };

  let buffer;
  let fh;
  try {
    fh = await open(path, 'r');
    buffer = Buffer.alloc(length);
    await fh.read(buffer, 0, length, start);
  } catch {
    return { ok: false, lines: [] };
  } finally {
    if (fh) await fh.close().catch(() => {});
  }

  let text = buffer.toString('utf8');
  // If we did a partial read, the first line is likely truncated; drop it.
  if (start > 0) {
    const firstNewline = text.indexOf('\n');
    text = firstNewline === -1 ? '' : text.slice(firstNewline + 1);
  }
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return { ok: true, lines };
}

function getRole(entry) {
  if (entry?.message?.role) return entry.message.role;
  if (entry?.role) return entry.role;
  return null;
}

function getText(entry) {
  const content = entry?.message?.content ?? entry?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part && typeof part.text === 'string') return part.text;
    }
  }
  return null;
}

function getTimestampMs(entry) {
  const ts = entry?.timestamp ?? entry?.message?.timestamp ?? entry?.created_at;
  if (typeof ts !== 'string') return null;
  const ms = Date.parse(ts);
  return Number.isNaN(ms) ? null : ms;
}

export function extractTranscriptInfo(lines) {
  let lastAssistantText = null;
  let lastAssistantTimestamp = null;
  let firstUserTimestamp = null;

  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (lastAssistantText === null && getRole(entry) === 'assistant') {
      const text = getText(entry);
      if (text) {
        lastAssistantText = text;
        lastAssistantTimestamp = getTimestampMs(entry);
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (getRole(entry) === 'user') {
      const ts = getTimestampMs(entry);
      if (ts !== null) {
        firstUserTimestamp = ts;
        break;
      }
    }
  }

  return { lastAssistantText, lastAssistantTimestamp, firstUserTimestamp };
}
