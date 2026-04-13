export type {
  ResolvedSource,
  ResolverResult,
  RssFeedEntry,
  PodcastEpisodeEntry,
  OpmlOutline,
} from './types.js';

export type { RssDiscoveryResult } from './rss-resolver.js';

export type { ExtractedMetadata } from './generic-resolver.js';

export {
  isYouTubeUrl,
  extractYouTubeVideoId,
  extractYouTubeChannelId,
  getYouTubeChannelFeedUrl,
  resolveYouTubeUrl,
} from './youtube-resolver.js';

export {
  isPodcastUrl,
  extractApplePodcastId,
  extractSpotifyShowId,
  extractXiaoyuzhouShowId,
  buildAppleLookupUrl,
  resolvePodcastUrl,
} from './podcast-resolver.js';

export {
  isRssFeedUrl,
  discoverRssLinks,
  parseRssFeedXml,
  parseOpml,
  exportOpml,
  resolveRssUrl,
} from './rss-resolver.js';

export {
  isNewsletterUrl,
  resolveNewsletterUrl,
} from './newsletter-resolver.js';

export {
  extractMetadataFromHtml,
  resolveGenericUrl,
} from './generic-resolver.js';

export { resolveUrl, routeUrl } from './resolver-router.js';

export type { ResolveOptions, ResolverType, RouteResult } from './resolver-router.js';

// ── Async fetch layer ──────────────────────────────────────

export type { FetchFn, FetchPageOptions } from './fetch-helpers.js';
export { fetchPageHtml, fetchJson, extractMetaContent as extractMeta, stripHtml } from './fetch-helpers.js';

export type { PodcastEpisodeMeta } from './fetch-podcast-episode.js';
export { isPodcastEpisodeUrl, fetchPodcastEpisodeMeta, parseIso8601Duration } from './fetch-podcast-episode.js';

export type { YouTubeVideoMeta } from './fetch-youtube.js';
export { fetchYouTubeVideoMeta, resolveYouTubeChannelFeed } from './fetch-youtube.js';

export type { PodcastSearchResult, PodcastSearchType, PodcastDirectoryOptions, ItunesLookupResult } from './fetch-podcast-directory.js';
export { searchPodcasts, itunesLookup } from './fetch-podcast-directory.js';

export type { ResolvedPodcastFeed } from './fetch-podcast-resolve.js';
export { resolvePodcastFeedUrl } from './fetch-podcast-resolve.js';

export type { ParsedArticle } from './fetch-article-parser.js';
export { parseArticleContent, parseArticleFromHtml } from './fetch-article-parser.js';

export type { FeedFetchOptions, FetchedFeed } from './fetch-rss-feed.js';
export { fetchRssFeed } from './fetch-rss-feed.js';
