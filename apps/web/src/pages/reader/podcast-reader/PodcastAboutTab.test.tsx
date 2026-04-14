import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { PodcastAboutTab } from './PodcastAboutTab';

describe('PodcastAboutTab', () => {
  it('renders show notes', () => {
    const onSeek = vi.fn();
    render(
      <PodcastAboutTab 
        showNotes="<p>Welcome to the show</p><p>Today we discuss testing</p>" 
        onSeek={onSeek}
      />
    );
    
    expect(screen.getByText(/Welcome to the show/i)).toBeDefined();
    expect(screen.getByText(/Today we discuss testing/i)).toBeDefined();
  });

  it('shows empty state when no show notes', () => {
    const onSeek = vi.fn();
    render(<PodcastAboutTab showNotes={null} onSeek={onSeek} />);
    
    expect(screen.getByText(/no show notes available/i)).toBeDefined();
  });

  it('calls onSeek when timestamp line is clicked', async () => {
    const user = userEvent.setup();
    const onSeek = vi.fn();
    const showNotes = '<p>[00:15] Introduction</p><p>[02:30] Main topic</p><p>Some other content</p>';
    
    const { container } = render(<PodcastAboutTab showNotes={showNotes} onSeek={onSeek} />);
    
    const timestampLines = container.querySelectorAll('.podcast-timestamp-line');
    expect(timestampLines.length).toBeGreaterThan(0);
    
    await user.click(timestampLines[0]);
    expect(onSeek).toHaveBeenCalledWith(15);
    
    await user.click(timestampLines[1]);
    expect(onSeek).toHaveBeenCalledWith(150);
  });

  it('does not call onSeek for non-timestamp content', async () => {
    const user = userEvent.setup();
    const onSeek = vi.fn();
    const showNotes = '<p>Regular paragraph without timestamp</p>';
    
    const { container } = render(<PodcastAboutTab showNotes={showNotes} onSeek={onSeek} />);
    
    const paragraph = container.querySelector('p');
    if (paragraph) {
      await user.click(paragraph);
      expect(onSeek).not.toHaveBeenCalled();
    }
  });
});
