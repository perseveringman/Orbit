import { describe, it, expect } from 'vitest';
import {
  isYouTubeUrl,
  extractYouTubeVideoId,
  extractYouTubeChannelId,
  getYouTubeChannelFeedUrl,
  resolveYouTubeUrl,
  fetchYouTubeVideoDetails,
  fetchYouTubeTranscript,
  isPodcastUrl,
  extractApplePodcastId,
  extractSpotifyShowId,
  extractXiaoyuzhouShowId,
  buildAppleLookupUrl,
  resolvePodcastUrl,
  isRssFeedUrl,
  discoverRssLinks,
  parseRssFeedXml,
  parseOpml,
  exportOpml,
  resolveRssUrl,
  isNewsletterUrl,
  resolveNewsletterUrl,
  extractMetadataFromHtml,
  resolveGenericUrl,
  resolveUrl,
  routeUrl,
} from '../src/index.js';

// ── YouTube ────────────────────────────────────────────────

describe('isYouTubeUrl', () => {
  it('detects youtube.com URLs', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=abc123')).toBe(true);
    expect(isYouTubeUrl('https://youtube.com/channel/UC1234')).toBe(true);
  });

  it('detects youtu.be URLs', () => {
    expect(isYouTubeUrl('https://youtu.be/abc123')).toBe(true);
  });

  it('detects m.youtube.com URLs', () => {
    expect(isYouTubeUrl('https://m.youtube.com/watch?v=abc123')).toBe(true);
  });

  it('rejects non-YouTube URLs', () => {
    expect(isYouTubeUrl('https://vimeo.com/12345')).toBe(false);
    expect(isYouTubeUrl('not a url')).toBe(false);
  });
});

describe('extractYouTubeVideoId', () => {
  it('extracts from /watch?v=', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from youtu.be', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from /shorts/', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/abc123')).toBe('abc123');
  });

  it('extracts from /embed/', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/abc123')).toBe('abc123');
  });

  it('extracts from /live/', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/live/abc123')).toBe('abc123');
  });

  it('returns null for non-video URLs', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/channel/UC1234')).toBe(null);
  });

  it('returns null for non-YouTube URLs', () => {
    expect(extractYouTubeVideoId('https://vimeo.com/12345')).toBe(null);
  });
});

describe('extractYouTubeChannelId', () => {
  it('extracts from /channel/UCxxx', () => {
    expect(extractYouTubeChannelId('https://www.youtube.com/channel/UCaBcDeFgHiJ')).toBe('UCaBcDeFgHiJ');
  });

  it('extracts from /@handle', () => {
    expect(extractYouTubeChannelId('https://www.youtube.com/@testhandle')).toBe('@testhandle');
  });

  it('extracts from /c/name', () => {
    expect(extractYouTubeChannelId('https://www.youtube.com/c/TestChannel')).toBe('c/TestChannel');
  });

  it('returns null for video URLs', () => {
    expect(extractYouTubeChannelId('https://www.youtube.com/watch?v=abc123')).toBe(null);
  });
});

describe('getYouTubeChannelFeedUrl', () => {
  it('builds feed URL', () => {
    expect(getYouTubeChannelFeedUrl('UCaBcDeFgHiJ')).toBe(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCaBcDeFgHiJ',
    );
  });
});

describe('resolveYouTubeUrl', () => {
  it('resolves channel URL with youtube_channel kind', () => {
    const result = resolveYouTubeUrl('https://www.youtube.com/channel/UCaBcDeFgHiJ');
    expect(result.ok).toBe(true);
    expect(result.source?.kind).toBe('youtube_channel');
    expect(result.source?.feedUrl).toContain('UCaBcDeFgHiJ');
    expect(result.resolverUsed).toBe('youtube');
  });

  it('resolves video URL with manual_url kind', () => {
    const result = resolveYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.ok).toBe(true);
    expect(result.source?.kind).toBe('manual_url');
    expect(result.resolverUsed).toBe('youtube');
  });

  it('returns error for non-YouTube URL', () => {
    const result = resolveYouTubeUrl('https://vimeo.com/12345');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Not a YouTube URL');
  });
});

describe('fetchYouTubeVideoDetails', () => {
  it('extracts details and top comments from the watch page HTML', async () => {
    const playerResponse = {
      videoDetails: {
        title: 'Orbit reader demo',
        author: 'Orbit Channel',
        shortDescription: 'Video description body',
        viewCount: '12345',
        lengthSeconds: '105',
        thumbnail: {
          thumbnails: [
            { url: 'https://example.com/thumb-small.jpg' },
            { url: 'https://example.com/thumb-large.jpg' },
          ],
        },
      },
      microformat: {
        playerMicroformatRenderer: {
          uploadDate: '2026-04-13',
        },
      },
    };

    const initialData = {
      contents: {
        twoColumnWatchNextResults: {
          results: {
            results: {
              contents: [
                {
                  videoSecondaryInfoRenderer: {
                    owner: {
                      videoOwnerRenderer: {
                        title: { runs: [{ text: 'Orbit Channel' }] },
                        thumbnail: {
                          thumbnails: [
                            { url: 'https://example.com/channel-small.jpg' },
                            { url: 'https://example.com/channel-large.jpg' },
                          ],
                        },
                        subscriberCountText: { simpleText: '12.3万位订阅者' },
                      },
                    },
                  },
                },
                {
                  itemSectionRenderer: {
                    contents: [
                      {
                        commentThreadRenderer: {
                          comment: {
                            commentRenderer: {
                              authorText: { simpleText: 'Alice' },
                              contentText: { runs: [{ text: 'Great walkthrough.' }] },
                              voteCount: { simpleText: '5' },
                              publishedTimeText: { runs: [{ text: '2 days ago' }] },
                              authorThumbnail: {
                                thumbnails: [{ url: 'https://example.com/alice.jpg' }],
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
      engagementPanels: [
        {
          commentsHeaderRenderer: {
            countText: { simpleText: '1' },
          },
        },
      ],
    };

    const html = `
      <html>
        <script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script>
        <script>var ytInitialData = ${JSON.stringify(initialData)};</script>
      </html>
    `;

    const fetchFn: typeof fetch = async (input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.startsWith('https://www.youtube.com/watch?v=test-video-details')) {
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await fetchYouTubeVideoDetails('test-video-details', { fetchFn });

    expect(result).toMatchObject({
      title: 'Orbit reader demo',
      description: 'Video description body',
      viewCount: 12345,
      commentCount: 1,
      uploadDate: '2026-04-13',
      channelName: 'Orbit Channel',
      channelThumbnail: 'https://example.com/channel-large.jpg',
      subscriberCount: '12.3万位订阅者',
      duration: 105,
      thumbnail: 'https://example.com/thumb-large.jpg',
    });
    expect(result?.comments).toHaveLength(1);
    expect(result?.comments[0]).toMatchObject({
      author: 'Alice',
      text: 'Great walkthrough.',
      likeCount: 5,
      publishedText: '2 days ago',
      authorThumbnail: 'https://example.com/alice.jpg',
    });
  });
});

describe('fetchYouTubeTranscript', () => {
  it('selects a preferred caption track and parses json3 transcript events', async () => {
    const playerResponse = {
      videoDetails: {
        title: 'Orbit reader demo',
      },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: 'https://example.com/captions?lang=en',
              languageCode: 'en',
              name: { simpleText: 'English' },
            },
            {
              baseUrl: 'https://example.com/captions?lang=zh',
              languageCode: 'zh-Hans',
              kind: 'asr',
              name: { simpleText: '中文（自动生成）' },
            },
          ],
        },
      },
    };

    const html = `
      <html>
        <script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script>
      </html>
    `;

    const transcriptPayload = {
      events: [
        {
          tStartMs: 0,
          dDurationMs: 1500,
          segs: [{ utf8: 'Hello ' }, { utf8: 'world' }],
        },
        {
          tStartMs: 1500,
          dDurationMs: 2000,
          segs: [{ utf8: 'Second sentence.' }],
        },
      ],
    };

    const fetchFn: typeof fetch = async (input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.startsWith('https://www.youtube.com/watch?v=test-video-transcript')) {
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      if (url.startsWith('https://example.com/captions')) {
        expect(new URL(url).searchParams.get('fmt')).toBe('json3');
        return new Response(JSON.stringify(transcriptPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await fetchYouTubeTranscript('test-video-transcript', { fetchFn });

    expect(result).toMatchObject({
      language: 'en',
      isAutoGenerated: false,
    });
    expect(result?.segments).toEqual([
      { startTime: 0, endTime: 1.5, text: 'Hello world' },
      { startTime: 1.5, endTime: 3.5, text: 'Second sentence.' },
    ]);
  });
});

// ── Podcast ────────────────────────────────────────────────

describe('isPodcastUrl', () => {
  it('detects Apple Podcasts', () => {
    expect(isPodcastUrl('https://podcasts.apple.com/us/podcast/some-show/id1234567890')).toBe(true);
  });

  it('detects Spotify shows', () => {
    expect(isPodcastUrl('https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk')).toBe(true);
  });

  it('detects 小宇宙', () => {
    expect(isPodcastUrl('https://www.xiaoyuzhoufm.com/podcast/abc123')).toBe(true);
  });

  it('rejects non-podcast URLs', () => {
    expect(isPodcastUrl('https://example.com')).toBe(false);
  });
});

describe('extractApplePodcastId', () => {
  it('extracts ID from Apple Podcasts URL', () => {
    expect(extractApplePodcastId('https://podcasts.apple.com/us/podcast/some-show/id1234567890')).toBe('1234567890');
  });

  it('returns null for non-Apple URL', () => {
    expect(extractApplePodcastId('https://example.com/id123')).toBe(null);
  });
});

describe('extractSpotifyShowId', () => {
  it('extracts show ID from Spotify URL', () => {
    expect(extractSpotifyShowId('https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk')).toBe('4rOoJ6Egrf8K2IrywzwOMk');
  });

  it('returns null for non-Spotify URL', () => {
    expect(extractSpotifyShowId('https://example.com/show/abc')).toBe(null);
  });
});

describe('extractXiaoyuzhouShowId', () => {
  it('extracts show ID from 小宇宙 URL', () => {
    expect(extractXiaoyuzhouShowId('https://www.xiaoyuzhoufm.com/podcast/abc123')).toBe('abc123');
  });

  it('returns null for non-小宇宙 URL', () => {
    expect(extractXiaoyuzhouShowId('https://example.com/podcast/abc')).toBe(null);
  });
});

describe('buildAppleLookupUrl', () => {
  it('builds iTunes lookup URL', () => {
    expect(buildAppleLookupUrl('1234567890')).toBe(
      'https://itunes.apple.com/lookup?id=1234567890&entity=podcast',
    );
  });
});

describe('resolvePodcastUrl', () => {
  it('resolves Apple Podcast URL', () => {
    const result = resolvePodcastUrl('https://podcasts.apple.com/us/podcast/some-show/id1234567890');
    expect(result.ok).toBe(true);
    expect(result.source?.kind).toBe('podcast_feed');
    expect(result.resolverUsed).toBe('podcast');
  });

  it('resolves Spotify URL', () => {
    const result = resolvePodcastUrl('https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk');
    expect(result.ok).toBe(true);
    expect(result.source?.kind).toBe('podcast_feed');
  });

  it('returns error for non-podcast URL', () => {
    const result = resolvePodcastUrl('https://example.com');
    expect(result.ok).toBe(false);
  });
});

// ── RSS ────────────────────────────────────────────────────

describe('isRssFeedUrl', () => {
  it('detects .xml URLs', () => {
    expect(isRssFeedUrl('https://example.com/feed.xml')).toBe(true);
  });

  it('detects .rss URLs', () => {
    expect(isRssFeedUrl('https://example.com/index.rss')).toBe(true);
  });

  it('detects .atom URLs', () => {
    expect(isRssFeedUrl('https://example.com/feed.atom')).toBe(true);
  });

  it('detects /feed/ paths', () => {
    expect(isRssFeedUrl('https://example.com/feed/')).toBe(true);
  });

  it('detects /rss/ paths', () => {
    expect(isRssFeedUrl('https://example.com/rss/')).toBe(true);
  });

  it('rejects non-RSS URLs', () => {
    expect(isRssFeedUrl('https://example.com/article/hello')).toBe(false);
  });
});

describe('discoverRssLinks', () => {
  it('finds RSS links in HTML', () => {
    const html = `
      <html><head>
        <link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/feed.xml" />
        <link rel="alternate" type="application/atom+xml" title="Atom Feed" href="/atom.xml" />
      </head></html>
    `;
    const results = discoverRssLinks(html, 'https://example.com');
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe('https://example.com/feed.xml');
    expect(results[0].type).toBe('rss');
    expect(results[0].title).toBe('RSS Feed');
    expect(results[1].url).toBe('https://example.com/atom.xml');
    expect(results[1].type).toBe('atom');
  });

  it('resolves relative URLs', () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="/blog/feed.xml" />`;
    const results = discoverRssLinks(html, 'https://example.com/page');
    expect(results[0].url).toBe('https://example.com/blog/feed.xml');
  });

  it('returns empty for no RSS links', () => {
    const html = '<html><head><link rel="stylesheet" href="/style.css" /></head></html>';
    expect(discoverRssLinks(html, 'https://example.com')).toHaveLength(0);
  });
});

describe('parseRssFeedXml', () => {
  it('parses RSS 2.0 feed', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Test Feed</title>
          <description>A test feed</description>
          <item>
            <title>Article 1</title>
            <link>https://example.com/1</link>
            <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
            <author>John</author>
            <description>Summary 1</description>
          </item>
          <item>
            <title>Article 2</title>
            <link>https://example.com/2</link>
          </item>
        </channel>
      </rss>`;

    const result = parseRssFeedXml(xml);
    expect(result.title).toBe('Test Feed');
    expect(result.description).toBe('A test feed');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].title).toBe('Article 1');
    expect(result.entries[0].url).toBe('https://example.com/1');
    expect(result.entries[0].author).toBe('John');
    expect(result.entries[0].summary).toBe('Summary 1');
    expect(result.entries[1].title).toBe('Article 2');
  });

  it('parses Atom feed', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Feed</title>
        <subtitle>An Atom feed</subtitle>
        <entry>
          <title>Entry 1</title>
          <link href="https://example.com/entry1" />
          <published>2024-01-01T00:00:00Z</published>
          <author><name>Jane</name></author>
          <summary>Summary of entry 1</summary>
        </entry>
      </feed>`;

    const result = parseRssFeedXml(xml);
    expect(result.title).toBe('Atom Feed');
    expect(result.description).toBe('An Atom feed');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].title).toBe('Entry 1');
    expect(result.entries[0].url).toBe('https://example.com/entry1');
    expect(result.entries[0].author).toBe('Jane');
  });

  it('handles CDATA sections', () => {
    const xml = `<rss version="2.0">
      <channel>
        <title><![CDATA[CDATA Title]]></title>
        <item>
          <title><![CDATA[CDATA Item]]></title>
          <link>https://example.com</link>
        </item>
      </channel>
    </rss>`;

    const result = parseRssFeedXml(xml);
    expect(result.title).toBe('CDATA Title');
    expect(result.entries[0].title).toBe('CDATA Item');
  });
});

describe('parseOpml / exportOpml roundtrip', () => {
  it('parses OPML outlines', () => {
    const xml = `<?xml version="1.0"?>
      <opml version="2.0">
        <head><title>My Feeds</title></head>
        <body>
          <outline text="Blog" title="Blog" xmlUrl="https://example.com/feed.xml" htmlUrl="https://example.com" type="rss" />
          <outline text="News" xmlUrl="https://news.com/rss" />
        </body>
      </opml>`;

    const outlines = parseOpml(xml);
    expect(outlines).toHaveLength(2);
    expect(outlines[0].title).toBe('Blog');
    expect(outlines[0].xmlUrl).toBe('https://example.com/feed.xml');
    expect(outlines[0].htmlUrl).toBe('https://example.com');
    expect(outlines[0].type).toBe('rss');
    expect(outlines[1].title).toBe('News');
    expect(outlines[1].htmlUrl).toBe(null);
  });

  it('roundtrips OPML parse → export → parse', () => {
    const outlines = [
      { title: 'Feed A', xmlUrl: 'https://a.com/feed.xml', htmlUrl: 'https://a.com', type: 'rss' as const },
      { title: 'Feed B', xmlUrl: 'https://b.com/atom.xml', htmlUrl: null, type: null },
    ] as const;

    const exported = exportOpml(outlines, 'Test Feeds');
    expect(exported).toContain('<?xml');
    expect(exported).toContain('Test Feeds');

    const parsed = parseOpml(exported);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe('Feed A');
    expect(parsed[0].xmlUrl).toBe('https://a.com/feed.xml');
    expect(parsed[1].title).toBe('Feed B');
    expect(parsed[1].xmlUrl).toBe('https://b.com/atom.xml');
  });
});

describe('resolveRssUrl', () => {
  it('resolves direct RSS feed URL', () => {
    const result = resolveRssUrl('https://example.com/feed.xml');
    expect(result.ok).toBe(true);
    expect(result.source?.kind).toBe('rss_feed');
    expect(result.source?.feedUrl).toBe('https://example.com/feed.xml');
  });

  it('discovers RSS from HTML', () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="/feed.xml" />`;
    const result = resolveRssUrl('https://example.com', html);
    expect(result.ok).toBe(true);
    expect(result.source?.feedUrl).toBe('https://example.com/feed.xml');
  });

  it('returns error when no RSS found', () => {
    const result = resolveRssUrl('https://example.com');
    expect(result.ok).toBe(false);
  });
});

// ── Newsletter ─────────────────────────────────────────────

describe('isNewsletterUrl', () => {
  it('detects Substack', () => {
    expect(isNewsletterUrl('https://example.substack.com')).toBe(true);
  });

  it('detects beehiiv', () => {
    expect(isNewsletterUrl('https://newsletter.beehiiv.com/subscribe')).toBe(true);
  });

  it('detects buttondown', () => {
    expect(isNewsletterUrl('https://buttondown.email/author')).toBe(true);
  });

  it('detects ghost newsletter paths', () => {
    expect(isNewsletterUrl('https://example.com/subscribe')).toBe(true);
    expect(isNewsletterUrl('https://example.com/newsletter')).toBe(true);
  });

  it('rejects non-newsletter URLs', () => {
    expect(isNewsletterUrl('https://example.com/article')).toBe(false);
  });
});

describe('resolveNewsletterUrl', () => {
  it('resolves Substack URL', () => {
    const result = resolveNewsletterUrl('https://example.substack.com');
    expect(result.ok).toBe(true);
    expect(result.source?.kind).toBe('newsletter');
    expect(result.resolverUsed).toBe('newsletter');
  });

  it('returns error for non-newsletter', () => {
    const result = resolveNewsletterUrl('https://example.com/article');
    expect(result.ok).toBe(false);
  });
});

// ── Generic / Metadata ─────────────────────────────────────

describe('extractMetadataFromHtml', () => {
  it('extracts title from og:title', () => {
    const html = `<meta property="og:title" content="OG Title" />`;
    const meta = extractMetadataFromHtml(html, 'https://example.com');
    expect(meta.title).toBe('OG Title');
  });

  it('extracts title from <title> tag', () => {
    const html = `<title>Page Title</title>`;
    const meta = extractMetadataFromHtml(html, 'https://example.com');
    expect(meta.title).toBe('Page Title');
  });

  it('extracts description', () => {
    const html = `<meta property="og:description" content="OG Desc" />`;
    const meta = extractMetadataFromHtml(html, 'https://example.com');
    expect(meta.description).toBe('OG Desc');
  });

  it('extracts author', () => {
    const html = `<meta name="author" content="Jane Doe" />`;
    const meta = extractMetadataFromHtml(html, 'https://example.com');
    expect(meta.author).toBe('Jane Doe');
  });

  it('extracts language from html lang', () => {
    const html = `<html lang="zh-CN"><head></head></html>`;
    const meta = extractMetadataFromHtml(html, 'https://example.com');
    expect(meta.language).toBe('zh-CN');
  });

  it('extracts image', () => {
    const html = `<meta property="og:image" content="https://example.com/img.jpg" />`;
    const meta = extractMetadataFromHtml(html, 'https://example.com');
    expect(meta.imageUrl).toBe('https://example.com/img.jpg');
  });

  it('extracts site name', () => {
    const html = `<meta property="og:site_name" content="My Site" />`;
    const meta = extractMetadataFromHtml(html, 'https://example.com');
    expect(meta.siteName).toBe('My Site');
  });

  it('extracts published time', () => {
    const html = `<meta property="article:published_time" content="2024-01-15T10:00:00Z" />`;
    const meta = extractMetadataFromHtml(html, 'https://example.com');
    expect(meta.publishedAt).toBe('2024-01-15T10:00:00Z');
  });

  it('returns nulls for empty HTML', () => {
    const meta = extractMetadataFromHtml('', 'https://example.com');
    expect(meta.title).toBe(null);
    expect(meta.description).toBe(null);
  });
});

describe('resolveGenericUrl', () => {
  it('returns manual_url kind', () => {
    const result = resolveGenericUrl('https://example.com/some-page');
    expect(result.ok).toBe(true);
    expect(result.source?.kind).toBe('manual_url');
    expect(result.resolverUsed).toBe('generic');
  });
});

// ── Router ─────────────────────────────────────────────────

describe('resolveUrl', () => {
  it('routes YouTube URLs to youtube resolver', () => {
    const result = resolveUrl('https://www.youtube.com/watch?v=abc123');
    expect(result.resolverUsed).toBe('youtube');
    expect(result.ok).toBe(true);
  });

  it('routes Apple Podcasts to podcast resolver', () => {
    const result = resolveUrl('https://podcasts.apple.com/us/podcast/show/id123456');
    expect(result.resolverUsed).toBe('podcast');
    expect(result.ok).toBe(true);
  });

  it('routes RSS feed URLs to rss resolver', () => {
    const result = resolveUrl('https://example.com/feed.xml');
    expect(result.resolverUsed).toBe('rss');
    expect(result.ok).toBe(true);
  });

  it('routes Substack to newsletter resolver', () => {
    const result = resolveUrl('https://example.substack.com');
    expect(result.resolverUsed).toBe('newsletter');
    expect(result.ok).toBe(true);
  });

  it('falls back to generic resolver', () => {
    const result = resolveUrl('https://example.com/random-page');
    expect(result.resolverUsed).toBe('generic');
    expect(result.ok).toBe(true);
  });

  it('routes Spotify to podcast resolver', () => {
    const result = resolveUrl('https://open.spotify.com/show/abc123');
    expect(result.resolverUsed).toBe('podcast');
  });

  it('routes 小宇宙 to podcast resolver', () => {
    const result = resolveUrl('https://xiaoyuzhoufm.com/podcast/abc123');
    expect(result.resolverUsed).toBe('podcast');
  });

  it('routes YouTube channel to youtube resolver with correct kind', () => {
    const result = resolveUrl('https://www.youtube.com/channel/UCaBcDeFgHiJ');
    expect(result.resolverUsed).toBe('youtube');
    expect(result.source?.kind).toBe('youtube_channel');
  });
});

// ── routeUrl ──────────────────────────────────────────────

describe('routeUrl', () => {
  it('returns resolverType alongside result', () => {
    const route = routeUrl({ url: 'https://www.youtube.com/watch?v=abc123' });
    expect(route.resolverType).toBe('youtube');
    expect(route.result.ok).toBe(true);
    expect(route.result.resolverUsed).toBe('youtube');
  });

  it('routes podcast URLs with correct type', () => {
    const route = routeUrl({ url: 'https://podcasts.apple.com/us/podcast/show/id123456' });
    expect(route.resolverType).toBe('podcast');
    expect(route.result.ok).toBe(true);
  });

  it('routes RSS feed URLs with correct type', () => {
    const route = routeUrl({ url: 'https://example.com/feed.xml' });
    expect(route.resolverType).toBe('rss');
    expect(route.result.source?.feedUrl).toBe('https://example.com/feed.xml');
  });

  it('discovers RSS feeds from provided HTML', () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="/blog/feed.xml" />`;
    const route = routeUrl({ url: 'https://example.com', html });
    expect(route.resolverType).toBe('rss');
    expect(route.result.ok).toBe(true);
    expect(route.result.source?.feedUrl).toBe('https://example.com/blog/feed.xml');
  });

  it('does not discover RSS when HTML has no feed links', () => {
    const html = `<html><head><link rel="stylesheet" href="/style.css" /></head></html>`;
    const route = routeUrl({ url: 'https://example.com', html });
    expect(route.resolverType).toBe('generic');
  });

  it('routes newsletter URLs with correct type', () => {
    const route = routeUrl({ url: 'https://newsletter.substack.com' });
    expect(route.resolverType).toBe('newsletter');
    expect(route.result.ok).toBe(true);
  });

  it('falls back to generic with correct type', () => {
    const route = routeUrl({ url: 'https://example.com/random-page' });
    expect(route.resolverType).toBe('generic');
    expect(route.result.resolverUsed).toBe('generic');
  });

  it('accepts optional headers without affecting routing', () => {
    const route = routeUrl({
      url: 'https://www.youtube.com/watch?v=abc',
      headers: { 'User-Agent': 'OrbitBot/1.0' },
    });
    expect(route.resolverType).toBe('youtube');
  });

  it('prefers YouTube over RSS when URL matches YouTube', () => {
    const route = routeUrl({ url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC123' });
    expect(route.resolverType).toBe('youtube');
  });
});
