export interface PageInput {
  path: string;
  title: string;
  description: string;
  kind?: 'page' | 'article';
  draft?: boolean;
  publishedAt?: string;
}
export interface PublicationInput {
  site: string;
  title: string;
  description: string;
  pages: readonly PageInput[];
  privateRoots?: readonly string[];
}
export interface PublishedPage {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly kind: 'page' | 'article';
  readonly url: string;
  readonly publishedAt?: string;
}
declare const publicationBrand: unique symbol;
export interface Publication {
  readonly [publicationBrand]: true;
  readonly site: string;
  readonly title: string;
  readonly description: string;
  readonly privateRoots: readonly string[];
  readonly pages: readonly PublishedPage[];
}
export interface FeedEntry { title: string; description: string; link: string; pubDate: Date }
export interface RobotsOptions {
  assetPaths?: readonly string[];
  crawlerFiles?: readonly string[];
  markdown?: boolean;
  sitemap?: string | false;
}
export declare function definePublication(input: PublicationInput): Publication;
export declare function markdownPath(page: Pick<PageInput, 'path'>): string;
export declare function renderDiscovery(publication: Publication, options?: {markdown?: boolean}): string;
export declare function feedEntries(publication: Publication, options?: {now?: number}): FeedEntry[];
export declare const CRAWLER_FILES: readonly string[];
export declare function renderRobots(publication: Publication, options?: RobotsOptions): string;
