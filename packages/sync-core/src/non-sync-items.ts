export type NonSyncCategory = 'fts_index' | 'vector_index' | 'thumbnail' | 'cache' | 'temp';

export interface NonSyncItem {
  readonly category: NonSyncCategory;
  readonly pattern: string;
  readonly description: string;
  readonly rebuildable: boolean;
  readonly rebuildStrategy?: string;
}

export const NON_SYNC_ITEMS: readonly NonSyncItem[] = [
  {
    category: 'fts_index',
    pattern: '*.fts',
    description: 'Full-text search index',
    rebuildable: true,
    rebuildStrategy: 'reindex_all_objects',
  },
  {
    category: 'vector_index',
    pattern: '*.vec',
    description: 'Vector embeddings index',
    rebuildable: true,
    rebuildStrategy: 'recompute_embeddings',
  },
  {
    category: 'thumbnail',
    pattern: 'thumbnails/**',
    description: 'Image thumbnails',
    rebuildable: true,
    rebuildStrategy: 'regenerate_from_source',
  },
  {
    category: 'cache',
    pattern: '.cache/**',
    description: 'Local cache',
    rebuildable: true,
    rebuildStrategy: 'clear_and_refetch',
  },
  {
    category: 'temp',
    pattern: '.tmp/**',
    description: 'Temporary files',
    rebuildable: false,
  },
];

// ---- Minimal glob matcher (no external deps) --------------------------------

function globToRegex(pattern: string): RegExp {
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      regex += '.*';
      i += 2;
      if (pattern[i] === '/') i++; // consume trailing separator
    } else if (ch === '*') {
      regex += '[^/]*';
      i++;
    } else if (ch === '?') {
      regex += '[^/]';
      i++;
    } else if ('.+^${}()|[]\\'.includes(ch)) {
      regex += '\\' + ch;
      i++;
    } else {
      regex += ch;
      i++;
    }
  }
  return new RegExp(`^${regex}$`);
}

export function shouldSync(path: string): boolean {
  return !NON_SYNC_ITEMS.some((item) => globToRegex(item.pattern).test(path));
}

export function getRebuildStrategy(category: NonSyncCategory): string | null {
  const item = NON_SYNC_ITEMS.find((i) => i.category === category);
  return item?.rebuildStrategy ?? null;
}
