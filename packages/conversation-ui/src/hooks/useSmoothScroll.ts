// ---------------------------------------------------------------------------
// useSmoothScroll.ts – Smart auto-scroll with direction detection and throttle
// ---------------------------------------------------------------------------
// Replaces the basic "always scroll to bottom" pattern with a sophisticated
// keep-bottom strategy inspired by production chat UIs:
//
//  1. Keep-bottom mode: auto-scrolls during streaming when user is near bottom
//  2. Direction detection: user scrolling UP exits keep-bottom mode
//  3. Throttled state checks: scroll events are throttled to 100ms
//  4. Smooth scrolling: uses `behavior: 'smooth'` for visual polish
//  5. Streaming-aware: distinguishes streaming updates from new messages
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UseSmoothScrollOptions {
  /** Pixels from bottom to consider "at bottom". @default 60 */
  readonly bottomThreshold?: number;
  /** Throttle interval for scroll event handling (ms). @default 100 */
  readonly throttleMs?: number;
}

export interface UseSmoothScrollReturn {
  /** Attach this ref to the scroll container element. */
  readonly scrollRef: React.RefObject<HTMLDivElement>;
  /** Whether the container is currently near the bottom. */
  readonly isAtBottom: boolean;
  /** Whether auto-follow is active (streaming + user hasn't scrolled up). */
  readonly isKeepBottom: boolean;
  /** Whether there are new messages below the viewport. */
  readonly hasNewContent: boolean;
  /** Manually scroll to bottom and re-engage keep-bottom. */
  readonly scrollToBottom: () => void;
  /** Notify that streaming content has updated (triggers keep-bottom scroll). */
  readonly onStreamingUpdate: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BOTTOM_THRESHOLD = 60;
const DEFAULT_THROTTLE_MS = 100;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSmoothScroll(
  options: UseSmoothScrollOptions = {},
): UseSmoothScrollReturn {
  const { bottomThreshold = DEFAULT_BOTTOM_THRESHOLD, throttleMs = DEFAULT_THROTTLE_MS } = options;

  const scrollRef = useRef<HTMLDivElement>(null!);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewContent, setHasNewContent] = useState(false);

  // Keep-bottom is a ref because it's mutated from scroll events and should
  // not trigger re-renders on its own.
  const isKeepBottomRef = useRef(true);
  const [isKeepBottom, setIsKeepBottom] = useState(true);

  // Direction detection
  const lastScrollTopRef = useRef(0);
  // Throttle state
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Throttled scroll handler ----
  const handleScroll = useCallback(() => {
    if (throttleTimerRef.current !== null) return;

    throttleTimerRef.current = setTimeout(() => {
      throttleTimerRef.current = null;

      const el = scrollRef.current;
      if (!el) return;

      const { scrollTop, scrollHeight, clientHeight } = el;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const atBottom = distanceFromBottom <= bottomThreshold;

      // Direction detection
      const direction = scrollTop < lastScrollTopRef.current ? 'up' : 'down';
      lastScrollTopRef.current = scrollTop;

      setIsAtBottom(atBottom);

      if (atBottom) {
        // Re-engage keep-bottom when user scrolls back to bottom
        isKeepBottomRef.current = true;
        setIsKeepBottom(true);
        setHasNewContent(false);
      } else if (direction === 'up') {
        // User scrolled up – disengage keep-bottom
        isKeepBottomRef.current = false;
        setIsKeepBottom(false);
      }
    }, throttleMs);
  }, [bottomThreshold, throttleMs]);

  // Attach scroll listener
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (throttleTimerRef.current !== null) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, [handleScroll]);

  // ---- Streaming update: scroll if keep-bottom active ----
  const onStreamingUpdate = useCallback(() => {
    if (!isKeepBottomRef.current) {
      setHasNewContent(true);
      return;
    }

    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // ---- Manual scroll to bottom ----
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    isKeepBottomRef.current = true;
    setIsKeepBottom(true);
    setHasNewContent(false);
  }, []);

  return {
    scrollRef,
    isAtBottom,
    isKeepBottom,
    hasNewContent,
    scrollToBottom,
    onStreamingUpdate,
  };
}
