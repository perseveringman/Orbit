import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { PodcastAudioPlayer } from './PodcastAudioPlayer';
import { getLatestMockAudio } from '../../../test-support/mock-audio';

describe('PodcastAudioPlayer', () => {
  it('does not re-seek when parent echoes a playback update', () => {
    const onTimeUpdate = vi.fn();
    const onRateChange = vi.fn();
    const { rerender } = render(
      <PodcastAudioPlayer
        audioUrl="https://example.com/audio.mp3"
        currentTime={10}
        duration={120}
        onTimeUpdate={onTimeUpdate}
        onRateChange={onRateChange}
      />,
    );

    const audio = getLatestMockAudio();
    expect(audio?.currentTimeAssignments).toEqual([10]);

    audio?.setPlaybackTime(12);
    audio?.emit('timeupdate');
    expect(onTimeUpdate).toHaveBeenCalledWith(12);

    rerender(
      <PodcastAudioPlayer
        audioUrl="https://example.com/audio.mp3"
        currentTime={12}
        duration={120}
        onTimeUpdate={onTimeUpdate}
        onRateChange={onRateChange}
      />,
    );

    expect(audio?.currentTimeAssignments).toEqual([10]);
  });

  it('seeks the audio element when parent requests a new position', () => {
    const onTimeUpdate = vi.fn();
    const onRateChange = vi.fn();
    const { rerender } = render(
      <PodcastAudioPlayer
        audioUrl="https://example.com/audio.mp3"
        currentTime={10}
        duration={120}
        onTimeUpdate={onTimeUpdate}
        onRateChange={onRateChange}
      />,
    );

    const audio = getLatestMockAudio();
    audio?.setPlaybackTime(12);

    rerender(
      <PodcastAudioPlayer
        audioUrl="https://example.com/audio.mp3"
        currentTime={75}
        duration={120}
        onTimeUpdate={onTimeUpdate}
        onRateChange={onRateChange}
      />,
    );

    expect(audio?.currentTimeAssignments.at(-1)).toBe(75);
  });

  it('requests relative seeks from the transport controls', async () => {
    const user = userEvent.setup();
    const onTimeUpdate = vi.fn();
    const onRateChange = vi.fn();

    render(
      <PodcastAudioPlayer
        audioUrl="https://example.com/audio.mp3"
        currentTime={30}
        duration={120}
        onTimeUpdate={onTimeUpdate}
        onRateChange={onRateChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /skip forward 15 seconds/i }));
    expect(onTimeUpdate).toHaveBeenLastCalledWith(45);

    await user.click(screen.getByRole('button', { name: /skip back 15 seconds/i }));
    expect(onTimeUpdate).toHaveBeenLastCalledWith(15);
  });
});
