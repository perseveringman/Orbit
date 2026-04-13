// ---------------------------------------------------------------------------
// @orbit/agent-core – Reader/Content Domain Tools
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { BuiltinTool, ToolCategory, ToolOutput } from './types.js';
import type { Toolset } from './toolset-registry.js';

// ── Local types ────────────────────────────────────────────

type ContentState =
  | 'discovered' | 'saved' | 'queued' | 'fetching' | 'fetched'
  | 'normalizing' | 'normalized' | 'extracting' | 'extracted'
  | 'transcribing' | 'transcribed' | 'translating' | 'translated'
  | 'ready_to_read' | 'archived'
  | 'fetch_failed' | 'extract_failed' | 'transcribe_failed' | 'translate_failed' | 'quarantined';

type SourceEndpointKind = 'rss' | 'atom' | 'newsletter' | 'api';

type SourceEndpointStatus = 'active' | 'paused' | 'muted' | 'error' | 'disabled';

// ── Content state machine (from feature-reader/content-state-machine.ts) ──

const ALLOWED_TRANSITIONS: ReadonlyMap<ContentState, readonly ContentState[]> = new Map([
  ['discovered', ['saved', 'queued', 'archived']],
  ['saved', ['queued', 'archived']],
  ['queued', ['fetching', 'archived']],
  ['fetching', ['fetched', 'fetch_failed']],
  ['fetched', ['normalizing', 'extracting', 'archived']],
  ['normalizing', ['normalized', 'extract_failed']],
  ['normalized', ['extracting', 'archived']],
  ['extracting', ['extracted', 'extract_failed']],
  ['extracted', ['transcribing', 'translating', 'ready_to_read', 'archived']],
  ['transcribing', ['transcribed', 'transcribe_failed']],
  ['transcribed', ['translating', 'ready_to_read', 'archived']],
  ['translating', ['translated', 'translate_failed']],
  ['translated', ['ready_to_read', 'archived']],
  ['ready_to_read', ['archived']],
  ['archived', ['discovered']],
  ['fetch_failed', ['queued', 'quarantined']],
  ['extract_failed', ['fetched', 'quarantined']],
  ['transcribe_failed', ['extracted', 'quarantined']],
  ['translate_failed', ['transcribed', 'quarantined']],
  ['quarantined', ['discovered']],
]);

// ── In-memory store ────────────────────────────────────────

export class ReaderDomainStore {
  private readonly contentItems = new Map<string, Record<string, unknown>>();
  private readonly highlights = new Map<string, Record<string, unknown>>();
  private readonly subscriptions = new Map<string, Record<string, unknown>>();

  // ---- Content ----

  addContent(url: string): Record<string, unknown> {
    const id = generateId('content');
    const now = new Date().toISOString();
    const item: Record<string, unknown> = {
      id,
      url,
      title: null,
      author: null,
      contentMarkdown: null,
      language: null,
      excerpt: null,
      wordCount: 0,
      status: 'discovered' as ContentState,
      pipelineSteps: [
        { name: 'fetch', status: 'pending', startedAt: null, completedAt: null, error: null },
        { name: 'extract', status: 'pending', startedAt: null, completedAt: null, error: null },
        { name: 'normalize', status: 'pending', startedAt: null, completedAt: null, error: null },
        { name: 'store', status: 'pending', startedAt: null, completedAt: null, error: null },
      ],
      createdAt: now,
      updatedAt: now,
    };
    this.contentItems.set(id, item);
    return item;
  }

  getContent(id: string): Record<string, unknown> | undefined {
    return this.contentItems.get(id);
  }

  setContent(id: string, item: Record<string, unknown>): void {
    this.contentItems.set(id, item);
  }

  listContent(filters?: { status?: string }): readonly Record<string, unknown>[] {
    let all = [...this.contentItems.values()];
    if (filters?.status) all = all.filter((c) => c.status === filters.status);
    return all;
  }

  searchContent(query: string): readonly Record<string, unknown>[] {
    const q = query.toLowerCase();
    return [...this.contentItems.values()].filter((c) => {
      const haystack = `${c.title ?? ''} ${c.url ?? ''} ${c.author ?? ''} ${c.contentMarkdown ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }

  // ---- Highlights ----

  addHighlight(contentId: string, highlight: Record<string, unknown>): Record<string, unknown> {
    const id = generateId('hl');
    const now = new Date().toISOString();
    const hl = { id, contentId, ...highlight, createdAt: now };
    this.highlights.set(id, hl);
    return hl;
  }

  listHighlights(contentId: string): readonly Record<string, unknown>[] {
    return [...this.highlights.values()].filter((h) => h.contentId === contentId);
  }

  // ---- Subscriptions ----

  addSubscription(sub: Record<string, unknown>): Record<string, unknown> {
    const id = generateId('sub');
    const now = new Date().toISOString();
    const subscription: Record<string, unknown> = {
      id,
      objectType: 'source_endpoint',
      title: sub.title ?? '',
      kind: sub.kind ?? 'rss',
      url: sub.url ?? '',
      siteUrl: sub.siteUrl ?? null,
      description: sub.description ?? null,
      language: sub.language ?? null,
      iconUrl: sub.iconUrl ?? null,
      status: 'active' as SourceEndpointStatus,
      fetchIntervalMinutes: sub.fetchIntervalMinutes ?? 60,
      lastFetchedAt: null,
      lastFetchError: null,
      qualityScore: 0.5,
      totalItems: 0,
      confirmedItems: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(id, subscription);
    return subscription;
  }

  getSubscription(id: string): Record<string, unknown> | undefined {
    return this.subscriptions.get(id);
  }

  setSubscription(id: string, sub: Record<string, unknown>): void {
    this.subscriptions.set(id, sub);
  }

  listSubscriptions(filters?: { kind?: string; status?: string; searchText?: string }): readonly Record<string, unknown>[] {
    let all = [...this.subscriptions.values()];
    if (filters?.kind) all = all.filter((s) => s.kind === filters.kind);
    if (filters?.status) all = all.filter((s) => s.status === filters.status);
    if (filters?.searchText) {
      const q = filters.searchText.toLowerCase();
      all = all.filter((s) => {
        const haystack = `${s.title} ${s.description ?? ''} ${s.url}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    return all;
  }
}

// Singleton store
const store = new ReaderDomainStore();

// ── Helpers ────────────────────────────────────────────────

function ok(data: unknown): ToolOutput {
  return { success: true, output: JSON.stringify(data) };
}

function fail(error: string): ToolOutput {
  return { success: false, output: JSON.stringify({ error }) };
}

function canContentTransition(current: ContentState, target: ContentState): boolean {
  const allowed = ALLOWED_TRANSITIONS.get(current);
  return allowed !== undefined && (allowed as readonly string[]).includes(target);
}

// ── Similarity (from feature-reader/highlight-engine.ts) ──

function getBigrams(str: string): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < str.length - 1; i++) {
    const bigram = str.slice(i, i + 2);
    map.set(bigram, (map.get(bigram) ?? 0) + 1);
  }
  return map;
}

function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

// ── Translation helper ─────────────────────────────────────

function splitTextForTranslation(text: string, maxChars: number): readonly string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let current = '';
  for (const para of paragraphs) {
    const candidate = current.length > 0 ? `${current}\n\n${para}` : para;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current.length > 0) chunks.push(current);
      if (para.length > maxChars) {
        for (let i = 0; i < para.length; i += maxChars) chunks.push(para.slice(i, i + maxChars));
        current = '';
      } else {
        current = para;
      }
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

// ── Tools ──────────────────────────────────────────────────

const CATEGORY: ToolCategory = 'reader';

export const contentAddUrlTool: BuiltinTool = {
  name: 'content.addUrl',
  description: 'Add content by URL to the reading library and initiate the processing pipeline',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to add' },
    },
    required: ['url'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const url = args.url as string;
      if (!url || url.length === 0) return fail('URL is required.');
      const item = store.addContent(url);
      return ok(item);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const contentGetStatusTool: BuiltinTool = {
  name: 'content.getStatus',
  description: 'Get pipeline status and valid transitions for a content item',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      contentId: { type: 'string', description: 'Content item ID' },
    },
    required: ['contentId'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const contentId = args.contentId as string;
      const item = store.getContent(contentId);
      if (!item) return fail(`Content not found: ${contentId}`);

      const current = item.status as ContentState;
      const allowed = ALLOWED_TRANSITIONS.get(current) ?? [];

      return ok({
        id: item.id,
        url: item.url,
        status: current,
        validTransitions: allowed,
        pipelineSteps: item.pipelineSteps,
      });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const contentListTool: BuiltinTool = {
  name: 'content.list',
  description: 'List content library items, optionally filtered by status',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'Filter by content status' },
    },
    required: [],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const status = args.status as string | undefined;
      const items = store.listContent(status ? { status } : undefined);
      return ok({ count: items.length, items });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const contentSearchTool: BuiltinTool = {
  name: 'content.search',
  description: 'Search content library by text query across title, URL, author, and body',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const query = args.query as string;
      const results = store.searchContent(query);
      return ok({ count: results.length, results });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const highlightCreateTool: BuiltinTool = {
  name: 'highlight.create',
  description: 'Create a text highlight/anchor on a content item',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      contentId: { type: 'string', description: 'Content item ID' },
      selectedText: { type: 'string', description: 'Highlighted text' },
      paragraphIndex: { type: 'number', description: 'Paragraph index of the selection' },
      startOffset: { type: 'number', description: 'Start offset within the paragraph' },
      endOffset: { type: 'number', description: 'End offset within the paragraph' },
      note: { type: 'string', description: 'Optional annotation note' },
    },
    required: ['contentId', 'selectedText'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const contentId = args.contentId as string;
      const selectedText = args.selectedText as string;
      const item = store.getContent(contentId);
      if (!item) return fail(`Content not found: ${contentId}`);

      const textHash = hashText(selectedText);
      const highlight = store.addHighlight(contentId, {
        selectedText,
        textHash,
        paragraphIndex: args.paragraphIndex ?? 0,
        startOffset: args.startOffset ?? 0,
        endOffset: args.endOffset ?? selectedText.length,
        note: args.note ?? null,
        state: 'active',
      });

      return ok(highlight);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const highlightListTool: BuiltinTool = {
  name: 'highlight.list',
  description: 'List all highlights for a content item',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      contentId: { type: 'string', description: 'Content item ID' },
    },
    required: ['contentId'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const contentId = args.contentId as string;
      const highlights = store.listHighlights(contentId);
      return ok({ count: highlights.length, highlights });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const subscriptionCreateTool: BuiltinTool = {
  name: 'subscription.create',
  description: 'Create an RSS/newsletter subscription',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Subscription title' },
      kind: { type: 'string', description: 'Endpoint kind', enum: ['rss', 'atom', 'newsletter', 'api'] },
      url: { type: 'string', description: 'Feed URL' },
      description: { type: 'string', description: 'Optional description' },
      fetchIntervalMinutes: { type: 'number', description: 'Fetch interval in minutes' },
    },
    required: ['title', 'kind', 'url'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const subscription = store.addSubscription(args);
      return ok(subscription);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const subscriptionListTool: BuiltinTool = {
  name: 'subscription.list',
  description: 'List subscriptions with optional filters',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      kind: { type: 'string', description: 'Filter by endpoint kind', enum: ['rss', 'atom', 'newsletter', 'api'] },
      status: { type: 'string', description: 'Filter by status', enum: ['active', 'paused', 'muted', 'error', 'disabled'] },
      searchText: { type: 'string', description: 'Text search filter' },
    },
    required: [],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const filters: { kind?: string; status?: string; searchText?: string } = {};
      if (args.kind) filters.kind = args.kind as string;
      if (args.status) filters.status = args.status as string;
      if (args.searchText) filters.searchText = args.searchText as string;
      const subs = store.listSubscriptions(Object.keys(filters).length > 0 ? filters : undefined);
      return ok({ count: subs.length, subscriptions: subs });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const subscriptionToggleTool: BuiltinTool = {
  name: 'subscription.toggle',
  description: 'Activate or pause a subscription',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      subscriptionId: { type: 'string', description: 'Subscription ID' },
      action: { type: 'string', description: 'Action to take', enum: ['activate', 'pause', 'mute', 'unmute'] },
    },
    required: ['subscriptionId', 'action'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const id = args.subscriptionId as string;
      const action = args.action as string;
      const sub = store.getSubscription(id);
      if (!sub) return fail(`Subscription not found: ${id}`);

      const statusMap: Record<string, SourceEndpointStatus> = {
        activate: 'active',
        pause: 'paused',
        mute: 'muted',
        unmute: 'active',
      };

      const newStatus = statusMap[action];
      if (!newStatus) return fail(`Unknown action: ${action}`);

      const updated = { ...sub, status: newStatus, updatedAt: new Date().toISOString() };
      store.setSubscription(id, updated);
      return ok(updated);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const translationTranslateTool: BuiltinTool = {
  name: 'translation.translate',
  description: 'Translate content text between languages (stub — returns placeholder translation)',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to translate' },
      sourceLanguage: { type: 'string', description: 'Source language code (e.g. "en")' },
      targetLanguage: { type: 'string', description: 'Target language code (e.g. "zh")' },
    },
    required: ['text', 'targetLanguage'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const text = args.text as string;
      const sourceLanguage = (args.sourceLanguage as string) ?? 'auto';
      const targetLanguage = args.targetLanguage as string;

      const chunks = splitTextForTranslation(text, 5000);
      const now = new Date().toISOString();

      // Stub: return placeholder translations with metadata
      const translations = chunks.map(
        (chunk) => `[${targetLanguage}] ${chunk}`,
      );

      return ok({
        translations,
        sourceLanguage,
        targetLanguage,
        detectedSourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
        engineId: 'stub',
        processedAt: now,
        chunkCount: chunks.length,
      });
    } catch (e) {
      return fail(String(e));
    }
  },
};

// ── Exported toolsets ──────────────────────────────────────

export const READER_DOMAIN_TOOLSETS: Toolset[] = [
  {
    name: 'content-pipeline',
    description: 'Content ingestion and pipeline management',
    category: CATEGORY,
    tools: [contentAddUrlTool, contentGetStatusTool, contentListTool, contentSearchTool],
  },
  {
    name: 'highlight-engine',
    description: 'Text highlighting and annotation',
    category: CATEGORY,
    tools: [highlightCreateTool, highlightListTool],
  },
  {
    name: 'subscription-manager',
    description: 'RSS/newsletter subscription management',
    category: CATEGORY,
    tools: [subscriptionCreateTool, subscriptionListTool, subscriptionToggleTool],
  },
  {
    name: 'translation',
    description: 'Content translation',
    category: CATEGORY,
    tools: [translationTranslateTool],
  },
];
