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
