import { describe, it, expect, beforeEach } from 'vitest';
import { DatabasePort } from '@orbit/platform-contracts';
import {
  mapPodcastArticleToReader,
  extractTranscriptState,
  extractTranslationState,
  extractSummaryState,
  getEpisodeMetadata,
  getPodcastPlaybackPosition,
  type PodcastReaderViewModel,
  type PodcastTranscriptState,
  type PodcastTranslationState,
  type PodcastSummaryState,
  type PodcastEpisodeMetadata,
} from './use-podcast-reader';

describe('use-podcast-reader — Pure mappers', () => {
  describe('getEpisodeMetadata', () => {
    it('returns null when no content item', () => {
      const result = getEpisodeMetadata(null);
      expect(result).toBeNull();
    });

    it('extracts metadata from content_items.raw_json', () => {
      const contentItemRow = {
        id: 'ci-1',
        raw_json: JSON.stringify({
          audioUrl: 'https://example.com/episode.mp3',
          duration: '1:23:45',
          durationSeconds: 5025,
          artwork: 'https://example.com/art.jpg',
          showNotes: '<p>Episode show notes</p>',
        }),
      };

      const result = getEpisodeMetadata(contentItemRow);
      expect(result).toEqual({
        audioUrl: 'https://example.com/episode.mp3',
        duration: '1:23:45',
        durationSeconds: 5025,
        artwork: 'https://example.com/art.jpg',
        showNotes: '<p>Episode show notes</p>',
      });
    });

    it('handles missing fields gracefully', () => {
      const contentItemRow = {
        id: 'ci-1',
        raw_json: JSON.stringify({
          audioUrl: 'https://example.com/episode.mp3',
        }),
      };

      const result = getEpisodeMetadata(contentItemRow);
      expect(result).toEqual({
        audioUrl: 'https://example.com/episode.mp3',
        duration: null,
        durationSeconds: null,
        artwork: null,
        showNotes: null,
      });
    });

    it('returns null for malformed JSON', () => {
      const contentItemRow = {
        id: 'ci-1',
        raw_json: 'not valid json',
      };

      const result = getEpisodeMetadata(contentItemRow);
      expect(result).toBeNull();
    });
  });

  describe('extractTranscriptState', () => {
    it('returns pending when no transcript asset exists', () => {
      const result = extractTranscriptState([]);
      expect(result).toEqual({
        status: 'pending',
        progress: 0,
        segments: null,
        fullText: null,
      });
    });

    it('extracts transcript from completed derivative asset', () => {
      const assets = [
        {
          id: 'da-1',
          asset_type: 'transcript',
          status: 'completed',
          progress: 1.0,
          content_json: JSON.stringify({
            segments: [
              { start: 0, end: 5, text: 'Hello world' },
              { start: 5, end: 10, text: 'This is a test' },
            ],
            fullText: 'Hello world. This is a test.',
          }),
        },
      ];

      const result = extractTranscriptState(assets);
      expect(result).toEqual({
        status: 'completed',
        progress: 1.0,
        segments: [
          { start: 0, end: 5, text: 'Hello world' },
          { start: 5, end: 10, text: 'This is a test' },
        ],
        fullText: 'Hello world. This is a test.',
      });
    });

    it('returns processing status with progress', () => {
      const assets = [
        {
          id: 'da-1',
          asset_type: 'transcript',
          status: 'processing',
          progress: 0.5,
          content_json: null,
        },
      ];

      const result = extractTranscriptState(assets);
      expect(result).toEqual({
        status: 'processing',
        progress: 0.5,
        segments: null,
        fullText: null,
      });
    });

    it('handles malformed content_json gracefully', () => {
      const assets = [
        {
          id: 'da-1',
          asset_type: 'transcript',
          status: 'completed',
          progress: 1.0,
          content_json: 'invalid json',
        },
      ];

      const result = extractTranscriptState(assets);
      expect(result).toEqual({
        status: 'completed',
        progress: 1.0,
        segments: null,
        fullText: null,
      });
    });
  });

  describe('extractTranslationState', () => {
    it('returns pending when no translation asset exists', () => {
      const result = extractTranslationState([], 'en');
      expect(result).toEqual({
        status: 'pending',
        progress: 0,
        targetLocale: 'en',
        translatedText: null,
      });
    });

    it('extracts translation for matching locale', () => {
      const assets = [
        {
          id: 'da-1',
          asset_type: 'translation',
          target_locale: 'zh',
          status: 'completed',
          progress: 1.0,
          content_json: JSON.stringify({
            translatedText: '翻译后的文本',
          }),
        },
      ];

      const result = extractTranslationState(assets, 'zh');
      expect(result).toEqual({
        status: 'completed',
        progress: 1.0,
        targetLocale: 'zh',
        translatedText: '翻译后的文本',
      });
    });

    it('ignores translation for different locale', () => {
      const assets = [
        {
          id: 'da-1',
          asset_type: 'translation',
          target_locale: 'fr',
          status: 'completed',
          progress: 1.0,
          content_json: JSON.stringify({
            translatedText: 'Texte traduit',
          }),
        },
      ];

      const result = extractTranslationState(assets, 'zh');
      expect(result).toEqual({
        status: 'pending',
        progress: 0,
        targetLocale: 'zh',
        translatedText: null,
      });
    });
  });

  describe('extractSummaryState', () => {
    it('returns pending when no summary asset exists', () => {
      const result = extractSummaryState([]);
      expect(result).toEqual({
        status: 'pending',
        progress: 0,
        summaryText: null,
        keyPoints: null,
      });
    });

    it('extracts summary from completed asset', () => {
      const assets = [
        {
          id: 'da-1',
          asset_type: 'summary',
          status: 'completed',
          progress: 1.0,
          content_json: JSON.stringify({
            summaryText: 'This is a summary',
            keyPoints: ['Point 1', 'Point 2', 'Point 3'],
          }),
        },
      ];

      const result = extractSummaryState(assets);
      expect(result).toEqual({
        status: 'completed',
        progress: 1.0,
        summaryText: 'This is a summary',
        keyPoints: ['Point 1', 'Point 2', 'Point 3'],
      });
    });
  });

  describe('getPodcastPlaybackPosition', () => {
    it('returns default position when no last_read_position', () => {
      const result = getPodcastPlaybackPosition(null);
      expect(result).toEqual({
        currentTime: 0,
        lastUpdated: null,
      });
    });

    it('extracts playback position from JSON', () => {
      const json = JSON.stringify({
        currentTime: 123.5,
        lastUpdated: '2026-04-10T10:00:00Z',
      });

      const result = getPodcastPlaybackPosition(json);
      expect(result).toEqual({
        currentTime: 123.5,
        lastUpdated: '2026-04-10T10:00:00Z',
      });
    });

    it('handles malformed JSON gracefully', () => {
      const result = getPodcastPlaybackPosition('invalid json');
      expect(result).toEqual({
        currentTime: 0,
        lastUpdated: null,
      });
    });
  });

  describe('mapPodcastArticleToReader', () => {
    it('assembles complete podcast reader VM from rows', () => {
      const article = {
        id: 'art-1',
        title: 'Episode Title',
        author: 'Host Name',
        source_url: 'https://example.com/episode',
        media_type: 'podcast',
        status: 'reading',
        reading_progress: 0.3,
        last_read_position: JSON.stringify({ currentTime: 100, lastUpdated: '2026-04-10T10:00:00Z' }),
        published_at: '2026-04-01T00:00:00Z',
        created_at: '2026-04-05T00:00:00Z',
        updated_at: '2026-04-10T00:00:00Z',
      };

      const sourceEndpoint = {
        id: 'ep-1',
        title: 'Podcast Show',
        endpoint_type: 'podcast',
        url: 'https://example.com/podcast',
        description: 'A great podcast',
      };

      const contentItem = {
        id: 'ci-1',
        raw_json: JSON.stringify({
          audioUrl: 'https://example.com/audio.mp3',
          duration: '1:00:00',
          durationSeconds: 3600,
          artwork: 'https://example.com/art.jpg',
          showNotes: '<p>Show notes</p>',
        }),
      };

      const derivatives = [
        {
          id: 'da-1',
          asset_type: 'transcript',
          status: 'completed',
          progress: 1.0,
          content_json: JSON.stringify({
            segments: [{ start: 0, end: 5, text: 'Test' }],
            fullText: 'Test',
          }),
        },
        {
          id: 'da-2',
          asset_type: 'summary',
          status: 'completed',
          progress: 1.0,
          content_json: JSON.stringify({
            summaryText: 'Summary',
            keyPoints: ['Point 1'],
          }),
        },
      ];

      const highlights = [
        {
          id: 'hl-1',
          quote_text: 'Interesting quote',
          anchor_json: JSON.stringify({ timestampSeconds: 50 }),
          color: 'yellow',
          note: 'My note',
        },
      ];

      const result = mapPodcastArticleToReader(
        article,
        sourceEndpoint,
        contentItem,
        derivatives,
        highlights,
      );

      expect(result).toMatchObject({
        articleId: 'art-1',
        title: 'Episode Title',
        author: 'Host Name',
        status: 'reading',
        readingProgress: 0.3,
        publishedAt: '2026-04-01T00:00:00Z',
        show: {
          id: 'ep-1',
          title: 'Podcast Show',
          url: 'https://example.com/podcast',
          description: 'A great podcast',
        },
        episode: {
          audioUrl: 'https://example.com/audio.mp3',
          duration: '1:00:00',
          durationSeconds: 3600,
          artwork: 'https://example.com/art.jpg',
          showNotes: '<p>Show notes</p>',
        },
        playback: {
          currentTime: 100,
          lastUpdated: '2026-04-10T10:00:00Z',
        },
        transcript: {
          status: 'completed',
          progress: 1.0,
          segments: [{ start: 0, end: 5, text: 'Test' }],
          fullText: 'Test',
        },
        summary: {
          status: 'completed',
          progress: 1.0,
          summaryText: 'Summary',
          keyPoints: ['Point 1'],
        },
        highlights: [
          {
            id: 'hl-1',
            quoteText: 'Interesting quote',
            timestampSeconds: 50,
            color: 'yellow',
            note: 'My note',
          },
        ],
      });
    });

    it('handles null optional rows gracefully', () => {
      const article = {
        id: 'art-1',
        title: 'Episode',
        author: null,
        source_url: 'https://example.com/ep',
        media_type: 'podcast',
        status: 'unread',
        reading_progress: null,
        last_read_position: null,
        published_at: null,
        created_at: '2026-04-05T00:00:00Z',
        updated_at: '2026-04-05T00:00:00Z',
      };

      const result = mapPodcastArticleToReader(article, null, null, [], []);

      expect(result).toMatchObject({
        articleId: 'art-1',
        title: 'Episode',
        author: null,
        status: 'unread',
        readingProgress: 0,
        show: null,
        episode: null,
        playback: {
          currentTime: 0,
          lastUpdated: null,
        },
        transcript: {
          status: 'pending',
          progress: 0,
        },
        summary: {
          status: 'pending',
          progress: 0,
        },
        highlights: [],
      });
    });
  });
});
