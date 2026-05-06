export function shouldSend({ event, durationSec, isHighPriority }, config) {
  const filters = config?.filters ?? {};
  const events = Array.isArray(filters.events) ? filters.events : null;

  if (events && event && !events.includes(event)) {
    return { send: false, reason: `event ${event} not in allowlist` };
  }

  const min = Number(filters.minDurationSeconds);
  if (
    Number.isFinite(min) &&
    min > 0 &&
    typeof durationSec === 'number' &&
    Number.isFinite(durationSec) &&
    durationSec < min
  ) {
    return {
      send: false,
      reason: `duration ${durationSec}s under minDurationSeconds ${min}`,
    };
  }

  const quiet = config?.quietHours ?? {};
  const inQuiet = quiet.enabled === true && quiet.__inRange === true;
  if (inQuiet && !(quiet.allowHighPriority === true && isHighPriority)) {
    return { send: false, reason: 'inside quiet hours' };
  }

  return { send: true, reason: 'ok' };
}

export function eventPriority(event) {
  if (event === 'Notification') return 'high';
  return 'default';
}

export function isHighPriorityEvent(event) {
  return event === 'Notification';
}
