// ---------------------------------------------------------------------------
// useContainerResize.ts – ResizeObserver with throttle + RAF batching
// ---------------------------------------------------------------------------
// Efficiently tracks height changes in a scrollable container during streaming.
// Uses a 500ms throttle and requestAnimationFrame batching to avoid layout
// thrashing. Changes smaller than 1px are ignored.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UseContainerResizeOptions {
  /** Throttle interval for resize observations (ms). @default 500 */
  readonly throttleMs?: number;
  /** Minimum height change to trigger an update (px). @default 1 */
  readonly minDelta?: number;
}

export interface UseContainerResizeReturn {
  /** Attach this ref to the element being observed. */
  readonly resizeRef: React.RefObject<HTMLDivElement>;
  /** Current observed height. */
  readonly height: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_THROTTLE = 500;
const DEFAULT_MIN_DELTA = 1;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useContainerResize(
  options: UseContainerResizeOptions = {},
): UseContainerResizeReturn {
  const { throttleMs = DEFAULT_THROTTLE, minDelta = DEFAULT_MIN_DELTA } = options;

  const resizeRef = useRef<HTMLDivElement>(null!);
  const [height, setHeight] = useState(0);
  const heightRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);

  const handleResize = useCallback(
    (entries: ResizeObserverEntry[]) => {
      const entry = entries[0];
      if (!entry) return;

      const newHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;

      // Ignore sub-pixel jitter
      if (Math.abs(newHeight - heightRef.current) < minDelta) return;

      const now = Date.now();
      if (now - lastUpdateRef.current < throttleMs) return;

      heightRef.current = newHeight;
      lastUpdateRef.current = now;

      // Cancel pending RAF to avoid stale updates
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        setHeight(heightRef.current);
        rafIdRef.current = null;
      });
    },
    [throttleMs, minDelta],
  );

  useEffect(() => {
    const el = resizeRef.current;
    if (!el) return;

    const observer = new ResizeObserver(handleResize);
    observer.observe(el, { box: 'border-box' });

    return () => {
      observer.disconnect();
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [handleResize]);

  return { resizeRef, height };
}
