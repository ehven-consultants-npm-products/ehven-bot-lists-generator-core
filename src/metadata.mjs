import {record, line, httpsURL, timestamp, clock, language, list, fail} from './validation.mjs';

export function renderHumans(input) {
  const {owner, site, tools = []} = record(input, 'credits');
  const url = httpsURL(site, 'site');
  line(owner, 'owner'); list(tools, 'tools');
  return `/* TEAM */\nOwner: ${owner}\nSite: ${url.href}\n\n/* SITE */\nTools: ${tools.map(tool => line(tool, 'tools')).join(', ')}\n`;
}

export function renderSecurity(input, options = {}) {
  const {contact, expires, canonical, languages = ['en']} = record(input, 'disclosure');
  const {now = Date.now()} = record(options, 'options'); clock(now);
  line(contact, 'contact');
  let address;
  try { address = new URL(contact); } catch { fail('INVALID_URL', 'contact', 'expected HTTPS or mailto.'); }
  if (address.protocol === 'https:') httpsURL(contact, 'contact');
  else if (address.protocol === 'mailto:') {
    let email;
    try { email = decodeURIComponent(address.pathname); } catch { fail('INVALID_URL', 'contact', 'invalid mailto encoding.'); }
    if (address.search || address.hash || !/^[^\s@<>?]+@[^\s@<>?]+\.[^\s@<>?]+$/.test(email) || /[\u0000-\u001f\u007f-\u009f]/u.test(email)) {
      fail('INVALID_URL', 'contact', 'expected a single plain mailto address.');
    }
  } else fail('INVALID_URL', 'contact', 'expected HTTPS or mailto.');
  if (address.username || address.password || /\s/u.test(contact)) fail('INVALID_URL', 'contact', 'credentials and whitespace are unsupported.');
  const expiry = timestamp(expires, 'expires');
  if (expiry <= now || expiry > now + 366 * 86400000) fail('INVALID_TIME', 'expires', 'must be in the future and no more than 366 days away; review explicitly.');
  const url = httpsURL(canonical, 'canonical');
  if (url.pathname !== '/.well-known/security.txt' || url.search || url.hash) fail('INVALID_URL', 'canonical', 'expected the well-known security.txt URL.');
  if (!list(languages, 'languages').length) fail('INVALID_LANGUAGE', 'languages', 'at least one language is required.');
  languages.forEach(value => language(value, 'languages'));
  return `Contact: ${address.href}\nExpires: ${new Date(expiry).toISOString()}\nCanonical: ${url.href}\nPreferred-Languages: ${languages.join(', ')}\n`;
}
