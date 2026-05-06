function parseHHMM(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function isInQuietHours(now, quiet) {
  if (!quiet || quiet.enabled !== true) return false;
  const start = parseHHMM(quiet.start);
  const end = parseHHMM(quiet.end);
  if (start === null || end === null) return false;
  if (start === end) return false;

  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return false;
  const cur = date.getHours() * 60 + date.getMinutes();

  if (start < end) {
    return cur >= start && cur < end;
  }
  // Crosses midnight (e.g. 23:00 -> 08:00).
  return cur >= start || cur < end;
}
