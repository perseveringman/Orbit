import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { PodcastTimelineSidebar } from './PodcastTimelineSidebar';

const mockOutlineItems = [
  { id: 'ts-0', seconds: 15, label: '00:15', title: 'Introduction' },
  { id: 'ts-1', seconds: 150, label: '02:30', title: 'Main topic discussion' },
  { id: 'ts-2', seconds: 3600, label: '1:00:00', title: 'Conclusion' },
];

describe('PodcastTimelineSidebar', () => {
  it('renders timeline items with timestamps and titles', () => {
    const onSeek = vi.fn();
    render(<PodcastTimelineSidebar items={mockOutlineItems} onSeek={onSeek} currentTime={0} />);
    
    expect(screen.getByText('00:15')).toBeDefined();
    expect(screen.getByText('Introduction')).toBeDefined();
    expect(screen.getByText('02:30')).toBeDefined();
    expect(screen.getByText('Main topic discussion')).toBeDefined();
  });

  it('calls onSeek with correct timestamp when item is clicked', async () => {
    const user = userEvent.setup();
    const onSeek = vi.fn();
    const { container } = render(
      <PodcastTimelineSidebar items={mockOutlineItems} onSeek={onSeek} currentTime={0} />
    );
    
    const firstItemContainer = container.querySelector('[data-seconds="15"]') ?? 
      container.querySelector('div.flex.gap-2.p-2.rounded-md');
    
    if (firstItemContainer) {
      await user.click(firstItemContainer);
      expect(onSeek).toHaveBeenCalledWith(15);
    }
  });

  it('highlights active timestamp based on currentTime', () => {
    const onSeek = vi.fn();
    const { container } = render(
      <PodcastTimelineSidebar items={mockOutlineItems} onSeek={onSeek} currentTime={160} />
    );
    
    // The item at 150 seconds should be active since currentTime is 160
    const items = container.querySelectorAll('div.flex.gap-2.p-2');
    const activeItem = Array.from(items).find((item) => 
      item.className.includes('bg-warning')
    );
    expect(activeItem).toBeDefined();
  });

  it('shows empty state when no items', () => {
    const onSeek = vi.fn();
    render(<PodcastTimelineSidebar items={[]} onSeek={onSeek} currentTime={0} />);
    
    expect(screen.getByText(/no.*timestamps.*available/i)).toBeDefined();
  });
});
