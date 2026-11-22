import {feedEntries} from './publication.mjs';
import {record, language, boolean, fail, clock, assertPublication} from './validation.mjs';

export function createRSSOptions(publication, choices) {
  assertPublication(publication);
  const {language: feedLanguage, trailingSlash = true, now = Date.now} = record(choices, 'choices');
  language(feedLanguage, 'language'); boolean(trailingSlash, 'trailingSlash');
  if (typeof now !== 'function') fail('INVALID_TIME', 'now', 'expected an epoch-millisecond clock function.');
  return () => ({title: publication.title, description: publication.description, site: publication.site,
    items: feedEntries(publication, {now: clock(now())}), customData: `<language>${feedLanguage}</language>`, trailingSlash});
}

export function createSitemapFilter(publication) {
  assertPublication(publication);
  const urls = new Set(publication.pages.map(page => page.url));
  return page => typeof page === 'string' && urls.has(page);
}
