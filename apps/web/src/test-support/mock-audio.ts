import { vi } from 'vitest';

type MockAudioListener = (event: Event) => void;

function normalizeListener(listener: EventListenerOrEventListenerObject): MockAudioListener {
  if (typeof listener === 'function') {
    return listener;
  }

  return (event: Event) => {
    listener.handleEvent(event);
  };
}

export class MockAudio {
  static instances: MockAudio[] = [];

  src = '';
  playbackRate = 1;
  paused = true;

  private currentTimeValue = 0;
  private readonly listeners = new Map<string, Set<MockAudioListener>>();

  readonly currentTimeAssignments: number[] = [];
  readonly play = vi.fn(async () => {
    this.paused = false;
    this.emit('play');
  });
  readonly pause = vi.fn(() => {
    this.paused = true;
    this.emit('pause');
  });

  constructor(src?: string) {
    if (src) {
      this.src = src;
    }

    MockAudio.instances.push(this);
  }

  get currentTime(): number {
    return this.currentTimeValue;
  }

  set currentTime(value: number) {
    this.currentTimeValue = value;
    this.currentTimeAssignments.push(value);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized = normalizeListener(listener);
    const listeners = this.listeners.get(type) ?? new Set<MockAudioListener>();
    listeners.add(normalized);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized = normalizeListener(listener);
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }

    listeners.forEach((registered) => {
      if (registered === normalized) {
        listeners.delete(registered);
      }
    });

    if (listeners.size === 0) {
      this.listeners.delete(type);
    }
  }

  setPlaybackTime(value: number): void {
    this.currentTimeValue = value;
  }

  emit(type: string): void {
    const event = new Event(type);
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }

    Array.from(listeners).forEach((listener) => listener(event));
  }
}

export function installMockAudio(): void {
  vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio);
}

export function resetMockAudioInstances(): void {
  MockAudio.instances.length = 0;
}

export function getLatestMockAudio(): MockAudio | null {
  return MockAudio.instances.at(-1) ?? null;
}
