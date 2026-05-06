// Build control-char regex programmatically to keep the source readable and
// avoid embedding raw control characters into the file.
const CONTROL_RANGE = new RegExp(
  '[' +
    '\\u0000-\\u0008' +
    '\\u000B\\u000C' +
    '\\u000E-\\u001F' +
    '\\u007F' +
    ']',
  'g',
);
const WHITESPACE_RUN = /\s+/g;

export function summarize(text, maxLength = 100) {
  if (typeof text !== 'string') return '';
  const cleaned = text
    .replace(CONTROL_RANGE, '')
    .replace(WHITESPACE_RUN, ' ')
    .trim();
  if (cleaned.length === 0) return '';
  const cap = Math.max(1, Math.floor(maxLength) || 100);
  if (cleaned.length <= cap) return cleaned;
  if (cap <= 1) return cleaned.slice(0, cap);
  return cleaned.slice(0, cap - 1).trimEnd() + '…';
}

export function sanitizeHeaderValue(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(CONTROL_RANGE, '')
    .trim();
}
