// ---------------------------------------------------------------------------
// useApprovalBridge – Bridges agent-core ApprovalManager to React callbacks
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal interface matching ApprovalManager's shape.
 * We depend on the shape rather than the class to keep the hook testable.
 */
export interface ApprovalManagerLike {
  readonly setCallback: (
    cb: (request: ApprovalRequestInfo) => Promise<ApprovalResponseInfo>,
  ) => void;
  readonly getPending: () => readonly ApprovalRequestInfo[];
}

export interface ApprovalRequestInfo {
  readonly id: string;
  readonly capabilityName: string;
  readonly reason: string;
  readonly args: Record<string, unknown>;
}

export interface ApprovalResponseInfo {
  readonly requestId: string;
  readonly approved: boolean;
  readonly respondedAt: number;
}

export interface UseApprovalBridgeReturn {
  readonly pendingApprovals: readonly ApprovalRequestInfo[];
  readonly approve: (requestId: string) => void;
  readonly reject: (requestId: string) => void;
}

/**
 * Wires an ApprovalManager into React state. When the manager emits a
 * pending approval, this hook surfaces it; `approve` / `reject` resolve the
 * corresponding promise.
 */
export function useApprovalBridge(
  manager: ApprovalManagerLike | undefined,
): UseApprovalBridgeReturn {
  const [pending, setPending] = useState<readonly ApprovalRequestInfo[]>([]);

  // Resolver map: requestId → resolve function
  const resolvers = useRef(
    new Map<string, (response: ApprovalResponseInfo) => void>(),
  );

  useEffect(() => {
    if (!manager) return;

    manager.setCallback(async (request) => {
      setPending((prev) => [...prev, request]);
      return new Promise<ApprovalResponseInfo>((resolve) => {
        resolvers.current.set(request.id, resolve);
      });
    });

    // Sync any already-pending approvals
    setPending(manager.getPending());
  }, [manager]);

  const resolve = useCallback(
    (requestId: string, approved: boolean) => {
      const resolver = resolvers.current.get(requestId);
      if (resolver) {
        resolver({
          requestId,
          approved,
          respondedAt: Date.now(),
        });
        resolvers.current.delete(requestId);
      }
      setPending((prev) => prev.filter((r) => r.id !== requestId));
    },
    [],
  );

  const approve = useCallback(
    (requestId: string) => resolve(requestId, true),
    [resolve],
  );

  const reject = useCallback(
    (requestId: string) => resolve(requestId, false),
    [resolve],
  );

  return { pendingApprovals: pending, approve, reject };
}
