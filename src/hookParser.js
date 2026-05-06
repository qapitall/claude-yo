const KNOWN_EVENTS = new Set([
  'Stop',
  'Notification',
  'SubagentStop',
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'PreCompact',
]);

export function parseHookPayload(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, reason: 'empty stdin' };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid JSON on stdin' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'payload is not a JSON object' };
  }

  const event =
    typeof data.hook_event_name === 'string' ? data.hook_event_name : null;

  return {
    ok: true,
    payload: {
      event,
      eventKnown: event !== null && KNOWN_EVENTS.has(event),
      message: typeof data.message === 'string' ? data.message : null,
      transcriptPath:
        typeof data.transcript_path === 'string' ? data.transcript_path : null,
      sessionId: typeof data.session_id === 'string' ? data.session_id : null,
      cwd: typeof data.cwd === 'string' ? data.cwd : null,
      stopHookReason:
        typeof data.stop_hook_reason === 'string'
          ? data.stop_hook_reason
          : null,
    },
  };
}

export async function readStdin(stream = process.stdin, timeoutMs = 2000) {
  if (stream.isTTY) return '';
  return await new Promise((resolve) => {
    const chunks = [];
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(''), timeoutMs);
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => {
      clearTimeout(timer);
      finish(Buffer.concat(chunks).toString('utf8'));
    });
    stream.on('error', () => {
      clearTimeout(timer);
      finish('');
    });
  });
}
