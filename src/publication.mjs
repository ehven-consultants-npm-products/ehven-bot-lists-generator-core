import { record, line, httpsURL, boolean, clock, timestamp, list, fail, assertPublication, registerPublication } from './validation.mjs';

const directory = /^\/(?:[a-z0-9-]+\/)*$/;
const protectedRoot = /^\/(?:[a-z0-9-]+\/)*[a-z0-9-]+$/;
const inside = (path, root) => path === root || path.startsWith(`${root}/`);

function text(value, field) {
  line(value, field);
  if (/[<>]/.test(value)) fail('INVALID_TEXT', field, 'HTML angle brackets are unsupported.');
  return value.replace(/[\\[\]*_`]/g, '\\$&');
}

export function definePublication(input) {
  const {site, title, description, pages, privateRoots = []} = record(input, 'publication');
  const origin = httpsURL(site, 'site');
  if (!/^https:\/\/[^/?#]+\/?$/.test(site) || origin.pathname !== '/' || origin.search || origin.hash) {
    fail('INVALID_URL', 'site', 'expected an HTTPS origin without a base path.');
  }
  text(title, 'title'); text(description, 'description');
  list(privateRoots, 'privateRoots');
  if (privateRoots.some(root => typeof root !== 'string' || !protectedRoot.test(root))) {
    fail('INVALID_PATH', 'privateRoots', 'expected canonical roots without trailing slashes.');
  }
  if (!list(pages, 'pages').length) fail('INVALID_INPUT', 'pages', 'at least one explicitly approved page is required.');
  const seen = new Set();
  const entries = pages.map((entry, index) => {
    const page = record(entry, `pages[${index}]`), path = page.path;
    if (typeof path !== 'string' || !directory.test(path)) fail('INVALID_PATH', `pages[${index}].path`, 'expected a canonical lowercase ASCII directory path.');
    if (privateRoots.some(root => inside(path, root))) fail('PROTECTED_PATH', `pages[${index}].path`, 'protected paths cannot be published.');
    if (seen.has(path)) fail('DUPLICATE_PATH', `pages[${index}].path`, 'duplicate published path.');
    seen.add(path); text(page.title, `pages[${index}].title`); text(page.description, `pages[${index}].description`);
    const kind = page.kind ?? 'page';
    if (!['page', 'article'].includes(kind)) fail('INVALID_INPUT', `pages[${index}].kind`, 'expected page or article.');
    if (page.draft !== undefined) boolean(page.draft, `pages[${index}].draft`);
    if (page.draft === true) fail('DRAFT_PAGE', `pages[${index}].draft`, 'draft pages cannot be published.');
    if (page.publishedAt !== undefined) timestamp(page.publishedAt, `pages[${index}].publishedAt`);
    if (kind === 'article' && page.publishedAt === undefined) fail('INVALID_TIME', `pages[${index}].publishedAt`, 'articles require an explicit publication date.');
    return Object.freeze({path, title: page.title, description: page.description, url: new URL(path, origin).href, kind,
      ...(page.publishedAt === undefined ? {} : {publishedAt: page.publishedAt})});
  });
  const publication = Object.freeze({site: origin.origin, title, description, privateRoots: Object.freeze([...privateRoots]), pages: Object.freeze(entries)});
  return registerPublication(publication);
}

export function markdownPath(page) {
  record(page, 'page');
  if (typeof page.path !== 'string' || !directory.test(page.path)) fail('INVALID_PATH', 'page.path', 'expected a canonical directory path.');
  return `${page.path}index.md`;
}

export function renderDiscovery(publication, options = {}) {
  assertPublication(publication);
  const {markdown = false} = record(options, 'options'); boolean(markdown, 'markdown');
  return `# ${text(publication.title, 'title')}\n\n> ${text(publication.description, 'description')}\n\n## Published pages\n\n${publication.pages.map(page => `- [${text(page.title, 'page.title')}](${markdown ? new URL(markdownPath(page), publication.site).href : page.url}): ${text(page.description, 'page.description')}`).join('\n')}\n`;
}

export function feedEntries(publication, options = {}) {
  assertPublication(publication);
  const {now = Date.now()} = record(options, 'options'); clock(now);
  return publication.pages.filter(page => page.kind === 'article' && Date.parse(page.publishedAt) <= now)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .map(page => ({title: page.title, description: page.description, link: page.url, pubDate: new Date(page.publishedAt)}));
}

// Compatibility preset for consumers exposing this complete endpoint set. It creates no routes.
export const CRAWLER_FILES = Object.freeze([
  '/llms.txt', '/robots.txt', '/sitemap-index.xml', '/sitemap-0.xml', '/rss.xml', '/humans.txt',
  '/.well-known/security.txt', '/security.txt', '/llms-full.txt', '/publication.json',
]);

function publicPath(path, publication, field) {
  if (typeof path !== 'string' || !/^\/[a-zA-Z0-9_./-]+$/.test(path) || path.includes('..') || path.includes('//')) {
    fail('INVALID_PATH', field, 'expected an explicit safe public path.');
  }
  if (publication.privateRoots.some(root => inside(path, root) || path.endsWith('/') && root.startsWith(path))) {
    fail('PROTECTED_PATH', field, 'public allowances must not overlap a protected root.');
  }
  return path;
}

export function renderRobots(publication, options = {}) {
  assertPublication(publication);
  const {assetPaths = [], crawlerFiles = CRAWLER_FILES, markdown = true, sitemap = '/sitemap-index.xml'} = record(options, 'options');
  boolean(markdown, 'markdown'); list(assetPaths, 'assetPaths'); list(crawlerFiles, 'crawlerFiles');
  const paths = [...assetPaths, ...crawlerFiles].map(path => publicPath(path, publication, 'publicPaths'));
  if (sitemap !== false) {
    publicPath(sitemap, publication, 'sitemap');
    if (sitemap.endsWith('/')) fail('INVALID_PATH', 'sitemap', 'expected a sitemap file path or false.');
    paths.push(sitemap);
  }
  const allowed = [...new Set([
    ...publication.pages.map(page => `${page.path}$`),
    ...(markdown ? publication.pages.map(page => `${markdownPath(page)}$`) : []),
    ...paths.map(path => path.endsWith('/') ? path : `${path}$`),
  ])];
  return `# Explicit public-page inventory\nUser-agent: *\n${allowed.map(path => `Allow: ${path}`).join('\n')}\nDisallow: /\n${sitemap === false ? '' : `\nSitemap: ${publication.site}${sitemap}\n`}`;
}
