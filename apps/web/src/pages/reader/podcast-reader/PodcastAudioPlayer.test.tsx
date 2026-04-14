import { describe, it, expect, vi } from 'vitest';
import { PodcastAudioPlayer } from './PodcastAudioPlayer';

describe('PodcastAudioPlayer', () => {
  it('exports a valid component', () => {
    expect(PodcastAudioPlayer).toBeDefined();
    expect(typeof PodcastAudioPlayer).toBe('function');
  });

  it('accepts required props without crashing', () => {
    const onTimeUpdate = vi.fn();
    const onRateChange = vi.fn();
    expect(() => {
      PodcastAudioPlayer({
        audioUrl: 'https://example.com/audio.mp3',
        currentTime: 0,
        duration: 5025,
        onTimeUpdate,
        onRateChange,
      });
    }).not.toThrow();
  });
});
