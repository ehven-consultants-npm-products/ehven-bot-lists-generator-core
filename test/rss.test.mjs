import test from 'node:test';
import assert from 'node:assert/strict';
import rss from '@astrojs/rss';
import {definePublication, createRSSOptions, feedEntries} from '../src/index.mjs';

const now = Date.parse('2026-11-22T00:00:00Z');
const article = (path, title, publishedAt) => ({path, title, description: `Description: ${title}`, kind: 'article', publishedAt});

test('official Astro RSS serializer preserves escaping, ordering, dates and language', async () => {
  const publication = definePublication({site: 'https://example.org', title: 'A & B', description: 'Public & useful', pages: [
    article('/old/', 'Older', '2026-01-01T00:00:00Z'),
    article('/new/', 'שלום & [New]', '2026-11-22T01:00:00+01:00'),
    article('/future/', 'Not in feed', '2099-01-01T00:00:00Z'),
  ]});
  const response = await rss(createRSSOptions(publication, {language: 'he-IL', now: () => now})());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /xml/);
  const xml = await response.text();
  assert.match(xml, /<title>A &amp; B<\/title>/);
  assert.match(xml, /<title>שלום &amp; \[New\]<\/title>/u);
  assert.match(xml, /<language>he-IL<\/language>/);
  assert.deepEqual([...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map(match => match[1]), feedEntries(publication, {now}).map(entry => entry.link));
  assert.match(xml, /Sun, 22 Nov 2026 00:00:00 GMT/);
  assert.doesNotMatch(xml, /Not in feed|future/);
});

test('official serializer accepts intentionally empty feeds and repeated serialization', async () => {
  const publication = definePublication({site: 'https://example.org', title: 'Example', description: 'Public site', pages: [{path: '/', title: 'Home', description: 'Home'}]});
  const options = createRSSOptions(publication, {language: 'en-us', trailingSlash: false, now: () => now});
  const one = await (await rss(options())).text(), two = await (await rss(options())).text();
  assert.equal(one, two);
  assert.doesNotMatch(one, /<item>/);
  assert.match(one, /<language>en-us<\/language>/);
});
