import {definePublication, renderDiscovery, renderRobots, feedEntries, markdownPath, renderHumans, renderSecurity, createSitemapFilter, createRSSOptions, CRAWLER_FILES, BotListsError} from '@ehven/bot-lists-generator-core';
import type {Publication, PublicationInput, FeedEntry} from '@ehven/bot-lists-generator-core/publication';
import type {DisclosureInput} from '@ehven/bot-lists-generator-core/metadata';
import type {RSSOptions} from '@ehven/bot-lists-generator-core/integrations';

const input: PublicationInput = {site: 'https://example.org', title: 'Example', description: 'Public site', pages: [{path: '/', title: 'Home', description: 'Home'}]};
const publication: Publication = definePublication(input);
const discovery: string = renderDiscovery(publication, {markdown: false});
const robots: string = renderRobots(publication, {crawlerFiles: CRAWLER_FILES, markdown: false, sitemap: false});
const entries: FeedEntry[] = feedEntries(publication, {now: 1});
const path: string = markdownPath(publication.pages[0]);
const credits: string = renderHumans({owner: 'Example', site: input.site, tools: ['Node']});
const disclosure: DisclosureInput = {contact: 'mailto:security@example.org', expires: '2027-01-01T00:00:00Z', canonical: 'https://example.org/.well-known/security.txt'};
const security: string = renderSecurity(disclosure, {now: 1});
const rss: RSSOptions = createRSSOptions(publication, {language: 'he-IL', now: () => 1})();
const filter: boolean = createSitemapFilter(publication)('https://example.org/');
const diagnostic = new BotListsError('INVALID_INPUT', 'site', 'expected HTTPS');
// @ts-expect-error the exported constructor requires code, field and message
new BotListsError('message');
function diagnostics(error: unknown): string { return error instanceof BotListsError ? `${error.code}:${error.field}` : 'other'; }
void [discovery, robots, entries, path, credits, security, rss, filter, diagnostics, diagnostic];

// @ts-expect-error inventories must be constructed by definePublication
const forged: Publication = {site: input.site, title: input.title, description: input.description, pages: [], privateRoots: []};
// @ts-expect-error inventory pages are readonly
publication.pages.push(publication.pages[0]);
// @ts-expect-error metadata is readonly
publication.pages[0].title = 'Changed';
// @ts-expect-error booleans are not strings
renderRobots(publication, {markdown: 'false'});
// @ts-expect-error feed clock is epoch milliseconds
feedEntries(publication, {now: 'today'});
// @ts-expect-error RSS receives a clock function
createRSSOptions(publication, {language: 'en', now: 1});
// @ts-expect-error unsupported publication kind
definePublication({...input, pages: [{...input.pages[0], kind: 'private'}]});
// @ts-expect-error tools must be an array
renderHumans({owner: 'Example', site: input.site, tools: 'Node'});
void forged;
