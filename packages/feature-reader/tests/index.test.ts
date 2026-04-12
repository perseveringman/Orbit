import { describe, it, expect } from 'vitest';

// ── 1. Source Discovery ────────────────────────────────────
import {
  discoverRssFeeds,
  createSiteWatch,
} from '../src/source-discovery.js';

// ── 2. Subscription Management ─────────────────────────────
import {
  createSubscription,
  matchesFilter,
  computeNextFetch,
} from '../src/subscription-manager.js';

// ── 3. Content Pipeline ────────────────────────────────────
import {
  createPipelineStep,
  markStepRunning,
  markStepSuccess,
  markStepFailed,
  computeRetryDelay,
  shouldRetry,
  DEFAULT_RETRY_POLICY,
} from '../src/content-pipeline.js';

// ── 4. Content Layers ──────────────────────────────────────
import {
  estimateReadingTime,
  createContentBundle,
  addDerivedContent,
} from '../src/content-layers.js';
import type { RawLayer, ReadableLayer, MetadataLayer, DerivedLayer } from '../src/content-layers.js';

// ── 5. Reader View Model ───────────────────────────────────
import {
  createReaderViewModel,
  updateReadingProgress,
} from '../src/reader-view-model.js';
import type { Article, Highlight, Note } from '@orbit/domain';

// ── 6. Media Renderers ─────────────────────────────────────
import {
  createArticleRenderer,
  createBookRenderer,
  createTranscriptRenderer,
  getRendererForMediaType,
} from '../src/media-renderers.js';

// ── 7. Translation Layer ───────────────────────────────────
import { buildBilingualView } from '../src/translation-layer.js';
import type { TranslationPair } from '../src/translation-layer.js';

// ── 8. Transcription Layer ─────────────────────────────────
import {
  createTranscript,
  getSegmentAtTime,
  searchTranscript,
} from '../src/transcription-layer.js';
import type { TranscriptSegment, SpeakerProfile } from '../src/transcription-layer.js';

// ── 9. Content State Machine ───────────────────────────────
import {
  canTransition,
  getValidTransitions,
  transition,
} from '../src/content-state-machine.js';

// ── 10. Reading Exits ──────────────────────────────────────
import {
  createHighlightExit,
  createNoteExit,
  createResearchExit,
  createActionExit,
  createWritingExit,
} from '../src/reading-exits.js';

// ────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────

const NOW = '2025-01-15T08:00:00Z';

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    objectType: 'article',
    id: 'art-1',
    contentItemId: null,
    sourceEndpointId: null,
    title: 'Test Article',
    sourceUrl: 'https://example.com/post',
    author: 'Alice',
    mediaType: 'web_article',
    language: 'en',
    bundlePath: '/bundles/art-1',
    contentFilePath: '/bundles/art-1/content.md',
    originalFilePath: null,
    origin: 'user_save',
    proposedLinkCount: 0,
    activeLinkCount: 0,
    sourceEndpointQuality: 0.5,
    status: 'unread',
    readingProgress: null,
    lastReadPosition: null,
    publishedAt: NOW,
    fetchedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeHighlight(id: string, quote: string): Highlight {
  return {
    objectType: 'highlight',
    id,
    sourceObjectType: 'article',
    sourceObjectId: 'art-1',
    anchorJson: { locator: {}, quote, textHash: 'abc', state: 'active' },
    quoteText: quote,
    color: 'yellow',
    highlightKind: 'highlight',
    createdBy: 'manual',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeNote(id: string, title: string): Note {
  return {
    objectType: 'note',
    id,
    title,
    filePath: `/notes/${id}.md`,
    noteKind: 'annotation',
    maturity: 'inbox',
    origin: 'highlight',
    sourceHighlightId: null,
    sourceObjectId: 'art-1',
    sourceObjectType: 'article',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

// ════════════════════════════════════════════════════════════
//  1. Source Discovery
// ════════════════════════════════════════════════════════════

describe('source-discovery', () => {
  describe('discoverRssFeeds', () => {
    it('discovers RSS feed links from HTML', () => {
      const html = `
        <html><head>
          <link rel="alternate" type="application/rss+xml" title="Blog RSS" href="/feed.xml" />
          <link rel="alternate" type="application/atom+xml" title="Atom Feed" href="https://example.com/atom.xml" />
        </head></html>`;
      const results = discoverRssFeeds('https://example.com', html);
      expect(results).toHaveLength(2);
      expect(results[0].feedUrl).toBe('https://example.com/feed.xml');
      expect(results[0].title).toBe('Blog RSS');
      expect(results[0].siteUrl).toBe('https://example.com');
      expect(results[1].feedUrl).toBe('https://example.com/atom.xml');
      expect(results[1].title).toBe('Atom Feed');
    });

    it('returns empty array when no feeds found', () => {
      const html = '<html><head></head></html>';
      expect(discoverRssFeeds('https://example.com', html)).toEqual([]);
    });

    it('resolves relative URLs correctly', () => {
      const html = `<link rel="alternate" type="application/rss+xml" href="/blog/rss" />`;
      const results = discoverRssFeeds('https://example.com/page', html);
      expect(results[0].feedUrl).toBe('https://example.com/blog/rss');
    });
  });

  describe('createSiteWatch', () => {
    it('creates a site watch rule with defaults', () => {
      const rule = createSiteWatch('https://example.com');
      expect(rule.url).toBe('https://example.com');
      expect(rule.selector).toBeNull();
      expect(rule.checkIntervalMinutes).toBe(60);
      expect(rule.lastHash).toBeNull();
    });

    it('accepts an optional selector', () => {
      const rule = createSiteWatch('https://example.com', '.main-content');
      expect(rule.selector).toBe('.main-content');
    });
  });
});

// ════════════════════════════════════════════════════════════
//  2. Subscription Management
// ════════════════════════════════════════════════════════════

describe('subscription-manager', () => {
  describe('createSubscription', () => {
    it('creates a SourceEndpoint with active status', () => {
      const ep = createSubscription({
        title: 'Tech Blog',
        kind: 'rss_feed',
        url: 'https://blog.example.com/feed.xml',
      });
      expect(ep.objectType).toBe('source_endpoint');
      expect(ep.status).toBe('active');
      expect(ep.title).toBe('Tech Blog');
      expect(ep.kind).toBe('rss_feed');
      expect(ep.id).toBeTruthy();
    });

    it('applies optional fields', () => {
      const ep = createSubscription({
        title: 'News',
        kind: 'channel',
        url: 'https://news.example.com',
        language: 'zh',
        fetchIntervalMinutes: 30,
      });
      expect(ep.language).toBe('zh');
      expect(ep.fetchIntervalMinutes).toBe(30);
    });
  });

  describe('matchesFilter', () => {
    const ep = createSubscription({
      title: 'Tech Blog',
      kind: 'rss_feed',
      url: 'https://blog.example.com/feed.xml',
      language: 'en',
    });

    it('matches when filter is empty', () => {
      expect(matchesFilter(ep, {})).toBe(true);
    });

    it('filters by kind', () => {
      expect(matchesFilter(ep, { kind: 'rss_feed' })).toBe(true);
      expect(matchesFilter(ep, { kind: 'site_watch' })).toBe(false);
    });

    it('filters by search text', () => {
      expect(matchesFilter(ep, { searchText: 'tech' })).toBe(true);
      expect(matchesFilter(ep, { searchText: 'missing' })).toBe(false);
    });
  });

  describe('computeNextFetch', () => {
    it('computes next fetch time', () => {
      const ep = createSubscription({
        title: 'Feed',
        kind: 'rss_feed',
        url: 'https://example.com/rss',
        fetchIntervalMinutes: 120,
      });
      const schedule = computeNextFetch(ep);
      expect(schedule.intervalMinutes).toBe(120);
      expect(schedule.endpointId).toBe(ep.id);
      expect(schedule.nextFetchAt).toBeTruthy();
    });
  });
});

// ════════════════════════════════════════════════════════════
//  3. Content Pipeline
// ════════════════════════════════════════════════════════════

describe('content-pipeline', () => {
  describe('PipelineStep lifecycle', () => {
    it('creates a pending step', () => {
      const step = createPipelineStep('fetch');
      expect(step.name).toBe('fetch');
      expect(step.status).toBe('pending');
      expect(step.startedAt).toBeNull();
    });

    it('marks step running', () => {
      const step = markStepRunning(createPipelineStep('extract'));
      expect(step.status).toBe('running');
      expect(step.startedAt).toBeTruthy();
    });

    it('marks step success', () => {
      const step = markStepSuccess(markStepRunning(createPipelineStep('normalize')));
      expect(step.status).toBe('success');
      expect(step.completedAt).toBeTruthy();
    });

    it('marks step failed with error', () => {
      const step = markStepFailed(markStepRunning(createPipelineStep('fetch')), 'timeout');
      expect(step.status).toBe('failed');
      expect(step.error).toBe('timeout');
    });
  });

  describe('retry logic', () => {
    it('computes exponential backoff delay', () => {
      expect(computeRetryDelay(0, DEFAULT_RETRY_POLICY)).toBe(1_000);
      expect(computeRetryDelay(1, DEFAULT_RETRY_POLICY)).toBe(2_000);
      expect(computeRetryDelay(2, DEFAULT_RETRY_POLICY)).toBe(4_000);
    });

    it('caps delay at maxDelayMs', () => {
      expect(computeRetryDelay(100, DEFAULT_RETRY_POLICY)).toBe(30_000);
    });

    it('shouldRetry respects max retries', () => {
      expect(shouldRetry(0, DEFAULT_RETRY_POLICY)).toBe(true);
      expect(shouldRetry(2, DEFAULT_RETRY_POLICY)).toBe(true);
      expect(shouldRetry(3, DEFAULT_RETRY_POLICY)).toBe(false);
    });
  });
});

// ════════════════════════════════════════════════════════════
//  4. Content Layers
// ════════════════════════════════════════════════════════════

describe('content-layers', () => {
  const raw: RawLayer = {
    content: '<p>Hello</p>',
    mimeType: 'text/html',
    hash: 'abc123',
    size: 12,
    fetchedAt: NOW,
  };

  const readable: ReadableLayer = {
    markdown: '# Hello',
    cleanedHtml: '<p>Hello</p>',
    structuredText: 'Hello',
    normalizedAt: NOW,
  };

  const metadata: MetadataLayer = {
    title: 'Test',
    author: 'Alice',
    language: 'en',
    publishedAt: NOW,
    wordCount: 500,
    readingTimeMinutes: 3,
    tags: ['tech'],
    sourceUrl: 'https://example.com',
  };

  describe('estimateReadingTime', () => {
    it('estimates 1 min for very short content', () => {
      expect(estimateReadingTime(10)).toBe(1);
    });

    it('estimates reading time for longer content', () => {
      expect(estimateReadingTime(1000)).toBe(5); // ceil(1000 / 238) = 5
    });
  });

  describe('createContentBundle', () => {
    it('creates a bundle without derived content', () => {
      const bundle = createContentBundle('b-1', raw, readable, metadata);
      expect(bundle.id).toBe('b-1');
      expect(bundle.raw).toBe(raw);
      expect(bundle.readable).toBe(readable);
      expect(bundle.metadata).toBe(metadata);
      expect(bundle.derived).toBeNull();
    });
  });

  describe('addDerivedContent', () => {
    it('adds derived layer to bundle', () => {
      const bundle = createContentBundle('b-1', raw, readable, metadata);
      const derived: DerivedLayer = {
        aiSummary: 'A summary',
        keyQuotes: ['Quote 1'],
        topics: ['tech'],
        translatedContent: null,
        translationLanguage: null,
        generatedAt: NOW,
      };
      const updated = addDerivedContent(bundle, derived);
      expect(updated.derived).toBe(derived);
      expect(updated.derived!.aiSummary).toBe('A summary');
      // Original bundle unchanged
      expect(bundle.derived).toBeNull();
    });
  });
});

// ════════════════════════════════════════════════════════════
//  5. Reader View Model
// ════════════════════════════════════════════════════════════

describe('reader-view-model', () => {
  const article = makeArticle();
  const highlights = [makeHighlight('h-1', 'important quote')];
  const notes = [makeNote('n-1', 'My note')];

  describe('createReaderViewModel', () => {
    it('builds a complete view model', () => {
      const vm = createReaderViewModel(article, '# Hello world', highlights, notes);
      expect(vm.article.id).toBe('art-1');
      expect(vm.contentBody).toBe('# Hello world');
      expect(vm.highlights).toHaveLength(1);
      expect(vm.notes).toHaveLength(1);
      expect(vm.scrollState.scrollPercentage).toBe(0);
      expect(vm.contextSidebar).toHaveLength(2);
      expect(vm.layout.title).toBe('Test Article');
    });

    it('uses existing readingProgress', () => {
      const art = makeArticle({ readingProgress: 0.42 });
      const vm = createReaderViewModel(art, 'body', [], []);
      expect(vm.scrollState.scrollPercentage).toBe(0.42);
    });
  });

  describe('updateReadingProgress', () => {
    it('updates scroll state', () => {
      const vm = createReaderViewModel(article, 'body', highlights, notes);
      const updated = updateReadingProgress(vm, 0.75, 12);
      expect(updated.scrollState.scrollPercentage).toBe(0.75);
      expect(updated.scrollState.currentParagraphIndex).toBe(12);
    });
  });
});

// ════════════════════════════════════════════════════════════
//  6. Media Renderers
// ════════════════════════════════════════════════════════════

describe('media-renderers', () => {
  describe('ArticleRenderer', () => {
    it('splits content into sections', () => {
      const renderer = createArticleRenderer();
      const sections = renderer.renderParagraphs(
        '# Title\n\nSome paragraph text.\n\n> A blockquote\n\n```code```',
      );
      expect(sections).toHaveLength(4);
      expect(sections[0].kind).toBe('heading');
      expect(sections[1].kind).toBe('paragraph');
      expect(sections[2].kind).toBe('blockquote');
      expect(sections[3].kind).toBe('code');
    });

    it('returns empty for empty content', () => {
      const renderer = createArticleRenderer();
      expect(renderer.renderParagraphs('')).toHaveLength(0);
    });
  });

  describe('BookRenderer', () => {
    it('builds a chapter tree', () => {
      const renderer = createBookRenderer();
      const tree = renderer.renderChapterTree([
        { id: 'c1', title: 'Part 1', level: 1, content: null },
        { id: 'c1.1', title: 'Chapter 1', level: 2, content: 'text' },
        { id: 'c1.2', title: 'Chapter 2', level: 2, content: 'text' },
        { id: 'c2', title: 'Part 2', level: 1, content: null },
      ]);
      expect(tree).toHaveLength(2);
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].title).toBe('Chapter 1');
      expect(tree[1].children).toHaveLength(0);
    });
  });

  describe('TranscriptRenderer', () => {
    it('renders timecoded segments', () => {
      const renderer = createTranscriptRenderer();
      const segments = renderer.renderTimecoded([
        { startTime: 0, endTime: 5, speaker: 'Alice', text: 'Hello' },
        { startTime: 5, endTime: 10, speaker: 'Bob', text: 'Hi there' },
      ]);
      expect(segments).toHaveLength(2);
      expect(segments[0].speaker).toBe('Alice');
    });
  });

  describe('getRendererForMediaType', () => {
    it('returns book for epub/pdf', () => {
      expect(getRendererForMediaType('book_epub')).toBe('book');
      expect(getRendererForMediaType('book_pdf')).toBe('book');
    });

    it('returns transcript for audio/video', () => {
      expect(getRendererForMediaType('podcast_episode')).toBe('podcast');
      expect(getRendererForMediaType('video')).toBe('video');
      expect(getRendererForMediaType('audio')).toBe('transcript');
    });

    it('returns article for web content', () => {
      expect(getRendererForMediaType('web_article')).toBe('article');
      expect(getRendererForMediaType('newsletter')).toBe('article');
    });
  });
});

// ════════════════════════════════════════════════════════════
//  7. Translation Layer
// ════════════════════════════════════════════════════════════

describe('translation-layer', () => {
  describe('buildBilingualView', () => {
    it('pairs paragraphs with translations', () => {
      const paragraphs = ['Hello world', 'Goodbye world', 'Third paragraph'];
      const translations: TranslationPair[] = [
        { originalText: 'Hello world', translatedText: '你好世界', paragraphIndex: 0, language: 'zh' },
        { originalText: 'Goodbye world', translatedText: '再见世界', paragraphIndex: 1, language: 'zh' },
      ];
      const result = buildBilingualView(paragraphs, translations);
      expect(result).toHaveLength(3);
      expect(result[0].original).toBe('Hello world');
      expect(result[0].translated).toBe('你好世界');
      expect(result[2].translated).toBe(''); // no translation
    });

    it('preserves original text (never overwrites)', () => {
      const paragraphs = ['Original'];
      const translations: TranslationPair[] = [
        { originalText: 'Original', translatedText: '翻译', paragraphIndex: 0, language: 'zh' },
      ];
      const result = buildBilingualView(paragraphs, translations);
      expect(result[0].original).toBe('Original');
      expect(result[0].translated).toBe('翻译');
    });

    it('handles empty translations', () => {
      const result = buildBilingualView(['Hello'], []);
      expect(result[0].translated).toBe('');
    });
  });
});

// ════════════════════════════════════════════════════════════
//  8. Transcription Layer
// ════════════════════════════════════════════════════════════

describe('transcription-layer', () => {
  const segments: TranscriptSegment[] = [
    { startTime: 0, endTime: 5.5, speaker: 'Alice', text: 'Hello everyone', confidence: 0.95 },
    { startTime: 5.5, endTime: 12, speaker: 'Bob', text: 'Welcome to the show', confidence: 0.88 },
    { startTime: 12, endTime: 20, speaker: 'Alice', text: 'Let us talk about technology', confidence: 0.92 },
  ];

  const speakers: SpeakerProfile[] = [
    { id: 's1', label: 'Alice', color: '#ff0000' },
    { id: 's2', label: 'Bob', color: '#0000ff' },
  ];

  describe('createTranscript', () => {
    it('creates transcript with computed duration', () => {
      const t = createTranscript(segments, speakers, 'en');
      expect(t.segments).toHaveLength(3);
      expect(t.speakers).toHaveLength(2);
      expect(t.duration).toBe(20);
      expect(t.language).toBe('en');
    });

    it('handles empty segments', () => {
      const t = createTranscript([], [], 'en');
      expect(t.duration).toBe(0);
    });
  });

  describe('getSegmentAtTime', () => {
    const transcript = createTranscript(segments, speakers, 'en');

    it('finds segment at given time', () => {
      const seg = getSegmentAtTime(transcript, 3);
      expect(seg?.speaker).toBe('Alice');
    });

    it('returns undefined for time outside range', () => {
      expect(getSegmentAtTime(transcript, 25)).toBeUndefined();
    });

    it('handles boundary correctly', () => {
      const seg = getSegmentAtTime(transcript, 5.5);
      expect(seg?.speaker).toBe('Bob');
    });
  });

  describe('searchTranscript', () => {
    const transcript = createTranscript(segments, speakers, 'en');

    it('finds matching segments', () => {
      const results = searchTranscript(transcript, 'hello');
      expect(results).toHaveLength(1);
      expect(results[0].speaker).toBe('Alice');
    });

    it('is case insensitive', () => {
      expect(searchTranscript(transcript, 'WELCOME')).toHaveLength(1);
    });

    it('returns empty for no matches', () => {
      expect(searchTranscript(transcript, 'quantum')).toHaveLength(0);
    });
  });
});

// ════════════════════════════════════════════════════════════
//  9. Content State Machine
// ════════════════════════════════════════════════════════════

describe('content-state-machine', () => {
  describe('canTransition', () => {
    it('allows valid happy-path transitions', () => {
      expect(canTransition('discovered', 'saved')).toBe(true);
      expect(canTransition('saved', 'queued')).toBe(true);
      expect(canTransition('queued', 'fetching')).toBe(true);
      expect(canTransition('fetching', 'fetched')).toBe(true);
      expect(canTransition('extracted', 'ready_to_read')).toBe(true);
      expect(canTransition('ready_to_read', 'archived')).toBe(true);
    });

    it('disallows invalid transitions', () => {
      expect(canTransition('discovered', 'fetched')).toBe(false);
      expect(canTransition('ready_to_read', 'discovered')).toBe(false);
      expect(canTransition('fetching', 'ready_to_read')).toBe(false);
    });

    it('allows error transitions', () => {
      expect(canTransition('fetching', 'fetch_failed')).toBe(true);
      expect(canTransition('extracting', 'extract_failed')).toBe(true);
    });

    it('allows retry from error states', () => {
      expect(canTransition('fetch_failed', 'queued')).toBe(true);
      expect(canTransition('extract_failed', 'fetched')).toBe(true);
    });

    it('allows quarantine from error states', () => {
      expect(canTransition('fetch_failed', 'quarantined')).toBe(true);
      expect(canTransition('quarantined', 'discovered')).toBe(true);
    });
  });

  describe('getValidTransitions', () => {
    it('returns valid targets', () => {
      const valid = getValidTransitions('discovered');
      expect(valid).toContain('saved');
      expect(valid).toContain('queued');
      expect(valid).toContain('archived');
    });

    it('returns empty for unknown state', () => {
      expect(getValidTransitions('nonexistent' as any)).toEqual([]);
    });
  });

  describe('transition', () => {
    it('creates transition record on valid transition', () => {
      const result = transition('discovered', 'saved', 'user_action');
      expect(result.newStatus).toBe('saved');
      expect(result.transition.from).toBe('discovered');
      expect(result.transition.to).toBe('saved');
      expect(result.transition.trigger).toBe('user_action');
      expect(result.transition.timestamp).toBeTruthy();
    });

    it('throws on invalid transition', () => {
      expect(() => transition('discovered', 'ready_to_read', 'skip')).toThrow(
        "Invalid transition from 'discovered' to 'ready_to_read'",
      );
    });
  });
});

// ════════════════════════════════════════════════════════════
//  10. Reading Exits
// ════════════════════════════════════════════════════════════

describe('reading-exits', () => {
  const articleId = 'art-1';
  const selection = 'important text';
  const anchor = { paragraphIndex: 3, startOffset: 10, endOffset: 24 };

  describe('createHighlightExit', () => {
    it('creates highlight exit', () => {
      const exit = createHighlightExit(articleId, selection, anchor);
      expect(exit.kind).toBe('to_highlight');
      expect(exit.sourceArticleId).toBe(articleId);
      expect(exit.selectedText).toBe(selection);
      expect(exit.anchorData).toEqual(anchor);
      expect(exit.targetObjectType).toBe('highlight');
    });

    it('works without anchor data', () => {
      const exit = createHighlightExit(articleId, selection);
      expect(exit.anchorData).toBeNull();
    });
  });

  describe('createNoteExit', () => {
    it('creates note exit', () => {
      const exit = createNoteExit(articleId, selection);
      expect(exit.kind).toBe('to_note');
      expect(exit.targetObjectType).toBe('note');
    });
  });

  describe('createResearchExit', () => {
    it('creates research exit', () => {
      const exit = createResearchExit(articleId, selection);
      expect(exit.kind).toBe('to_research');
      expect(exit.targetObjectType).toBe('research_question');
    });
  });

  describe('createActionExit', () => {
    it('creates action/task exit', () => {
      const exit = createActionExit(articleId, selection);
      expect(exit.kind).toBe('to_action');
      expect(exit.targetObjectType).toBe('task');
    });
  });

  describe('createWritingExit', () => {
    it('creates writing exit', () => {
      const exit = createWritingExit(articleId, selection);
      expect(exit.kind).toBe('to_writing');
      expect(exit.targetObjectType).toBe('draft');
    });
  });
});

// ── 11. Fetch Scheduler ────────────────────────────────────
import {
  computeNextFetchSchedule,
  selectDueEndpoints,
  computeAdaptiveInterval,
  DEFAULT_SCHEDULER_CONFIG,
} from '../src/fetch-scheduler.js';
import type { FetchScheduleEntry, FetchSchedulerConfig } from '../src/fetch-scheduler.js';

// ── 12. Processing Depth Policy ────────────────────────────
import {
  determineProcessingDepth,
  buildPipelineSteps,
} from '../src/processing-depth-policy.js';
import type { ProcessingDepthInput } from '../src/processing-depth-policy.js';

// ── 13. Video Renderer ─────────────────────────────────────
import {
  createVideoReaderState,
  selectStream,
  syncVideoToTranscript,
} from '../src/video-renderer.js';
import type { VideoStream, VideoReaderState } from '../src/video-renderer.js';

// ── 14. Podcast Renderer ───────────────────────────────────
import {
  createPodcastReaderState,
  updatePlaybackPosition,
  mapSpeaker,
} from '../src/podcast-renderer.js';
import type { PodcastEpisodeInfo } from '../src/podcast-renderer.js';

// ────────────────────────────────────────────────────────────
// 11. FetchScheduler
// ────────────────────────────────────────────────────────────

describe('FetchScheduler', () => {
  const baseEntry: FetchScheduleEntry = {
    endpointId: 'ep-1',
    nextFetchAt: '2025-01-15T08:00:00Z',
    intervalMinutes: 60,
    consecutiveErrors: 0,
  };

  describe('computeNextFetchSchedule', () => {
    it('resets consecutiveErrors on success', () => {
      const entry: FetchScheduleEntry = { ...baseEntry, consecutiveErrors: 3 };
      const result = computeNextFetchSchedule(entry, DEFAULT_SCHEDULER_CONFIG, 'success');
      expect(result.consecutiveErrors).toBe(0);
      expect(result.intervalMinutes).toBe(60);
    });

    it('increments consecutiveErrors and backs off on error', () => {
      const result = computeNextFetchSchedule(baseEntry, DEFAULT_SCHEDULER_CONFIG, 'error');
      expect(result.consecutiveErrors).toBe(1);
      expect(result.intervalMinutes).toBe(120);
    });

    it('caps interval at maxIntervalMinutes on error', () => {
      const entry: FetchScheduleEntry = { ...baseEntry, intervalMinutes: 1000 };
      const result = computeNextFetchSchedule(entry, DEFAULT_SCHEDULER_CONFIG, 'error');
      expect(result.intervalMinutes).toBe(1440);
    });

    it('sets very large interval when maxConsecutiveErrors reached', () => {
      const entry: FetchScheduleEntry = { ...baseEntry, consecutiveErrors: 4, intervalMinutes: 720 };
      const result = computeNextFetchSchedule(entry, DEFAULT_SCHEDULER_CONFIG, 'error');
      expect(result.consecutiveErrors).toBe(5);
      expect(result.intervalMinutes).toBe(1440 * 10);
    });

    it('increases interval by 10% on no_new_items when adaptive', () => {
      const result = computeNextFetchSchedule(baseEntry, DEFAULT_SCHEDULER_CONFIG, 'no_new_items');
      expect(result.intervalMinutes).toBeCloseTo(66, 0);
      expect(result.consecutiveErrors).toBe(0);
    });

    it('keeps interval unchanged on no_new_items when adaptive disabled', () => {
      const config: FetchSchedulerConfig = { ...DEFAULT_SCHEDULER_CONFIG, adaptiveEnabled: false };
      const result = computeNextFetchSchedule(baseEntry, config, 'no_new_items');
      expect(result.intervalMinutes).toBe(60);
    });
  });

  describe('selectDueEndpoints', () => {
    it('returns entries where nextFetchAt <= now', () => {
      const schedules: FetchScheduleEntry[] = [
        { endpointId: 'a', nextFetchAt: '2025-01-15T07:00:00Z', intervalMinutes: 60, consecutiveErrors: 0 },
        { endpointId: 'b', nextFetchAt: '2025-01-15T09:00:00Z', intervalMinutes: 60, consecutiveErrors: 0 },
        { endpointId: 'c', nextFetchAt: '2025-01-15T08:00:00Z', intervalMinutes: 60, consecutiveErrors: 0 },
      ];
      const due = selectDueEndpoints(schedules, '2025-01-15T08:00:00Z');
      expect(due.map((d) => d.endpointId)).toEqual(['a', 'c']);
    });

    it('returns empty array when none are due', () => {
      const schedules: FetchScheduleEntry[] = [
        { endpointId: 'a', nextFetchAt: '2025-01-15T10:00:00Z', intervalMinutes: 60, consecutiveErrors: 0 },
      ];
      expect(selectDueEndpoints(schedules, '2025-01-15T08:00:00Z')).toEqual([]);
    });
  });

  describe('computeAdaptiveInterval', () => {
    it('returns default when fewer than 2 times', () => {
      expect(computeAdaptiveInterval([], DEFAULT_SCHEDULER_CONFIG)).toBe(60);
      expect(computeAdaptiveInterval(['2025-01-15T08:00:00Z'], DEFAULT_SCHEDULER_CONFIG)).toBe(60);
    });

    it('computes average gap between publish times', () => {
      const times = [
        '2025-01-15T08:00:00Z',
        '2025-01-15T10:00:00Z',
        '2025-01-15T12:00:00Z',
      ];
      const interval = computeAdaptiveInterval(times, DEFAULT_SCHEDULER_CONFIG);
      expect(interval).toBe(120);
    });

    it('clamps to min interval', () => {
      const times = [
        '2025-01-15T08:00:00Z',
        '2025-01-15T08:05:00Z',
      ];
      const interval = computeAdaptiveInterval(times, DEFAULT_SCHEDULER_CONFIG);
      expect(interval).toBe(15);
    });

    it('clamps to max interval', () => {
      const times = [
        '2025-01-01T00:00:00Z',
        '2025-01-10T00:00:00Z',
      ];
      const interval = computeAdaptiveInterval(times, DEFAULT_SCHEDULER_CONFIG);
      expect(interval).toBe(1440);
    });
  });
});

// ────────────────────────────────────────────────────────────
// 12. ProcessingDepthPolicy
// ────────────────────────────────────────────────────────────

describe('ProcessingDepthPolicy', () => {
  describe('determineProcessingDepth', () => {
    const base: ProcessingDepthInput = {
      origin: 'feed_auto',
      activeLinkCount: 0,
      proposedLinkCount: 0,
      sourceEndpointQuality: 0.8,
      mediaType: 'web_article',
    };

    it('returns deep for user_save', () => {
      expect(determineProcessingDepth({ ...base, origin: 'user_save' })).toBe('deep');
    });

    it('returns standard for import', () => {
      expect(determineProcessingDepth({ ...base, origin: 'import' })).toBe('standard');
    });

    it('returns standard for agent_recommend with low links', () => {
      expect(determineProcessingDepth({ ...base, origin: 'agent_recommend', activeLinkCount: 1 })).toBe('standard');
    });

    it('returns deep for agent_recommend with >= 3 active links', () => {
      expect(determineProcessingDepth({ ...base, origin: 'agent_recommend', activeLinkCount: 3 })).toBe('deep');
    });

    it('returns lightweight for feed_auto with 0 links', () => {
      expect(determineProcessingDepth({ ...base, origin: 'feed_auto', activeLinkCount: 0 })).toBe('lightweight');
    });

    it('returns standard for feed_auto with 3 links', () => {
      expect(determineProcessingDepth({ ...base, origin: 'feed_auto', activeLinkCount: 3 })).toBe('standard');
    });

    it('returns deep for feed_auto with 5+ links', () => {
      expect(determineProcessingDepth({ ...base, origin: 'feed_auto', activeLinkCount: 5 })).toBe('deep');
    });
  });

  describe('buildPipelineSteps', () => {
    it('builds 3 lightweight steps', () => {
      const steps = buildPipelineSteps('lightweight', false);
      expect(steps).toHaveLength(3);
      expect(steps.map((s) => s.name)).toEqual(['fetch', 'normalize', 'summarize']);
      expect(steps.every((s) => s.required)).toBe(true);
    });

    it('builds 4 standard steps', () => {
      const steps = buildPipelineSteps('standard', false);
      expect(steps).toHaveLength(4);
      expect(steps.map((s) => s.name)).toEqual(['fetch', 'normalize', 'extract', 'index_fts']);
    });

    it('builds 7 deep steps without transcription', () => {
      const steps = buildPipelineSteps('deep', false);
      expect(steps).toHaveLength(7);
      expect(steps.map((s) => s.name)).toEqual([
        'fetch', 'normalize', 'extract', 'index_fts',
        'index_vector', 'extract_entities', 'suggest_links',
      ]);
    });

    it('builds 9 deep steps with transcription', () => {
      const steps = buildPipelineSteps('deep', true);
      expect(steps).toHaveLength(9);
      expect(steps.map((s) => s.name)).toEqual([
        'fetch', 'normalize', 'extract', 'index_fts',
        'transcribe', 'translate',
        'index_vector', 'extract_entities', 'suggest_links',
      ]);
      const transcribeStep = steps.find((s) => s.name === 'transcribe')!;
      expect(transcribeStep.required).toBe(false);
    });
  });
});

// ────────────────────────────────────────────────────────────
// 13. VideoRenderer
// ────────────────────────────────────────────────────────────

describe('VideoRenderer', () => {
  const streams: VideoStream[] = [
    { url: 'https://v.example.com/720p', qualityLabel: '720p', width: 1280, height: 720, mimeType: 'video/mp4', hasAudio: true },
    { url: 'https://v.example.com/1080p', qualityLabel: '1080p', width: 1920, height: 1080, mimeType: 'video/mp4', hasAudio: true },
  ];

  describe('createVideoReaderState', () => {
    it('creates initial state from streams', () => {
      const state = createVideoReaderState('vid-1', streams, 600);
      expect(state.videoId).toBe('vid-1');
      expect(state.selectedQuality).toBe('720p');
      expect(state.currentTime).toBe(0);
      expect(state.playbackRate).toBe(1);
      expect(state.isPlaying).toBe(false);
      expect(state.transcript).toBeNull();
      expect(state.duration).toBe(600);
    });

    it('handles empty streams', () => {
      const state = createVideoReaderState('vid-2', [], 0);
      expect(state.selectedQuality).toBe('');
    });
  });

  describe('selectStream', () => {
    it('updates selected quality', () => {
      const state = createVideoReaderState('vid-1', streams, 600);
      const updated = selectStream(state, '1080p');
      expect(updated.selectedQuality).toBe('1080p');
      expect(updated.videoId).toBe('vid-1');
    });
  });

  describe('syncVideoToTranscript', () => {
    it('updates currentTime and returns undefined segment when no transcript', () => {
      const state = createVideoReaderState('vid-1', streams, 600);
      const { state: updated, activeSegment } = syncVideoToTranscript(state, 42);
      expect(updated.currentTime).toBe(42);
      expect(activeSegment).toBeUndefined();
    });

    it('finds matching transcript segment', () => {
      const transcript = createTranscript(
        [{ startTime: 10, endTime: 20, speaker: 'A', text: 'Hello', confidence: 0.95 }],
        [{ id: 'A', label: 'Speaker A', color: '#ff0000' }],
        'en',
      );
      const state: VideoReaderState = { ...createVideoReaderState('vid-1', streams, 600), transcript };
      const { state: updated, activeSegment } = syncVideoToTranscript(state, 15);
      expect(updated.currentTime).toBe(15);
      expect(activeSegment).toBeDefined();
      expect(activeSegment!.text).toBe('Hello');
    });
  });
});

// ────────────────────────────────────────────────────────────
// 14. PodcastRenderer
// ────────────────────────────────────────────────────────────

describe('PodcastRenderer', () => {
  const episode: PodcastEpisodeInfo = {
    title: 'Episode 1',
    showName: 'My Show',
    audioUrl: 'https://example.com/ep1.mp3',
    duration: 3600,
    publishedAt: '2025-01-15T08:00:00Z',
    artworkUrl: 'https://example.com/art.jpg',
  };

  describe('createPodcastReaderState', () => {
    it('creates initial state', () => {
      const state = createPodcastReaderState(episode);
      expect(state.episode.title).toBe('Episode 1');
      expect(state.playbackRate).toBe(1);
      expect(state.currentTime).toBe(0);
      expect(state.isPlaying).toBe(false);
      expect(state.transcript).toBeNull();
      expect(state.speakerMap).toEqual({});
    });
  });

  describe('updatePlaybackPosition', () => {
    it('updates currentTime immutably', () => {
      const state = createPodcastReaderState(episode);
      const updated = updatePlaybackPosition(state, 120);
      expect(updated.currentTime).toBe(120);
      expect(state.currentTime).toBe(0);
    });
  });

  describe('mapSpeaker', () => {
    it('adds a speaker mapping', () => {
      const state = createPodcastReaderState(episode);
      const updated = mapSpeaker(state, 'spk-1', 'Alice');
      expect(updated.speakerMap['spk-1']).toBe('Alice');
    });

    it('updates existing speaker mapping immutably', () => {
      const state = mapSpeaker(createPodcastReaderState(episode), 'spk-1', 'Alice');
      const updated = mapSpeaker(state, 'spk-1', 'Bob');
      expect(updated.speakerMap['spk-1']).toBe('Bob');
      expect(state.speakerMap['spk-1']).toBe('Alice');
    });
  });
});

// ────────────────────────────────────────────────────────────
// 15. MediaRenderers extended
// ────────────────────────────────────────────────────────────

describe('MediaRenderers extended', () => {
  it('maps video media type to video renderer', () => {
    expect(getRendererForMediaType('video')).toBe('video');
  });

  it('maps podcast_episode to podcast renderer', () => {
    expect(getRendererForMediaType('podcast_episode')).toBe('podcast');
  });

  it('still maps book_epub to book renderer', () => {
    expect(getRendererForMediaType('book_epub')).toBe('book');
  });

  it('still maps audio to transcript renderer', () => {
    expect(getRendererForMediaType('audio')).toBe('transcript');
  });

  it('defaults to article for web_article', () => {
    expect(getRendererForMediaType('web_article')).toBe('article');
  });
});

// ────────────────────────────────────────────────────────────
// 16. Content Normalizer
// ────────────────────────────────────────────────────────────

import {
  normalizeHtml,
  extractStructuredText,
  detectLanguage,
} from '../src/content-normalizer.js';

describe('content-normalizer', () => {
  describe('normalizeHtml', () => {
    it('strips script tags', () => {
      const html = '<div>Hello</div><script>alert("xss")</script><p>World</p>';
      const result = normalizeHtml(html);
      expect(result).not.toContain('<script');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('strips style tags', () => {
      const html = '<style>body{color:red}</style><p>Content</p>';
      const result = normalizeHtml(html);
      expect(result).not.toContain('<style');
      expect(result).toContain('Content');
    });

    it('strips nav elements', () => {
      const html = '<nav><a href="/">Home</a></nav><article>Text</article>';
      const result = normalizeHtml(html);
      expect(result).not.toContain('<nav');
      expect(result).toContain('Text');
    });

    it('strips HTML comments', () => {
      const html = '<p>Before</p><!-- comment --><p>After</p>';
      const result = normalizeHtml(html);
      expect(result).not.toContain('<!--');
      expect(result).toContain('Before');
      expect(result).toContain('After');
    });

    it('strips iframe tags', () => {
      const html = '<p>A</p><iframe src="https://evil.com"></iframe><p>B</p>';
      const result = normalizeHtml(html);
      expect(result).not.toContain('<iframe');
    });
  });

  describe('extractStructuredText', () => {
    it('splits markdown into paragraphs', () => {
      const md = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const result = extractStructuredText(md);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe('First paragraph.');
      expect(result[2]).toBe('Third paragraph.');
    });

    it('filters empty paragraphs', () => {
      const md = 'Hello\n\n\n\n\n\nWorld';
      const result = extractStructuredText(md);
      expect(result).toHaveLength(2);
    });

    it('handles single paragraph', () => {
      expect(extractStructuredText('Just one')).toEqual(['Just one']);
    });

    it('returns empty for blank input', () => {
      expect(extractStructuredText('   ')).toEqual([]);
    });
  });

  describe('detectLanguage', () => {
    it('detects Chinese', () => {
      expect(detectLanguage('这是中文测试')).toBe('zh');
    });

    it('detects Japanese with kana', () => {
      expect(detectLanguage('これはテストです')).toBe('ja');
    });

    it('detects Korean', () => {
      expect(detectLanguage('한국어 텍스트')).toBe('ko');
    });

    it('detects Russian / Cyrillic', () => {
      expect(detectLanguage('Привет мир')).toBe('ru');
    });

    it('detects Arabic', () => {
      expect(detectLanguage('مرحبا بالعالم')).toBe('ar');
    });

    it('defaults to English for Latin text', () => {
      expect(detectLanguage('Hello world')).toBe('en');
    });

    it('returns null for empty string', () => {
      expect(detectLanguage('')).toBeNull();
    });
  });
});

// ────────────────────────────────────────────────────────────
// 17. Content Pipeline Orchestrator
// ────────────────────────────────────────────────────────────

import { createContentPipeline } from '../src/content-pipeline-orchestrator.js';
import type {
  ContentFetcher,
  ContentExtractor,
  FetchResult,
  ExtractionResult,
} from '../src/content-pipeline.js';

describe('content-pipeline-orchestrator', () => {
  const mockFetchResult: FetchResult = {
    rawHtml: '<html><body><p>Hello</p></body></html>',
    headers: { 'content-type': 'text/html' },
    statusCode: 200,
    fetchedAt: NOW,
  };

  const mockExtractionResult: ExtractionResult = {
    title: 'Test Article',
    author: 'Alice',
    contentMarkdown: '# Test\n\nHello world paragraph one.\n\nParagraph two.',
    language: 'en',
    publishedAt: NOW,
    wordCount: 100,
    excerpt: 'Hello world',
  };

  function makeMockFetcher(result?: FetchResult, error?: Error): ContentFetcher {
    let callCount = 0;
    return {
      fetch: async () => {
        callCount++;
        if (error && callCount === 1) throw error;
        return result ?? mockFetchResult;
      },
    };
  }

  const mockExtractor: ContentExtractor = {
    extract: () => mockExtractionResult,
  };

  it('processes successfully with all steps', async () => {
    const pipeline = createContentPipeline(makeMockFetcher(), mockExtractor);
    const result = await pipeline.process('https://example.com/article');
    expect(result.success).toBe(true);
    expect(result.fetchResult).not.toBeNull();
    expect(result.extractionResult).not.toBeNull();
    expect(result.steps).toHaveLength(4);
    expect(result.steps.map((s) => s.name)).toEqual(['fetch', 'extract', 'normalize', 'store']);
    for (const step of result.steps) {
      expect(step.status).toBe('success');
    }
  });

  it('retries fetch on failure then succeeds', async () => {
    const fetcher = makeMockFetcher(mockFetchResult, new Error('Network error'));
    const pipeline = createContentPipeline(fetcher, mockExtractor, {
      maxRetries: 3,
      baseDelayMs: 1,
      maxDelayMs: 10,
      backoffMultiplier: 1,
    });
    const result = await pipeline.process('https://example.com/article');
    expect(result.success).toBe(true);
  });

  it('fails after exhausting retries', async () => {
    const fetcher: ContentFetcher = {
      fetch: async () => { throw new Error('Always fails'); },
    };
    const pipeline = createContentPipeline(fetcher, mockExtractor, {
      maxRetries: 0,
      baseDelayMs: 1,
      maxDelayMs: 1,
      backoffMultiplier: 1,
    });
    const result = await pipeline.process('https://example.com/article');
    expect(result.success).toBe(false);
    expect(result.fetchResult).toBeNull();
    const fetchStep = result.steps.find((s) => s.name === 'fetch')!;
    expect(fetchStep.status).toBe('failed');
    expect(fetchStep.error).toBe('Always fails');
  });

  it('fails when extractor throws', async () => {
    const failExtractor: ContentExtractor = {
      extract: () => { throw new Error('Parse error'); },
    };
    const pipeline = createContentPipeline(makeMockFetcher(), failExtractor);
    const result = await pipeline.process('https://example.com/article');
    expect(result.success).toBe(false);
    expect(result.fetchResult).not.toBeNull();
    const extractStep = result.steps.find((s) => s.name === 'extract')!;
    expect(extractStep.status).toBe('failed');
  });

  it('uses default retry policy', () => {
    const pipeline = createContentPipeline(makeMockFetcher(), mockExtractor);
    expect(pipeline.retryPolicy.maxRetries).toBe(3);
  });

  it('tracks step timing', async () => {
    const pipeline = createContentPipeline(makeMockFetcher(), mockExtractor);
    const result = await pipeline.process('https://example.com/article');
    for (const step of result.steps) {
      expect(step.startedAt).not.toBeNull();
      expect(step.completedAt).not.toBeNull();
    }
  });
});

// ────────────────────────────────────────────────────────────
// 18. Transcription Provider
// ────────────────────────────────────────────────────────────

import {
  createTranscriptionJobId,
  validateAudioSource,
} from '../src/transcription-provider.js';
import type { AudioSource } from '../src/transcription-provider.js';

describe('transcription-provider', () => {
  describe('createTranscriptionJobId', () => {
    it('returns a string starting with txn-', () => {
      const id = createTranscriptionJobId();
      expect(id.startsWith('txn-')).toBe(true);
    });

    it('generates unique ids', () => {
      const ids = new Set(Array.from({ length: 20 }, () => createTranscriptionJobId()));
      expect(ids.size).toBe(20);
    });
  });

  describe('validateAudioSource', () => {
    it('passes for valid source with url', () => {
      const source: AudioSource = {
        url: 'https://example.com/audio.mp3',
        mimeType: 'audio/mpeg',
        durationSeconds: 120,
      };
      expect(validateAudioSource(source)).toEqual({ valid: true });
    });

    it('passes for valid source with localPath', () => {
      const source: AudioSource = {
        localPath: '/data/audio.wav',
        mimeType: 'audio/wav',
        durationSeconds: 60,
      };
      expect(validateAudioSource(source)).toEqual({ valid: true });
    });

    it('fails when neither url nor localPath provided', () => {
      const source: AudioSource = {
        mimeType: 'audio/mpeg',
        durationSeconds: 60,
      };
      const result = validateAudioSource(source);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('fails when durationSeconds is zero', () => {
      const source: AudioSource = {
        url: 'https://example.com/audio.mp3',
        mimeType: 'audio/mpeg',
        durationSeconds: 0,
      };
      expect(validateAudioSource(source).valid).toBe(false);
    });

    it('fails when durationSeconds is negative', () => {
      const source: AudioSource = {
        url: 'https://example.com/audio.mp3',
        mimeType: 'audio/mpeg',
        durationSeconds: -5,
      };
      expect(validateAudioSource(source).valid).toBe(false);
    });

    it('fails when mimeType is empty', () => {
      const source: AudioSource = {
        url: 'https://example.com/audio.mp3',
        mimeType: '',
        durationSeconds: 60,
      };
      expect(validateAudioSource(source).valid).toBe(false);
    });
  });
});

// ────────────────────────────────────────────────────────────
// 19. Translation Engine
// ────────────────────────────────────────────────────────────

import {
  splitTextForTranslation,
  mergeTranslationResults,
  applyGlossary,
} from '../src/translation-engine.js';
import type { TranslationResponse } from '../src/translation-engine.js';

describe('translation-engine', () => {
  describe('splitTextForTranslation', () => {
    it('returns single chunk when text fits', () => {
      const result = splitTextForTranslation('Hello world', 100);
      expect(result).toEqual(['Hello world']);
    });

    it('splits on paragraph boundaries', () => {
      const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.';
      const result = splitTextForTranslation(text, 30);
      expect(result.length).toBeGreaterThanOrEqual(2);
      // All text should be preserved
      expect(result.join('\n\n')).toContain('Paragraph one.');
      expect(result.join('\n\n')).toContain('Paragraph three.');
    });

    it('splits long sentences when paragraph is too large', () => {
      const text = 'A'.repeat(50) + '. ' + 'B'.repeat(50) + '.';
      const result = splitTextForTranslation(text, 60);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('handles empty string', () => {
      expect(splitTextForTranslation('', 100)).toEqual(['']);
    });
  });

  describe('mergeTranslationResults', () => {
    it('merges multiple response chunks', () => {
      const chunks: TranslationResponse[] = [
        { translations: ['Hello'], engineId: 'google', processedAt: NOW },
        { translations: ['World'], engineId: 'google', processedAt: NOW },
      ];
      const merged = mergeTranslationResults(chunks);
      expect(merged.translations).toEqual(['Hello', 'World']);
      expect(merged.engineId).toBe('google');
    });

    it('preserves detectedSourceLanguage from first chunk', () => {
      const chunks: TranslationResponse[] = [
        { translations: ['Hola'], detectedSourceLanguage: 'en', engineId: 'azure', processedAt: NOW },
        { translations: ['Mundo'], engineId: 'azure', processedAt: NOW },
      ];
      const merged = mergeTranslationResults(chunks);
      expect(merged.detectedSourceLanguage).toBe('en');
    });

    it('returns empty translations for empty input', () => {
      const merged = mergeTranslationResults([]);
      expect(merged.translations).toEqual([]);
    });
  });

  describe('applyGlossary', () => {
    it('replaces glossary terms', () => {
      const glossary = [
        { term: 'API', preferredTranslation: '接口', context: null },
        { term: 'database', preferredTranslation: '数据库', context: null },
      ];
      const result = applyGlossary('The API connects to the database', glossary);
      expect(result).toBe('The 接口 connects to the 数据库');
    });

    it('is case-insensitive', () => {
      const glossary = [{ term: 'React', preferredTranslation: 'React框架', context: null }];
      const result = applyGlossary('I love react and REACT', glossary);
      expect(result).toBe('I love React框架 and React框架');
    });

    it('returns original text with empty glossary', () => {
      expect(applyGlossary('Hello', [])).toBe('Hello');
    });

    it('handles special regex characters in terms', () => {
      const glossary = [{ term: 'C++', preferredTranslation: 'C Plus Plus', context: null }];
      const result = applyGlossary('I code in C++', glossary);
      expect(result).toBe('I code in C Plus Plus');
    });
  });
});

// ────────────────────────────────────────────────────────────
// 20. Media Processor
// ────────────────────────────────────────────────────────────

import {
  buildFfmpegArgs,
  estimateOutputSize,
} from '../src/media-processor.js';

describe('media-processor', () => {
  describe('buildFfmpegArgs', () => {
    it('builds basic args with input and output', () => {
      const args = buildFfmpegArgs('input.mp4', 'output.mp3');
      expect(args).toEqual(['-i', 'input.mp4', '-y', 'output.mp3']);
    });

    it('includes codec option', () => {
      const args = buildFfmpegArgs('in.mp4', 'out.aac', { codec: 'aac' });
      expect(args).toContain('-acodec');
      expect(args).toContain('aac');
    });

    it('includes bitrate option', () => {
      const args = buildFfmpegArgs('in.mp4', 'out.mp3', { bitrate: '128k' });
      expect(args).toContain('-b:a');
      expect(args).toContain('128k');
    });

    it('includes sampleRate option', () => {
      const args = buildFfmpegArgs('in.mp4', 'out.wav', { sampleRate: 44100 });
      expect(args).toContain('-ar');
      expect(args).toContain('44100');
    });

    it('includes channels option', () => {
      const args = buildFfmpegArgs('in.mp4', 'out.wav', { channels: 1 });
      expect(args).toContain('-ac');
      expect(args).toContain('1');
    });

    it('combines all options', () => {
      const args = buildFfmpegArgs('in.mkv', 'out.mp3', {
        codec: 'libmp3lame',
        bitrate: '192k',
        sampleRate: 48000,
        channels: 2,
      });
      expect(args[0]).toBe('-i');
      expect(args[1]).toBe('in.mkv');
      expect(args).toContain('-acodec');
      expect(args).toContain('libmp3lame');
      expect(args).toContain('-b:a');
      expect(args).toContain('192k');
      expect(args).toContain('-ar');
      expect(args).toContain('48000');
      expect(args).toContain('-ac');
      expect(args).toContain('2');
      expect(args[args.length - 2]).toBe('-y');
      expect(args[args.length - 1]).toBe('out.mp3');
    });
  });

  describe('estimateOutputSize', () => {
    it('computes size from duration and bitrate', () => {
      // 60 seconds at 128 kbps → 60 * 128 * 1000 / 8 = 960000 bytes
      expect(estimateOutputSize(60, 128)).toBe(960000);
    });

    it('returns 0 for zero duration', () => {
      expect(estimateOutputSize(0, 128)).toBe(0);
    });

    it('handles fractional values', () => {
      const result = estimateOutputSize(1.5, 64);
      // 1.5 * 64 * 1000 / 8 = 12000
      expect(result).toBe(12000);
    });
  });
});

// ── 15. Highlight Engine ───────────────────────────────────

import {
  hashText,
  extractContext,
  createAnchorPayload,
  resolveAnchor,
  computeSimilarity,
  findBestFuzzyMatch,
  updateAnchorState,
  resolveAnchors,
} from '../src/highlight-engine.js';
import type { AnchorResolutionResult } from '../src/highlight-engine.js';

// ── 16. Selection Context ──────────────────────────────────

import {
  createSelectionContext,
  getAvailableActions,
  createExitFromSelection,
  computeMenuPosition,
} from '../src/selection-context.js';
import type { TextSelection, SelectionContext as SelCtx } from '../src/selection-context.js';

// ════════════════════════════════════════════════════════════
//  15. Highlight Engine
// ════════════════════════════════════════════════════════════

describe('highlight-engine', () => {
  describe('hashText', () => {
    it('produces consistent hashes for the same input', () => {
      expect(hashText('hello world')).toBe(hashText('hello world'));
    });

    it('produces different hashes for different inputs', () => {
      expect(hashText('hello')).not.toBe(hashText('world'));
    });

    it('returns a hex string', () => {
      expect(hashText('test')).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('extractContext', () => {
    const text = 'The quick brown fox jumps over the lazy dog';

    it('extracts prefix and suffix around a selection', () => {
      const { prefix, suffix } = extractContext(text, 10, 19); // "brown fox"
      expect(prefix).toBe('The quick ');
      expect(suffix).toBe(' jumps over the lazy dog');
    });

    it('handles selection at start of text', () => {
      const { prefix, suffix } = extractContext(text, 0, 3); // "The"
      expect(prefix).toBe('');
      expect(suffix.length).toBeLessThanOrEqual(50);
    });

    it('handles selection at end of text', () => {
      const { prefix, suffix } = extractContext(text, 40, 43); // "dog"
      expect(suffix).toBe('');
      expect(prefix.length).toBeLessThanOrEqual(50);
    });

    it('respects custom context length', () => {
      const { prefix, suffix } = extractContext(text, 20, 25, 5);
      expect(prefix.length).toBeLessThanOrEqual(5);
      expect(suffix.length).toBeLessThanOrEqual(5);
    });
  });

  describe('createAnchorPayload', () => {
    it('creates a valid anchor with correct fields', () => {
      const fullText = 'Hello world this is a test document';
      const anchor = createAnchorPayload({
        fullText,
        selectedText: 'this is',
        anchorData: { paragraphIndex: 0, startOffset: 12, endOffset: 19 },
      });

      expect(anchor.quote).toBe('this is');
      expect(anchor.state).toBe('active');
      expect(anchor.textHash).toBe(hashText('this is'));
      expect(anchor.locator).toEqual({
        paragraphIndex: 0,
        startOffset: 12,
        endOffset: 19,
      });
      expect(anchor.prefix).toBeDefined();
      expect(anchor.suffix).toBeDefined();
    });

    it('includes sourceVersion when provided', () => {
      const anchor = createAnchorPayload({
        fullText: 'Some text here',
        selectedText: 'text',
        anchorData: { paragraphIndex: 0, startOffset: 5, endOffset: 9 },
        sourceVersion: 'v2',
      });
      expect(anchor.sourceVersion).toBe('v2');
    });
  });

  describe('resolveAnchor', () => {
    const originalText = 'The quick brown fox jumps over the lazy dog';

    it('returns exact match with active state', () => {
      const anchor = createAnchorPayload({
        fullText: originalText,
        selectedText: 'brown fox',
        anchorData: { paragraphIndex: 0, startOffset: 10, endOffset: 19 },
      });
      const result = resolveAnchor(anchor, originalText);
      expect(result.found).toBe(true);
      expect(result.state).toBe('active');
      expect(result.method).toBe('exact');
      expect(result.confidence).toBe(1.0);
    });

    it('returns fuzzy match when text slightly changed', () => {
      const anchor = createAnchorPayload({
        fullText: originalText,
        selectedText: 'brown fox',
        anchorData: { paragraphIndex: 0, startOffset: 10, endOffset: 19 },
      });
      const modifiedText = 'The quick brownn foxx jumps over the lazy dog';
      const result = resolveAnchor(anchor, modifiedText);
      expect(result.found).toBe(true);
      expect(result.state).toBe('fuzzy');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('returns detached when text completely different', () => {
      const anchor = createAnchorPayload({
        fullText: originalText,
        selectedText: 'brown fox',
        anchorData: { paragraphIndex: 0, startOffset: 10, endOffset: 19 },
      });
      const result = resolveAnchor(anchor, 'Completely unrelated content with nothing similar');
      expect(result.found).toBe(false);
      expect(result.state).toBe('detached');
      expect(result.method).toBe('failed');
    });
  });

  describe('computeSimilarity', () => {
    it('returns 1.0 for identical strings', () => {
      expect(computeSimilarity('hello', 'hello')).toBe(1.0);
    });

    it('returns 0.0 for completely different strings', () => {
      expect(computeSimilarity('abc', 'xyz')).toBe(0.0);
    });

    it('returns a value between 0 and 1 for similar strings', () => {
      const sim = computeSimilarity('hello', 'hallo');
      expect(sim).toBeGreaterThan(0.3);
      expect(sim).toBeLessThan(1.0);
    });

    it('handles empty strings', () => {
      expect(computeSimilarity('', '')).toBe(0.0);
      expect(computeSimilarity('hello', '')).toBe(0.0);
    });
  });

  describe('findBestFuzzyMatch', () => {
    it('finds a match when text is slightly modified', () => {
      const result = findBestFuzzyMatch('brown fox', 'The quick browm fox jumps');
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThan(0.7);
    });

    it('returns null when no match meets threshold', () => {
      const result = findBestFuzzyMatch('brown fox', 'xyz abc 123', 0.9);
      expect(result).toBeNull();
    });

    it('returns null for empty inputs', () => {
      expect(findBestFuzzyMatch('', 'some text')).toBeNull();
      expect(findBestFuzzyMatch('query', '')).toBeNull();
    });
  });

  describe('updateAnchorState', () => {
    it('updates anchor state based on resolution', () => {
      const anchor = createAnchorPayload({
        fullText: 'Some text here',
        selectedText: 'text',
        anchorData: { paragraphIndex: 0, startOffset: 5, endOffset: 9 },
      });
      const resolution: AnchorResolutionResult = {
        found: true,
        state: 'fuzzy',
        confidence: 0.8,
        method: 'fuzzy',
      };
      const updated = updateAnchorState(anchor, resolution);
      expect(updated.state).toBe('fuzzy');
      expect(updated.quote).toBe('text');
    });

    it('sets detached state when resolution fails', () => {
      const anchor = createAnchorPayload({
        fullText: 'Some text here',
        selectedText: 'text',
        anchorData: { paragraphIndex: 0, startOffset: 5, endOffset: 9 },
      });
      const resolution: AnchorResolutionResult = {
        found: false,
        state: 'detached',
        confidence: 0,
        method: 'failed',
      };
      const updated = updateAnchorState(anchor, resolution);
      expect(updated.state).toBe('detached');
    });
  });

  describe('resolveAnchors', () => {
    it('batch-resolves multiple anchors', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const anchors = [
        createAnchorPayload({
          fullText: text,
          selectedText: 'brown fox',
          anchorData: { paragraphIndex: 0, startOffset: 10, endOffset: 19 },
        }),
        createAnchorPayload({
          fullText: text,
          selectedText: 'lazy dog',
          anchorData: { paragraphIndex: 0, startOffset: 35, endOffset: 43 },
        }),
      ];
      const results = resolveAnchors(anchors, text);
      expect(results).toHaveLength(2);
      expect(results[0].found).toBe(true);
      expect(results[1].found).toBe(true);
    });
  });
});

// ════════════════════════════════════════════════════════════
//  16. Selection Context
// ════════════════════════════════════════════════════════════

describe('selection-context', () => {
  const fullText = 'First paragraph\nSecond paragraph with content\nThird paragraph end';

  const baseSelection: TextSelection = {
    text: 'Second paragraph',
    anchorData: { paragraphIndex: 1, startOffset: 0, endOffset: 16 },
    source: 'article',
    sourceId: 'art-1',
  };

  describe('createSelectionContext', () => {
    it('creates valid context from selection', () => {
      const ctx = createSelectionContext(baseSelection, fullText);
      expect(ctx.selection).toBe(baseSelection);
      expect(ctx.anchor.quote).toBe('Second paragraph');
      expect(ctx.anchor.state).toBe('active');
      expect(ctx.surroundingText).toContain('Second paragraph');
      expect(ctx.createdAt).toBeDefined();
    });

    it('includes source version in anchor when provided', () => {
      const ctx = createSelectionContext(baseSelection, fullText, 'v3');
      expect(ctx.anchor.sourceVersion).toBe('v3');
    });
  });

  describe('getAvailableActions', () => {
    it('returns 5 actions for article source', () => {
      const ctx = createSelectionContext(baseSelection, fullText);
      const actions = getAvailableActions(ctx);
      expect(actions).toHaveLength(5);
      const kinds = actions.map((a) => a.exitKind);
      expect(kinds).toContain('to_highlight');
      expect(kinds).toContain('to_note');
      expect(kinds).toContain('to_research');
      expect(kinds).toContain('to_action');
      expect(kinds).toContain('to_writing');
    });

    it('returns 6 actions for transcript source (includes speaker research)', () => {
      const transcriptSelection: TextSelection = {
        ...baseSelection,
        source: 'transcript',
      };
      const ctx = createSelectionContext(transcriptSelection, fullText);
      const actions = getAvailableActions(ctx);
      expect(actions).toHaveLength(6);
      expect(actions.some((a) => a.label === 'Research Speaker')).toBe(true);
    });
  });

  describe('createExitFromSelection', () => {
    it('produces correct ReadingExit for highlight', () => {
      const ctx = createSelectionContext(baseSelection, fullText);
      const exit = createExitFromSelection(ctx, 'to_highlight');
      expect(exit.kind).toBe('to_highlight');
      expect(exit.sourceArticleId).toBe('art-1');
      expect(exit.selectedText).toBe('Second paragraph');
      expect(exit.anchorData).toEqual(baseSelection.anchorData);
      expect(exit.targetObjectType).toBe('highlight');
    });

    it('produces correct ReadingExit for note', () => {
      const ctx = createSelectionContext(baseSelection, fullText);
      const exit = createExitFromSelection(ctx, 'to_note');
      expect(exit.kind).toBe('to_note');
      expect(exit.targetObjectType).toBe('note');
    });

    it('produces correct ReadingExit for action', () => {
      const ctx = createSelectionContext(baseSelection, fullText);
      const exit = createExitFromSelection(ctx, 'to_action');
      expect(exit.kind).toBe('to_action');
      expect(exit.targetObjectType).toBe('task');
    });
  });

  describe('computeMenuPosition', () => {
    it('positions menu centered above selection', () => {
      const pos = computeMenuPosition(
        { x: 200, y: 300, width: 100, height: 20 },
        200, 40,
        1024, 768,
      );
      expect(pos.x).toBe(150); // 200 + 50 - 100
      expect(pos.y).toBe(252); // 300 - 40 - 8
    });

    it('clamps to left edge when too far left', () => {
      const pos = computeMenuPosition(
        { x: 10, y: 300, width: 20, height: 20 },
        200, 40,
        1024, 768,
      );
      expect(pos.x).toBe(0);
    });

    it('clamps to right edge when too far right', () => {
      const pos = computeMenuPosition(
        { x: 950, y: 300, width: 100, height: 20 },
        200, 40,
        1024, 768,
      );
      expect(pos.x).toBe(824); // 1024 - 200
    });

    it('positions below selection when too close to top', () => {
      const pos = computeMenuPosition(
        { x: 200, y: 10, width: 100, height: 20 },
        200, 40,
        1024, 768,
      );
      expect(pos.y).toBe(38); // 10 + 20 + 8
    });
  });
});
