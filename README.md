# @ehven/bot-lists-generator-core

Explicit public inventories and portable generators for robots.txt, llms.txt,
RSS entries, sitemap filtering, humans.txt and security.txt. Zero runtime
dependencies. This development preview is not yet published on npm.

## Try the preview

Prerequisite: Node.js 24.22.3 or later. The current verified runtime is
24.22.3 on Linux; additional runtime/platform coverage is pending.

From a checkout, run `npm pack --ignore-scripts`, then install the resulting
tarball in your consuming project using `npm install /absolute/path/to/the.tgz`.
There are no install hooks, downloads or configuration files to discover.

Create `config/packages/npm/bot-lists-generator-core/publication.mjs` in your project:

```js
import {definePublication} from '@ehven/bot-lists-generator-core';

export default definePublication({
  site: 'https://example.org',
  title: 'Example',
  description: 'A deliberately published public site.',
  privateRoots: ['/members', '/api'],
  pages: [{path: '/', title: 'Home', description: 'Introduction.'}],
});
```

Create `discovery.mjs` at the project root and run `node discovery.mjs`:

```js
import publication from './config/packages/npm/bot-lists-generator-core/publication.mjs';
import {renderDiscovery, renderRobots} from '@ehven/bot-lists-generator-core';

console.log(renderDiscovery(publication));
console.log(renderRobots(publication, {
  crawlerFiles: ['/robots.txt', '/llms.txt'],
  markdown: false,
  sitemap: false,
}));
```

The first result is a short Markdown index linking only to the approved homepage.
The second allows that exact page and the two declared files, then disallows
everything else. Your application serves the generated strings as UTF-8
`text/plain` at the relevant routes. No routes or files are created by the library.

## Contract

- ESM named exports are available at the root and at `/publication`, `/metadata`
  and `/integrations`. CommonJS, a CLI and automatic configuration loading are
  outside this preview. Type declarations accompany the exports; compiler
  compatibility still needs release verification.
- Pass explicit configuration objects. No environment variables, configuration
  precedence or secret providers are consulted. Keep reusable generation logic
  in the package and site identity/approval choices in your application.
- `definePublication({site, title, description, pages, privateRoots=[]})` returns
  a copied, frozen inventory. `site` must be an HTTPS origin without credentials,
  a base path, query or fragment. Page paths are lowercase ASCII directory paths
  ending in `/`, including `/` itself. Protected roots omit their trailing slash.
- Each page has `path`, `title`, `description`, optional `kind` (`page` by default,
  or `article`), optional `draft`, and optional `publishedAt`. Articles require a
  date; `draft: true` is rejected. Unknown page fields are ignored. Duplicate,
  protected, encoded, traversal, uppercase and filename paths are rejected.
- Text can contain Unicode, including Hebrew. Control characters and line
  breaks are rejected; publication text also excludes HTML angle brackets.
  Stored text is preserved and discovery rendering escapes Markdown punctuation.
- Use inventories returned by `definePublication()` from the same package
  instance. Serialized copies are not validated inventories; rebuild one from
  its explicit input if crossing a serialization boundary.
- `markdownPath({path})` returns a page's `/.../index.md` path.
- `renderDiscovery(publication, {markdown=false})` uses canonical HTML links by
  default. Set `markdown: true` only when your application serves those alternates.
- `renderRobots(publication, {assetPaths=[], crawlerFiles=CRAWLER_FILES,
  markdown=true, sitemap='/sitemap-index.xml'})` returns a wildcard-agent policy.
  Page/file allowances are exact; asset paths ending in `/` allow descendants.
  Allowances overlapping a protected root are rejected in either direction.
  The sitemap must be a same-origin file path, or `false` to omit its declaration.
- `CRAWLER_FILES` is the original complete-site compatibility preset: robots,
  llms, sitemap index/child, RSS, humans, well-known/legacy security, full-text
  bundle and JSON inventory paths. It is a list of paths, not route registration.
  Override it with the files your project actually serves. Set `markdown: false`
  when Markdown alternates are absent. Output order follows input order; repeated
  allowances are deduplicated.
- `feedEntries(publication, {now=Date.now()})` returns article records with
  `title`, `description`, canonical `link` and a fresh `pubDate: Date`.
  Selection includes instants at or before `now`, sorted newest first with
  inventory order for ties. `now` is finite epoch milliseconds.
- Publication approval and feed dates are separate: a future-dated approved page
  remains publicly discoverable. Feed selection does not implement an embargo.
- Dates require `YYYY-MM-DDTHH:mm:ss`, optional 1–3 fractional digits and `Z` or
  an explicit numeric offset. Impossible calendar dates, timezone omission,
  leap seconds and sub-millisecond precision are rejected.
- `createSitemapFilter(publication)` returns an exact canonical URL predicate;
  another serializer owns sitemap XML.
- `createRSSOptions(publication, {language, trailingSlash=true, now=Date.now})`
  returns a function producing RSS serializer options. Its clock is a function
  returning epoch milliseconds, evaluated on each call. XML serialization is
  consumer-owned; the option shape follows the existing Astro RSS integration.
- `renderHumans({owner, site, tools=[]})` produces credits with a credential-free
  HTTPS URL and explicit public tool names.
- `renderSecurity({contact, expires, canonical, languages=['en']}, {now=Date.now()})`
  supports one plain mailto/HTTPS contact, the HTTPS well-known canonical URL,
  an explicitly reviewed future expiry no more than 366 days away, and supported
  BCP 47 tags validated by the runtime's `Intl` implementation. It normalizes
  expiry to UTC and never extends it automatically. Serve the canonical file
  under `/.well-known/security.txt`. Redirect a legacy `/security.txt` route to it
  so the retrieval URL agrees with the declared canonical URL.
- Failures throw `BotListsError`, a `TypeError` with `code` and `field`.
  Codes include `INVALID_INPUT`, `INVALID_TEXT`, `INVALID_URL`, `INVALID_PATH`,
  `PROTECTED_PATH`, `DUPLICATE_PATH`, `DRAFT_PAGE`, `INVALID_TIME`,
  `INVALID_LANGUAGE` and `INVALID_PUBLICATION`. Messages identify fields without
  echoing supplied credentials. Do not rely on exact message wording.

## Boundaries and recovery

The caller reviews content and decides what is public. This library does not
authenticate requests or make private assets safe. Robots directives and llms
discovery do not guarantee crawler cooperation, ingestion, rankings or citations.
Do not put private files under an allowed public asset prefix. Never serve private
inventories or approval inputs accidentally.

The library performs no network requests, filesystem writes, telemetry,
background work or global configuration changes. It acquires no resources to
dispose of. Remove its imports and your generated routes/files to remove the
integration; restore a reviewed prior inventory/output through your application's
normal rollback procedure. Caller code owns writes, HTTP policy and caching.

HTML-to-Markdown conversion, full-content bundles, JSON inventory serialization,
bot identity databases, individual AI-provider policies and publishing/hosting
automation are separate responsibilities. Wider URL contracts and additional
formats will require explicit compatibility decisions.

MIT licensed. This is an initial development preview; support commitments and
public reporting destinations will be finalized before a public release.
