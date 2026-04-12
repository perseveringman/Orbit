// ── Multi-Media Renderers ──────────────────────────────────
import type { ContentMediaType } from '@orbit/domain';

// ── Article sections ───────────────────────────────────────

export type ArticleSectionKind = 'paragraph' | 'heading' | 'blockquote' | 'code' | 'image' | 'list';

export interface ArticleSection {
  readonly kind: ArticleSectionKind;
  readonly content: string;
  readonly index: number;
  readonly metadata: Readonly<Record<string, unknown>> | null;
}

export interface ArticleRenderer {
  readonly renderParagraphs: (content: string) => readonly ArticleSection[];
}

export function createArticleRenderer(): ArticleRenderer {
  return {
    renderParagraphs(content: string): readonly ArticleSection[] {
      const blocks = content.split(/\n\n+/).filter((b) => b.trim().length > 0);
      return blocks.map((block, index) => {
        const trimmed = block.trim();
        let kind: ArticleSectionKind = 'paragraph';
        if (trimmed.startsWith('#')) kind = 'heading';
        else if (trimmed.startsWith('>')) kind = 'blockquote';
        else if (trimmed.startsWith('```')) kind = 'code';
        else if (trimmed.startsWith('![')) kind = 'image';
        else if (/^[\-\*\d]/.test(trimmed)) kind = 'list';

        return { kind, content: trimmed, index, metadata: null };
      });
    },
  };
}

// ── Chapter nodes (books) ──────────────────────────────────

export interface ChapterNode {
  readonly id: string;
  readonly title: string;
  readonly level: number;
  readonly children: readonly ChapterNode[];
  readonly content: string | null;
}

export interface BookRenderer {
  readonly renderChapterTree: (chapters: readonly ChapterInput[]) => readonly ChapterNode[];
}

export interface ChapterInput {
  readonly id: string;
  readonly title: string;
  readonly level: number;
  readonly content: string | null;
}

export function createBookRenderer(): BookRenderer {
  return {
    renderChapterTree(chapters: readonly ChapterInput[]): readonly ChapterNode[] {
      const roots: ChapterNode[] = [];
      const stack: { node: ChapterNode; level: number }[] = [];

      for (const ch of chapters) {
        const node: ChapterNode = {
          id: ch.id,
          title: ch.title,
          level: ch.level,
          children: [],
          content: ch.content,
        };

        while (stack.length > 0 && stack[stack.length - 1].level >= ch.level) {
          stack.pop();
        }

        if (stack.length === 0) {
          roots.push(node);
        } else {
          const parent = stack[stack.length - 1].node;
          (parent.children as ChapterNode[]).push(node);
        }
        stack.push({ node, level: ch.level });
      }

      return roots;
    },
  };
}

// ── Timecoded segments (transcripts) ───────────────────────

export interface TimecodedSegment {
  readonly startTime: number;
  readonly endTime: number;
  readonly speaker: string | null;
  readonly text: string;
}

export interface TranscriptRenderer {
  readonly renderTimecoded: (segments: readonly TimecodedInput[]) => readonly TimecodedSegment[];
}

export interface TimecodedInput {
  readonly startTime: number;
  readonly endTime: number;
  readonly speaker: string | null;
  readonly text: string;
}

export function createTranscriptRenderer(): TranscriptRenderer {
  return {
    renderTimecoded(segments: readonly TimecodedInput[]): readonly TimecodedSegment[] {
      return segments.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        speaker: s.speaker,
        text: s.text,
      }));
    },
  };
}

// ── Renderer selection ─────────────────────────────────────

export type RendererType = 'article' | 'book' | 'transcript' | 'video' | 'podcast';

export function getRendererForMediaType(mediaType: ContentMediaType): RendererType {
  switch (mediaType) {
    case 'book_epub':
    case 'book_pdf':
      return 'book';
    case 'video':
      return 'video';
    case 'podcast_episode':
      return 'podcast';
    case 'audio':
      return 'transcript';
    default:
      return 'article';
  }
}
