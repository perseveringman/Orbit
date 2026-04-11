import { useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseConversationHistoryReturn {
  readonly history: readonly string[];
  readonly push: (message: string) => void;
  readonly navigateUp: () => string | undefined;
  readonly navigateDown: () => string | undefined;
  readonly resetNavigation: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const MAX_HISTORY = 100;

export function useConversationHistory(): UseConversationHistoryReturn {
  const historyRef = useRef<string[]>([]);
  // Index points *past* the end when navigation is inactive.
  const indexRef = useRef<number>(0);

  const push = useCallback((message: string) => {
    const h = historyRef.current;
    h.push(message);

    // Drop oldest when exceeding the cap.
    if (h.length > MAX_HISTORY) {
      h.splice(0, h.length - MAX_HISTORY);
    }

    // Reset navigation to past-end.
    indexRef.current = h.length;
  }, []);

  const navigateUp = useCallback((): string | undefined => {
    if (indexRef.current <= 0) return undefined;
    indexRef.current -= 1;
    return historyRef.current[indexRef.current];
  }, []);

  const navigateDown = useCallback((): string | undefined => {
    const h = historyRef.current;
    if (indexRef.current >= h.length) return undefined;
    indexRef.current += 1;
    return h[indexRef.current]; // undefined when index === h.length (past end)
  }, []);

  const resetNavigation = useCallback(() => {
    indexRef.current = historyRef.current.length;
  }, []);

  return {
    history: historyRef.current,
    push,
    navigateUp,
    navigateDown,
    resetNavigation,
  };
}
