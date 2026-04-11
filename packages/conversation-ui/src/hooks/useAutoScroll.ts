import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoScrollState {
  readonly isAtBottom: boolean;
  readonly hasNewMessages: boolean;
}

export interface UseAutoScrollOptions {
  /** Pixels from the bottom to still consider "at bottom". @default 50 */
  readonly threshold?: number;
}

export interface UseAutoScrollReturn {
  readonly scrollRef: React.RefObject<HTMLDivElement | null>;
  readonly state: AutoScrollState;
  readonly scrollToBottom: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLD = 50;

export function useAutoScroll(
  messageCount: number,
  options: UseAutoScrollOptions = {},
): UseAutoScrollReturn {
  const { threshold = DEFAULT_THRESHOLD } = options;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevMessageCount = useRef(messageCount);

  // ---- Scroll position tracking ----
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;

    setIsAtBottom(atBottom);

    if (atBottom) {
      setHasNewMessages(false);
    }
  }, [threshold]);

  // Attach / detach the scroll listener
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // ---- React to new messages ----
  useEffect(() => {
    if (messageCount <= prevMessageCount.current) {
      prevMessageCount.current = messageCount;
      return;
    }

    prevMessageCount.current = messageCount;

    if (isAtBottom) {
      // Auto-scroll when the user is already at the bottom
      const el = scrollRef.current;
      el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      setHasNewMessages(true);
    }
  }, [messageCount, isAtBottom]);

  // ---- Manual scroll-to-bottom ----
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setHasNewMessages(false);
  }, []);

  return {
    scrollRef,
    state: { isAtBottom, hasNewMessages },
    scrollToBottom,
  };
}
