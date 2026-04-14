import { useMemo } from 'react';
import { useOrbitData } from './orbit-data-context';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PodcastEpisodeMetadata {
  audioUrl: string | null;
  duration: string | null;
  durationSeconds: number | null;
  artwork: string | null;
  showNotes: string | null;
}

export interface PodcastShowInfo {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
}

export interface PodcastPlaybackPosition {
  currentTime: number;
  lastUpdated: string | null;
}

export interface PodcastTranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface PodcastTranscriptState {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  segments: PodcastTranscriptSegment[] | null;
  fullText: string | null;
}

export interface PodcastTranslationState {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  targetLocale: string;
  translatedText: string | null;
}

export interface PodcastSummaryState {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  summaryText: string | null;
  keyPoints: string[] | null;
}

export interface PodcastHighlight {
  id: string;
  quoteText: string;
  timestampSeconds: number | null;
  color: string | null;
  note: string | null;
}

export interface PodcastReaderViewModel {
  articleId: string;
  title: string;
  author: string | null;
  sourceUrl: string | null;
  status: 'unread' | 'reading' | 'archived';
  readingProgress: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  
  show: PodcastShowInfo | null;
  episode: PodcastEpisodeMetadata | null;
  playback: PodcastPlaybackPosition;
  
  transcript: PodcastTranscriptState;
  translation: PodcastTranslationState | null;
  summary: PodcastSummaryState;
  
  highlights: PodcastHighlight[];
}

// ── Pure Mapper Functions ──────────────────────────────────────────────────

type DerivativeAssetStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Validates and normalizes status strings from DB to typed union values.
 * Falls back to 'pending' for any invalid or null status.
 */
function normalizeDerivativeStatus(status: unknown): DerivativeAssetStatus {
  if (typeof status === 'string' && 
      (status === 'pending' || status === 'processing' || status === 'completed' || status === 'failed')) {
    return status;
  }
  return 'pending';
}

export function getEpisodeMetadata(contentItemRow: Record<string, unknown> | null): PodcastEpisodeMetadata | null {
  if (!contentItemRow) return null;
  
  try {
    const rawJson = contentItemRow.raw_json as string;
    if (!rawJson) return null;
    
    const parsed = JSON.parse(rawJson);
    return {
      audioUrl: parsed.audioUrl ?? null,
      duration: parsed.duration ?? null,
      durationSeconds: parsed.durationSeconds ?? null,
      artwork: parsed.artwork ?? null,
      showNotes: parsed.showNotes ?? null,
    };
  } catch {
    return null;
  }
}

export function extractTranscriptState(derivativeAssets: Record<string, unknown>[]): PodcastTranscriptState {
  const transcriptAsset = derivativeAssets.find(
    (asset) => asset.asset_type === 'transcript'
  );
  
  if (!transcriptAsset) {
    return {
      status: 'pending',
      progress: 0,
      segments: null,
      fullText: null,
    };
  }
  
  const status = normalizeDerivativeStatus(transcriptAsset.status);
  const progress = typeof transcriptAsset.progress === 'number' ? transcriptAsset.progress : 0;
  
  try {
    const contentJson = transcriptAsset.content_json as string | null;
    if (!contentJson) {
      return {
        status,
        progress,
        segments: null,
        fullText: null,
      };
    }
    
    const parsed = JSON.parse(contentJson);
    return {
      status,
      progress,
      segments: parsed.segments ?? null,
      fullText: parsed.fullText ?? null,
    };
  } catch {
    return {
      status,
      progress,
      segments: null,
      fullText: null,
    };
  }
}

export function extractTranslationState(
  derivativeAssets: Record<string, unknown>[],
  targetLocale: string
): PodcastTranslationState {
  const translationAsset = derivativeAssets.find(
    (asset) => asset.asset_type === 'translation' && asset.target_locale === targetLocale
  );
  
  if (!translationAsset) {
    return {
      status: 'pending',
      progress: 0,
      targetLocale,
      translatedText: null,
    };
  }
  
  const status = normalizeDerivativeStatus(translationAsset.status);
  const progress = typeof translationAsset.progress === 'number' ? translationAsset.progress : 0;
  
  try {
    const contentJson = translationAsset.content_json as string | null;
    if (!contentJson) {
      return {
        status,
        progress,
        targetLocale,
        translatedText: null,
      };
    }
    
    const parsed = JSON.parse(contentJson);
    return {
      status,
      progress,
      targetLocale,
      translatedText: parsed.translatedText ?? null,
    };
  } catch {
    return {
      status,
      progress,
      targetLocale,
      translatedText: null,
    };
  }
}

export function extractSummaryState(derivativeAssets: Record<string, unknown>[]): PodcastSummaryState {
  const summaryAsset = derivativeAssets.find(
    (asset) => asset.asset_type === 'summary'
  );
  
  if (!summaryAsset) {
    return {
      status: 'pending',
      progress: 0,
      summaryText: null,
      keyPoints: null,
    };
  }
  
  const status = normalizeDerivativeStatus(summaryAsset.status);
  const progress = typeof summaryAsset.progress === 'number' ? summaryAsset.progress : 0;
  
  try {
    const contentJson = summaryAsset.content_json as string | null;
    if (!contentJson) {
      return {
        status,
        progress,
        summaryText: null,
        keyPoints: null,
      };
    }
    
    const parsed = JSON.parse(contentJson);
    return {
      status,
      progress,
      summaryText: parsed.summaryText ?? null,
      keyPoints: parsed.keyPoints ?? null,
    };
  } catch {
    return {
      status,
      progress,
      summaryText: null,
      keyPoints: null,
    };
  }
}

export function getPodcastPlaybackPosition(lastReadPositionJson: string | null): PodcastPlaybackPosition {
  if (!lastReadPositionJson) {
    return {
      currentTime: 0,
      lastUpdated: null,
    };
  }
  
  try {
    const parsed = JSON.parse(lastReadPositionJson);
    return {
      currentTime: parsed.currentTime ?? 0,
      lastUpdated: parsed.lastUpdated ?? null,
    };
  } catch {
    return {
      currentTime: 0,
      lastUpdated: null,
    };
  }
}

function mapHighlightRow(row: Record<string, unknown>): PodcastHighlight {
  let timestampSeconds: number | null = null;
  
  try {
    const anchorJson = row.anchor_json as string;
    if (anchorJson) {
      const parsed = JSON.parse(anchorJson);
      timestampSeconds = parsed.timestampSeconds ?? null;
    }
  } catch {
    // Ignore parse errors
  }
  
  return {
    id: row.id as string,
    quoteText: row.quote_text as string,
    timestampSeconds,
    color: (row.color as string) ?? null,
    note: (row.note as string) ?? null,
  };
}

export function mapPodcastArticleToReader(
  article: Record<string, unknown>,
  sourceEndpoint: Record<string, unknown> | null,
  contentItem: Record<string, unknown> | null,
  derivativeAssets: Record<string, unknown>[],
  highlights: Record<string, unknown>[],
  targetLocale?: string,
): PodcastReaderViewModel {
  const episodeMetadata = getEpisodeMetadata(contentItem);
  const playback = getPodcastPlaybackPosition((article.last_read_position as string) ?? null);
  const transcript = extractTranscriptState(derivativeAssets);
  const summary = extractSummaryState(derivativeAssets);
  const translation = targetLocale ? extractTranslationState(derivativeAssets, targetLocale) : null;
  
  let showInfo: PodcastShowInfo | null = null;
  if (sourceEndpoint) {
    showInfo = {
      id: sourceEndpoint.id as string,
      title: sourceEndpoint.title as string,
      url: (sourceEndpoint.url as string) ?? null,
      description: (sourceEndpoint.description as string) ?? null,
    };
  }
  
  return {
    articleId: article.id as string,
    title: article.title as string,
    author: (article.author as string) ?? null,
    sourceUrl: (article.source_url as string) ?? null,
    status: ((article.status as string) || 'unread') as PodcastReaderViewModel['status'],
    readingProgress: typeof article.reading_progress === 'number' ? article.reading_progress : 0,
    publishedAt: (article.published_at as string) ?? null,
    createdAt: article.created_at as string,
    updatedAt: article.updated_at as string,
    
    show: showInfo,
    episode: episodeMetadata,
    playback,
    
    transcript,
    translation,
    summary,
    
    highlights: highlights.map(mapHighlightRow),
  };
}

// ── React Hook ─────────────────────────────────────────────────────────────

export function usePodcastReader(
  articleId: string | null,
  targetLocale?: string
): { podcast: PodcastReaderViewModel | null; loading: boolean } {
  const { db, version, ready } = useOrbitData();
  
  return useMemo(() => {
    if (!ready || !db || !articleId) {
      return { podcast: null, loading: !ready };
    }
    
    try {
      // Fetch article
      const articleRows = db.query<Record<string, unknown>>(
        "SELECT * FROM articles WHERE id = ? AND media_type = 'podcast' AND deleted_flg = 0",
        [articleId]
      );
      
      if (articleRows.length === 0) {
        return { podcast: null, loading: false };
      }
      
      const article = articleRows[0];
      
      // Fetch source endpoint (show)
      let sourceEndpoint: Record<string, unknown> | null = null;
      if (article.source_endpoint_id) {
        const endpointRows = db.query<Record<string, unknown>>(
          'SELECT * FROM source_endpoints WHERE id = ? AND deleted_flg = 0',
          [article.source_endpoint_id]
        );
        sourceEndpoint = endpointRows[0] ?? null;
      }
      
      // Fetch content item (episode metadata)
      let contentItem: Record<string, unknown> | null = null;
      if (article.content_item_id) {
        const contentItemRows = db.query<Record<string, unknown>>(
          'SELECT * FROM content_items WHERE id = ? AND deleted_flg = 0',
          [article.content_item_id]
        );
        contentItem = contentItemRows[0] ?? null;
      }
      
      // Fetch derivative assets (transcript, translation, summary)
      const derivativeAssets = db.query<Record<string, unknown>>(
        'SELECT * FROM derivative_assets WHERE source_object_id = ? AND deleted_flg = 0',
        [articleId]
      );
      
      // Fetch highlights
      const highlights = db.query<Record<string, unknown>>(
        "SELECT * FROM highlights WHERE source_object_type = 'article' AND source_object_id = ? AND deleted_flg = 0 ORDER BY created_at ASC",
        [articleId]
      );
      
      const podcast = mapPodcastArticleToReader(
        article,
        sourceEndpoint,
        contentItem,
        derivativeAssets,
        highlights,
        targetLocale
      );
      
      return { podcast, loading: false };
    } catch {
      return { podcast: null, loading: false };
    }
  }, [db, version, ready, articleId, targetLocale]);
}
