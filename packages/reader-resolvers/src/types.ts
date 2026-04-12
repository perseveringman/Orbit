import type { SourceEndpointKind, IsoDateTimeString } from '@orbit/domain';

export interface ResolvedSource {
  readonly kind: SourceEndpointKind;
  readonly feedUrl: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly language: string | null;
  readonly iconUrl: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ResolverResult {
  readonly ok: boolean;
  readonly source: ResolvedSource | null;
  readonly error: string | null;
  readonly resolverUsed: string;
}

export interface RssFeedEntry {
  readonly title: string;
  readonly url: string;
  readonly publishedAt: IsoDateTimeString | null;
  readonly author: string | null;
  readonly summary: string | null;
  readonly contentUrl: string | null;
}

export interface PodcastEpisodeEntry {
  readonly title: string;
  readonly audioUrl: string;
  readonly duration: number | null;
  readonly publishedAt: IsoDateTimeString | null;
  readonly summary: string | null;
  readonly episodeNumber: number | null;
  readonly seasonNumber: number | null;
}

export interface OpmlOutline {
  readonly title: string;
  readonly xmlUrl: string;
  readonly htmlUrl: string | null;
  readonly type: string | null;
}
