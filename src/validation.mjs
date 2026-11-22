export class BotListsError extends TypeError {
  constructor(code, field, message) {
    super(`${field}: ${message}`);
    this.name = 'BotListsError';
    this.code = code;
    this.field = field;
  }
}

export function fail(code, field, message) { throw new BotListsError(code, field, message); }

export function record(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', field, 'expected a record.');
  return value;
}

export function line(value, field) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) {
    fail('INVALID_TEXT', field, 'expected nonempty single-line text without control characters.');
  }
  return value;
}

export function httpsURL(value, field) {
  line(value, field);
  if (/\s/u.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) fail('INVALID_URL', field, 'expected a public HTTPS URL.');
  let url;
  try { url = new URL(value); } catch { fail('INVALID_URL', field, 'expected a public HTTPS URL.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    fail('INVALID_URL', field, 'expected HTTPS without credentials.');
  }
  return url;
}

export function boolean(value, field) {
  if (typeof value !== 'boolean') fail('INVALID_INPUT', field, 'expected a boolean.');
  return value;
}

export function clock(value, field = 'now') {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isFinite(new Date(value).getTime())) {
    fail('INVALID_TIME', field, 'expected finite epoch milliseconds.');
  }
  return value;
}

// Deliberately reject leap seconds and sub-millisecond precision instead of silently normalizing them.
export function timestamp(value, field) {
  line(value, field);
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match) fail('INVALID_TIME', field, 'expected a timezone-explicit timestamp with seconds.');
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const epoch = Date.parse(value);
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || !Number.isFinite(epoch)) {
    fail('INVALID_TIME', field, 'expected a real Gregorian calendar date.');
  }
  return epoch;
}

export function language(value, field) {
  if (typeof value !== 'string' || !/^[a-z]{2,3}(?:-[a-z0-9]{1,8})*$/i.test(value)) {
    fail('INVALID_LANGUAGE', field, 'expected a supported BCP 47 language tag.');
  }
  try { Intl.getCanonicalLocales(value); } catch { fail('INVALID_LANGUAGE', field, 'expected a supported BCP 47 language tag.'); }
  return value;
}

export function list(value, field) {
  if (!Array.isArray(value)) fail('INVALID_INPUT', field, 'expected a dense array.');
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) fail('INVALID_INPUT', field, 'expected a dense array.');
  return value;
}

const publications = new WeakSet();
export function registerPublication(value) { publications.add(value); return value; }
export function assertPublication(value) {
  if (!value || !publications.has(value)) fail('INVALID_PUBLICATION', 'publication', 'use definePublication() from this package instance.');
  return value;
}
