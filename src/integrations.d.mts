import type {Publication, FeedEntry} from './publication.mjs';
export interface RSSOptions {title: string; description: string; site: string; items: FeedEntry[]; customData: string; trailingSlash: boolean}
export declare function createRSSOptions(publication: Publication, choices: {language: string; trailingSlash?: boolean; now?: () => number}): () => RSSOptions;
export declare function createSitemapFilter(publication: Publication): (url: string) => boolean;
