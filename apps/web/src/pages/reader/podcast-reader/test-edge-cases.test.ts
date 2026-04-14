import { describe, expect, it } from 'vitest';
import {
  annotatePodcastTimestampLines,
  extractTimestampSecondsFromLine,
} from './podcast-timestamps';

describe('edge cases for timestamp parsing', () => {
  it('handles empty or whitespace-only elements correctly', () => {
    const html = '<p>   </p><p>00:30 Content</p>';
    const annotated = annotatePodcastTimestampLines(html);
    const doc = new DOMParser().parseFromString(annotated, 'text/html');
    const blocks = doc.querySelectorAll('[data-podcast-ts]');
    
    expect(blocks).toHaveLength(1);
    expect(blocks[0].textContent?.trim()).toBe('Content');
  });

  it('strips timestamp from first non-empty text node in nested structure', () => {
    const html = '<p><span></span>00:30 Content</p>';
    const annotated = annotatePodcastTimestampLines(html);
    const doc = new DOMParser().parseFromString(annotated, 'text/html');
    const p = doc.querySelector('p');
    
    expect(p?.textContent?.trim()).toBe('Content');
  });

  it('handles nested elements with timestamp in inner element', () => {
    const html = '<p><strong>00:30 Nested</strong></p>';
    const annotated = annotatePodcastTimestampLines(html);
    const doc = new DOMParser().parseFromString(annotated, 'text/html');
    const p = doc.querySelector('p');
    
    // The timestamp should be found and annotated
    expect(p?.hasAttribute('data-podcast-ts')).toBe(true);
    expect(p?.textContent?.trim()).toBe('Nested');
  });

  it('rejects timestamps with single-digit seconds', () => {
    expect(extractTimestampSecondsFromLine('1:5 Content')).toBeNull();
    expect(extractTimestampSecondsFromLine('12:3 Content')).toBeNull();
  });

  it('rejects timestamps with single-digit parts in HH:MM:SS format', () => {
    expect(extractTimestampSecondsFromLine('1:2:3 Content')).toBeNull();
    expect(extractTimestampSecondsFromLine('1:02:3 Content')).toBeNull();
  });

  it('accepts timestamps with large minute values', () => {
    // This is valid - podcasts can be very long
    expect(extractTimestampSecondsFromLine('999:59 Content')).toBe(59999);
  });

  it('rejects timestamps with seconds >= 60', () => {
    expect(extractTimestampSecondsFromLine('1:60 Content')).toBeNull();
    expect(extractTimestampSecondsFromLine('00:60 Content')).toBeNull();
  });

  it('rejects timestamps with minutes >= 60 in HH:MM:SS format', () => {
    expect(extractTimestampSecondsFromLine('1:60:00 Content')).toBeNull();
  });
});
