import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {definePublication, renderDiscovery, renderRobots, feedEntries, markdownPath, renderHumans, renderSecurity, createSitemapFilter, createRSSOptions, CRAWLER_FILES, BotListsError} from '../src/index.mjs';

const base = () => ({site: 'https://example.org', title: 'Example', description: 'Public site', privateRoots: ['/coach', '/api'], pages: [{path: '/', title: 'Home', description: 'Home'}]});
const now = Date.parse('2026-11-20T00:00:00Z');
const disclosure = () => ({contact: 'mailto:security@example.org', expires: '2027-01-01T00:00:00Z', canonical: 'https://example.org/.well-known/security.txt'});
const rejects = (fn, code, field) => assert.throws(fn, error => error instanceof BotListsError && error.code === code && (!field || error.field === field));

test('approved inventory is normalized, copied, deeply frozen and independently instantiated', () => {
  const input = base(), publication = definePublication(input);
  input.pages[0].title = 'Changed'; input.privateRoots.push('/elsewhere');
  assert.equal(publication.pages[0].title, 'Home');
  assert.deepEqual(publication.privateRoots, ['/coach', '/api']);
  assert.equal(publication.site, 'https://example.org');
  assert.equal(publication.pages[0].url, 'https://example.org/');
  for (const value of [publication, publication.pages, publication.pages[0], publication.privateRoots]) assert.ok(Object.isFrozen(value));
  assert.notEqual(publication, definePublication(base()));
});

test('unsupported origins and protected/ambiguous/duplicate page paths fail with useful codes', () => {
  for (const site of ['http://example.org', 'https://u:p@example.org', 'https://example.org/docs/', 'https://example.org?draft=1', 'https://example.org/#x']) rejects(() => definePublication({...base(), site}), 'INVALID_URL');
  for (const path of ['/coach/', '/coach/firefly/', '/api/']) rejects(() => definePublication({...base(), pages: [{...base().pages[0], path}]}), 'PROTECTED_PATH');
  for (const path of ['/Upper/', '//evil.org/', '/%63oach/', '/about/?a=1', '/about/../coach/', '/file.html', '/שלום/']) rejects(() => definePublication({...base(), pages: [{...base().pages[0], path}]}), 'INVALID_PATH');
  rejects(() => definePublication({...base(), pages: [base().pages[0], base().pages[0]]}), 'DUPLICATE_PATH');
});

test('invalid input shapes and sparse arrays are rejected at their own boundaries', () => {
  for (const input of [null, [], undefined, 'bad']) rejects(() => definePublication(input), 'INVALID_INPUT');
  for (const pages of [[], null, [null], Array(1)]) rejects(() => definePublication({...base(), pages}), 'INVALID_INPUT');
  rejects(() => definePublication({...base(), privateRoots: ['/coach/']}), 'INVALID_PATH');
  rejects(() => definePublication({...base(), pages: [{...base().pages[0], draft: 'false'}]}), 'INVALID_INPUT');
  rejects(() => definePublication({...base(), pages: [{...base().pages[0], draft: true}]}), 'DRAFT_PAGE');
});

test('controls and line injection are rejected, with valid text as a positive control', () => {
  assert.match(renderDiscovery(definePublication(base())), /# Example/);
  for (const title of ['Bad\nInjected', 'Bad\rInjected', 'Bad\0Injected', 'Bad\x7fInjected', 'Bad\u0085Injected', 'Bad\u2028Injected', '<b>Bad</b>']) {
    rejects(() => definePublication({...base(), title}), 'INVALID_TEXT', 'title');
  }
});

test('discovery preserves Unicode and escapes Markdown punctuation without changing stored titles', () => {
  const publication = definePublication({...base(), title: 'שלום [site] *a*'});
  assert.equal(publication.title, 'שלום [site] *a*');
  assert.match(renderDiscovery(publication), /שלום \\\[site\\\] \\\*a\\\*/u);
  assert.match(renderDiscovery(publication), /\]\(https:\/\/example.org\/\)/);
  assert.match(renderDiscovery(publication, {markdown: true}), /https:\/\/example.org\/index.md/);
  assert.equal(markdownPath({path: '/guide/'}), '/guide/index.md');
});

test('renderers require a validated inventory and reject ambiguous booleans', () => {
  const publication = definePublication(base());
  for (const fn of [renderDiscovery, renderRobots, feedEntries, createSitemapFilter]) rejects(() => fn({...publication}), 'INVALID_PUBLICATION');
  rejects(() => renderDiscovery(publication, {markdown: 'yes'}), 'INVALID_INPUT');
  rejects(() => renderRobots(publication, {markdown: 1}), 'INVALID_INPUT');
});

test('robots preserves exact page and asset-prefix semantics and never emits protected roots', () => {
  const publication = definePublication({...base(), pages: [...base().pages, {path: '/article/example/', title: 'A', description: 'A'}]});
  const output = renderRobots(publication, {assetPaths: ['/_astro/']});
  assert.match(output, /^Allow: \/\$$/m); assert.match(output, /^Allow: \/article\/example\/\$$/m);
  assert.match(output, /^Allow: \/article\/example\/index.md\$$/m); assert.match(output, /^Allow: \/_astro\/$/m);
  assert.match(output, /^Disallow: \/$/m); assert.doesNotMatch(output, /coach|prerelease/);
  assert.equal(output.match(/^Allow: \/sitemap-index.xml\$$/gm).length, 1);
  assert.ok(Object.isFrozen(CRAWLER_FILES));
});

test('robots rejects protected descendants, protected ancestors and directive injection', () => {
  const publication = definePublication({...base(), privateRoots: ['/assets/private', '/coach']});
  for (const path of ['/coach/', '/coach/private.jpg', '/assets/private/', '/assets/']) rejects(() => renderRobots(publication, {assetPaths: [path]}), 'PROTECTED_PATH');
  for (const path of ['/assets/../coach/', '/assets/\nAllow: /coach/', '//evil.org/', '/assets/%2f']) rejects(() => renderRobots(publication, {assetPaths: [path]}), 'INVALID_PATH');
  assert.match(renderRobots(publication, {assetPaths: ['/assets/public/']}), /^Allow: \/assets\/public\/$/m);
});

test('auxiliary routes, Markdown and sitemap are explicitly selectable', () => {
  const publication = definePublication(base());
  const output = renderRobots(publication, {crawlerFiles: ['/robots.txt'], markdown: false, sitemap: '/sitemap.xml'});
  assert.match(output, /^Sitemap: https:\/\/example.org\/sitemap.xml$/m);
  assert.match(output, /^Allow: \/sitemap.xml\$$/m);
  assert.doesNotMatch(output, /index.md|rss.xml|llms-full|publication.json|sitemap-index/);
  assert.doesNotMatch(renderRobots(publication, {crawlerFiles: [], markdown: false, sitemap: false}), /Sitemap:/);
  rejects(() => renderRobots(publication, {sitemap: '/api/map.xml'}), 'PROTECTED_PATH');
  rejects(() => renderRobots(publication, {sitemap: '/maps/'}), 'INVALID_PATH');
});

test('calendar validation rejects normalization, timezone omission, leap seconds and malformed precision', () => {
  for (const publishedAt of ['2026-02-31T00:00:00Z', '2026-02-29T00:00:00Z', '2026-01-01T10:00:00', '2026-01-01T24:00:00Z', '2026-01-01T00:00:60Z', '2026-01-01T00:00:00.1234Z', '2026-13-01T00:00:00Z']) {
    rejects(() => definePublication({...base(), pages: [{...base().pages[0], publishedAt}]}), 'INVALID_TIME');
    rejects(() => renderSecurity({...disclosure(), expires: publishedAt}, {now}), 'INVALID_TIME');
  }
  assert.ok(definePublication({...base(), pages: [{...base().pages[0], publishedAt: '2028-02-29T12:00:00+02:00'}]}));
});

test('feeds sort by instant, exclude future articles, retain stable ties and do not implement embargoes', () => {
  const article = (path, publishedAt) => ({path, title: path, description: path, kind: 'article', publishedAt});
  const publication = definePublication({...base(), pages: [...base().pages, article('/old/', '2026-01-01T00:00:00Z'), article('/tie-a/', '2026-11-20T00:00:00Z'), article('/tie-b/', '2026-11-20T01:00:00+01:00'), article('/future/', '2099-01-01T00:00:00Z')]});
  assert.deepEqual(feedEntries(publication, {now}).map(item => item.link), ['https://example.org/tie-a/', 'https://example.org/tie-b/', 'https://example.org/old/']);
  assert.match(renderDiscovery(publication), /future/);
  const first = feedEntries(publication, {now}); first[0].pubDate.setTime(0);
  assert.equal(feedEntries(publication, {now})[0].pubDate.getTime(), now);
  for (const value of [NaN, Infinity, 'today', null]) rejects(() => feedEntries(publication, {now: value}), 'INVALID_TIME');
});

test('humans injection regression reaches the renderer, with valid fixture and expected error', () => {
  const config = {owner: 'Example', site: base().site, tools: ['Node.js']};
  assert.match(renderHumans(config), /Owner: Example/);
  rejects(() => renderHumans({...config, owner: 'Injected\nField: value'}), 'INVALID_TEXT', 'owner');
  rejects(() => renderHumans({...config, site: 'https://alice:secret@example.org/'}), 'INVALID_URL', 'site');
  rejects(() => renderHumans({...config, tools: 'Node'}), 'INVALID_INPUT', 'tools');
  rejects(() => renderHumans({...config, tools: ['Node\nInjected']}), 'INVALID_TEXT');
});

test('errors identify the field without echoing supplied credentials', () => {
  assert.throws(() => renderHumans({owner: 'Example', site: 'https://alice:secret@example.org/'}), error => error instanceof BotListsError && error.field === 'site' && !/alice|secret/.test(error.message));
});

test('security rendering normalizes valid instants and requires deliberate expiry', () => {
  const output = renderSecurity({...disclosure(), expires: '2027-01-01T01:00:00+01:00', languages: ['en-US', 'he']}, {now});
  assert.equal(output, 'Contact: mailto:security@example.org\nExpires: 2027-01-01T00:00:00.000Z\nCanonical: https://example.org/.well-known/security.txt\nPreferred-Languages: en-US, he\n');
  for (const expires of [new Date(now).toISOString(), new Date(now - 1).toISOString(), new Date(now + 366 * 86400000 + 1).toISOString()]) rejects(() => renderSecurity({...disclosure(), expires}, {now}), 'INVALID_TIME');
  assert.ok(renderSecurity({...disclosure(), expires: new Date(now + 366 * 86400000).toISOString()}, {now}));
});

test('security rejects unsafe contacts and canonical aliases', () => {
  for (const contact of ['javascript:bad', 'https://u:p@example.org', 'mailto:a@b.org\nPolicy: fake', 'mailto:a%0Ab@c.org', 'mailto:a@b.org?subject=x', 'mailto:a@b.org#x']) rejects(() => renderSecurity({...disclosure(), contact}, {now}), contact.includes('\n') ? 'INVALID_TEXT' : 'INVALID_URL');
  for (const canonical of ['http://example.org/.well-known/security.txt', 'https://u:p@example.org/.well-known/security.txt', 'https://example.org/security.txt', 'https://example.org/.well-known/security.txt?x=1']) rejects(() => renderSecurity({...disclosure(), canonical}, {now}), 'INVALID_URL');
  assert.match(renderSecurity({...disclosure(), contact: 'https://example.org/report/'}, {now}), /^Contact: https:/m);
});

test('language options reject malformed tags and accept supported Hebrew/English tags', () => {
  const publication = definePublication(base());
  for (const tag of ['en-123456789', 'en-<script>', '', 4, 'en--US', 'undefined']) {
    rejects(() => renderSecurity({...disclosure(), languages: [tag]}, {now}), 'INVALID_LANGUAGE');
    rejects(() => createRSSOptions(publication, {language: tag}), 'INVALID_LANGUAGE');
  }
  rejects(() => renderSecurity({...disclosure(), languages: []}, {now}), 'INVALID_LANGUAGE');
  assert.match(createRSSOptions(publication, {language: 'he-IL', now: () => now})().customData, /^<language>he-IL<\/language>$/);
});

test('RSS options read the clock at serialization time and sitemap uses exact membership', () => {
  const publication = definePublication({...base(), pages: [{...base().pages[0], kind: 'article', publishedAt: '2026-11-20T00:00:00Z'}]});
  let current = now - 1;
  const options = createRSSOptions(publication, {language: 'en-us', trailingSlash: false, now: () => current});
  assert.equal(options().items.length, 0); current = now; assert.equal(options().items.length, 1);
  assert.equal(options().trailingSlash, false);
  const filter = createSitemapFilter(publication);
  assert.equal(filter('https://example.org/'), true);
  for (const url of ['https://example.org/?x=1', 'https://example.org/coach/', 'https://other.org/', 'https://example.org', null]) assert.equal(filter(url), false);
  rejects(() => createRSSOptions(publication, {language: 'en', now: 3}), 'INVALID_TIME');
});

test('explicit timestamps render identically across process timezones; implicit timestamps fail in both', () => {
  const moduleURL = new URL('../src/metadata.mjs', import.meta.url).href;
  const code = `import {renderSecurity} from ${JSON.stringify(moduleURL)}; console.log(renderSecurity(${JSON.stringify(disclosure())}, {now:${now}})); try { renderSecurity(${JSON.stringify({...disclosure(), expires: '2027-01-01T00:00:00'})}, {now:${now}}) } catch (e) { console.log(e.code) }`;
  const run = TZ => spawnSync(process.execPath, ['--input-type=module', '-e', code], {env: {PATH: process.env.PATH, TZ}, encoding: 'utf8', timeout: 5000});
  const utc = run('UTC'), ny = run('America/New_York');
  assert.equal(utc.status, 0, utc.stderr); assert.equal(ny.status, 0, ny.stderr);
  assert.equal(utc.stdout, ny.stdout); assert.match(utc.stdout, /INVALID_TIME/);
});
