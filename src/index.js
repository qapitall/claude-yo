import { basename } from 'node:path';
import { parseHookPayload, readStdin } from './hookParser.js';
import {
  readTranscriptTail,
  extractTranscriptInfo,
} from './transcriptReader.js';
import { summarize } from './summarizer.js';
import { isInQuietHours } from './quietHours.js';
import {
  shouldSend,
  eventPriority,
  isHighPriorityEvent,
} from './filters.js';
import * as providers from './providers.js';
import { loadConfig } from './config.js';

const TITLE_PREFIX = { Stop: '✓', Notification: '⚠' };
const TAGS_BY_EVENT = {
  Stop: ['white_check_mark', 'robot'],
  Notification: ['warning', 'bell'],
};

function eventTitleSuffix(event) {
  if (event === 'Stop') return 'Task done';
  if (event === 'Notification') return 'Input needed';
  return event ?? 'Event';
}

function projectName(cwd) {
  if (typeof cwd !== 'string' || cwd === '') return null;
  const name = basename(cwd);
  return name === '' ? null : name;
}

export async function buildNotification({ payload, config, transcriptInfo }) {
  const event = payload.event;
  const summaryCfg = config.summary ?? {};
  const project = summaryCfg.includeProjectName !== false
    ? projectName(payload.cwd)
    : null;
  const prefix = TITLE_PREFIX[event] ?? '•';
  const titleCore = `${prefix}${project ? ` ${project} -` : ''} ${eventTitleSuffix(event)}`;

  let body = '';
  if (event === 'Notification' && payload.message) {
    body = summarize(payload.message, summaryCfg.maxLength ?? 100);
  } else if (transcriptInfo?.lastAssistantText) {
    body = summarize(
      transcriptInfo.lastAssistantText,
      summaryCfg.maxLength ?? 100,
    );
  }

  return {
    title: titleCore,
    body,
    priority: eventPriority(event),
    tags: TAGS_BY_EVENT[event] ?? [],
  };
}

function computeDuration(info) {
  if (!info) return null;
  const a = info.firstUserTimestamp;
  const b = info.lastAssistantTimestamp;
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  return Math.max(0, Math.round((b - a) / 1000));
}

export async function run({
  rawStdin,
  config,
  dryRun = false,
  now = new Date(),
  out = process.stdout,
  err = process.stderr,
} = {}) {
  const parsed = parseHookPayload(rawStdin ?? '');
  if (!parsed.ok) {
    err.write(`⚠ ${parsed.reason}\n`);
    return { sent: false, reason: parsed.reason };
  }
  const { payload } = parsed;

  let transcriptInfo = null;
  if (payload.transcriptPath) {
    const tail = await readTranscriptTail(payload.transcriptPath);
    if (tail.ok) transcriptInfo = extractTranscriptInfo(tail.lines);
  }

  const durationSec = computeDuration(transcriptInfo);
  const inRange = isInQuietHours(now, config.quietHours);
  const cfgWithRange = {
    ...config,
    quietHours: { ...(config.quietHours ?? {}), __inRange: inRange },
  };

  const decision = shouldSend(
    {
      event: payload.event,
      durationSec,
      isHighPriority: isHighPriorityEvent(payload.event),
    },
    cfgWithRange,
  );
  if (!decision.send) {
    err.write(`⚠ skipped: ${decision.reason}\n`);
    return { sent: false, reason: decision.reason };
  }

  const notification = await buildNotification({
    payload,
    config,
    transcriptInfo,
  });

  if (dryRun) {
    const req = providers.buildRequest(config, notification);
    out.write(
      JSON.stringify(providers.redactRequest(config, req), null, 2) + '\n',
    );
    return { sent: false, reason: 'dry-run', notification };
  }

  const result = await providers.send(config, notification);
  if (!result.ok) {
    err.write(
      `✗ ${providers.activeProviderName(config)} send failed: ${result.error ?? result.status}\n`,
    );
    return { sent: false, reason: result.error ?? `status ${result.status}` };
  }
  return { sent: true, status: result.status, notification };
}

export async function runFromHook({ event, dryRun = false } = {}) {
  try {
    const raw = await readStdin();
    const cfg = await loadConfig();
    if (!cfg.ok && cfg.reason !== 'config not found') {
      process.stderr.write(`⚠ config: ${cfg.reason}\n`);
    }
    if (!cfg.ok) {
      // No usable config — bail silently to avoid blocking the hook.
      process.stderr.write(
        '⚠ no valid config found, skipping notification\n',
      );
      return { sent: false, reason: cfg.reason };
    }
    // CLI --event flag overrides any value parsed from stdin.
    const overridden = event
      ? overrideEvent(raw, event)
      : raw;
    return await run({ rawStdin: overridden, config: cfg.config, dryRun });
  } catch (err) {
    process.stderr.write(`✗ unexpected error: ${err?.message ?? err}\n`);
    return { sent: false, reason: 'exception' };
  }
}

function overrideEvent(raw, event) {
  if (!raw || raw.trim() === '') {
    return JSON.stringify({ hook_event_name: event });
  }
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      obj.hook_event_name = event;
      return JSON.stringify(obj);
    }
  } catch {
    /* fall through */
  }
  return JSON.stringify({ hook_event_name: event });
}
