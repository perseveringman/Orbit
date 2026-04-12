// ── Content State Machine ──────────────────────────────────
import type { ContentItemStatus, IsoDateTimeString } from '@orbit/domain';

// Happy-path states
export type ContentState = Extract<
  ContentItemStatus,
  'discovered' | 'saved' | 'queued' | 'fetching' | 'fetched' |
  'normalizing' | 'normalized' | 'extracting' | 'extracted' |
  'transcribing' | 'transcribed' | 'translating' | 'translated' |
  'ready_to_read' | 'archived'
>;

// Error states
export type ContentErrorState = Extract<
  ContentItemStatus,
  'fetch_failed' | 'extract_failed' | 'transcribe_failed' | 'translate_failed' | 'quarantined'
>;

export type AnyContentState = ContentState | ContentErrorState;

// ── Transition record ──────────────────────────────────────

export interface ContentTransition {
  readonly from: AnyContentState;
  readonly to: AnyContentState;
  readonly trigger: string;
  readonly timestamp: IsoDateTimeString;
}

// ── Allowed transitions map ────────────────────────────────

const ALLOWED_TRANSITIONS: ReadonlyMap<AnyContentState, readonly AnyContentState[]> = new Map<AnyContentState, readonly AnyContentState[]>([
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
  // Error-state retry transitions
  ['fetch_failed', ['queued', 'quarantined']],
  ['extract_failed', ['fetched', 'quarantined']],
  ['transcribe_failed', ['extracted', 'quarantined']],
  ['translate_failed', ['transcribed', 'quarantined']],
  ['quarantined', ['discovered']],
]);

export function canTransition(current: AnyContentState, target: AnyContentState): boolean {
  const allowed = ALLOWED_TRANSITIONS.get(current);
  return allowed !== undefined && allowed.includes(target);
}

export function getValidTransitions(current: AnyContentState): readonly AnyContentState[] {
  return ALLOWED_TRANSITIONS.get(current) ?? [];
}

export interface TransitionResult {
  readonly newStatus: AnyContentState;
  readonly transition: ContentTransition;
}

export function transition(
  currentStatus: AnyContentState,
  targetState: AnyContentState,
  trigger: string,
): TransitionResult {
  if (!canTransition(currentStatus, targetState)) {
    throw new Error(
      `Invalid transition from '${currentStatus}' to '${targetState}'`,
    );
  }
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    newStatus: targetState,
    transition: {
      from: currentStatus,
      to: targetState,
      trigger,
      timestamp: now,
    },
  };
}
