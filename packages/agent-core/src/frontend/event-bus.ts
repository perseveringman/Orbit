// ---------------------------------------------------------------------------
// @orbit/agent-core – Frontend Event Bus (M10)
// ---------------------------------------------------------------------------

import type { OrbitAgentEvent } from '../events.js';

// ---- Types ----

export type EventListener<T> = (event: T) => void;
export type Unsubscribe = () => void;

// ---- EventBus ----

export class EventBus {
  private readonly listeners = new Map<string, Set<EventListener<any>>>();
  private readonly allListeners = new Set<EventListener<OrbitAgentEvent>>();

  /**
   * Subscribe to a specific event type.
   */
  on<T extends OrbitAgentEvent>(
    type: T['type'],
    listener: EventListener<T>,
  ): Unsubscribe {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);

    return () => {
      set!.delete(listener);
      if (set!.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  /**
   * Subscribe to all events.
   */
  onAny(listener: EventListener<OrbitAgentEvent>): Unsubscribe {
    this.allListeners.add(listener);
    return () => {
      this.allListeners.delete(listener);
    };
  }

  /**
   * Subscribe to a specific event type, auto-unsubscribe after first call.
   */
  once<T extends OrbitAgentEvent>(
    type: T['type'],
    listener: EventListener<T>,
  ): Unsubscribe {
    const unsub = this.on<T>(type, (event) => {
      unsub();
      listener(event);
    });
    return unsub;
  }

  /**
   * Emit an event to all matching listeners.
   */
  emit(event: OrbitAgentEvent): void {
    const set = this.listeners.get(event.type);
    if (set) {
      for (const listener of set) {
        listener(event);
      }
    }

    for (const listener of this.allListeners) {
      listener(event);
    }
  }

  /**
   * Remove all listeners.
   */
  clear(): void {
    this.listeners.clear();
    this.allListeners.clear();
  }

  /**
   * Get listener count for a specific type, or total if no type given.
   */
  listenerCount(type?: string): number {
    if (type !== undefined) {
      return (this.listeners.get(type)?.size ?? 0);
    }

    let count = this.allListeners.size;
    for (const set of this.listeners.values()) {
      count += set.size;
    }
    return count;
  }
}
