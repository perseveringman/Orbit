import { useCallback, useMemo, useState } from 'react';

import type { RenderableMessage } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchState {
  readonly query: string;
  readonly isOpen: boolean;
  readonly matchCount: number;
  readonly currentMatchIndex: number;
  readonly matchedMessageIds: readonly string[];
}

export interface UseConversationSearchReturn {
  readonly state: SearchState;
  readonly open: () => void;
  readonly close: () => void;
  readonly setQuery: (query: string) => void;
  readonly nextMatch: () => void;
  readonly prevMatch: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INITIAL_STATE: SearchState = {
  query: '',
  isOpen: false,
  matchCount: 0,
  currentMatchIndex: 0,
  matchedMessageIds: [],
};

/** Recursively collect message ids whose content or tool calls match `term`. */
function collectMatchingIds(
  messages: readonly RenderableMessage[],
  term: string,
): string[] {
  const ids: string[] = [];

  for (const msg of messages) {
    let matched = false;

    // Check message content
    if (msg.content.toLowerCase().includes(term)) {
      matched = true;
    }

    // Check tool call names and results
    if (!matched && msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        if (
          tc.name.toLowerCase().includes(term) ||
          (tc.result != null && tc.result.toLowerCase().includes(term))
        ) {
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      ids.push(msg.id);
    }

    // Recurse into children
    if (msg.children) {
      ids.push(...collectMatchingIds(msg.children, term));
    }
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConversationSearch(
  messages: readonly RenderableMessage[],
): UseConversationSearchReturn {
  const [query, setQueryRaw] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Build search index lazily – recomputed only when query or messages change.
  const matchedMessageIds = useMemo<readonly string[]>(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return [];
    return collectMatchingIds(messages, trimmed.toLowerCase());
  }, [messages, query]);

  const matchCount = matchedMessageIds.length;

  // ---- Actions ----

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setQueryRaw('');
    setIsOpen(false);
    setCurrentMatchIndex(0);
  }, []);

  const setQuery = useCallback((next: string) => {
    setQueryRaw(next);
    setCurrentMatchIndex(0);
  }, []);

  const nextMatch = useCallback(() => {
    setCurrentMatchIndex((prev) => (matchCount === 0 ? 0 : (prev + 1) % matchCount));
  }, [matchCount]);

  const prevMatch = useCallback(() => {
    setCurrentMatchIndex((prev) =>
      matchCount === 0 ? 0 : (prev - 1 + matchCount) % matchCount,
    );
  }, [matchCount]);

  const state: SearchState = useMemo(
    () => ({
      query,
      isOpen,
      matchCount,
      currentMatchIndex: matchCount === 0 ? 0 : currentMatchIndex,
      matchedMessageIds,
    }),
    [query, isOpen, matchCount, currentMatchIndex, matchedMessageIds],
  );

  return { state, open, close, setQuery, nextMatch, prevMatch };
}
