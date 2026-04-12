import type { ResolverResult } from './types.js';

const NEWSLETTER_HOSTS: readonly RegExp[] = [
  /(?:^|\.)substack\.com$/i,
  /(?:^|\.)beehiiv\.com$/i,
  /(?:^|\.)buttondown\.email$/i,
  /(?:^|\.)getrevue\.co$/i,
  /(?:^|\.)revue\.email$/i,
];

export function isNewsletterUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Check known newsletter platforms
    if (NEWSLETTER_HOSTS.some((re) => re.test(parsed.hostname))) return true;
    // Ghost newsletters: check for /subscribe or /newsletter paths
    if (/\/(?:subscribe|newsletter)(?:\/|$)/i.test(parsed.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

function detectPlatform(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('substack.com')) return 'substack';
    if (host.includes('beehiiv.com')) return 'beehiiv';
    if (host.includes('buttondown.email')) return 'buttondown';
    if (host.includes('getrevue.co') || host.includes('revue.email')) return 'revue';
    return 'ghost';
  } catch {
    return 'unknown';
  }
}

export function resolveNewsletterUrl(url: string): ResolverResult {
  if (!isNewsletterUrl(url)) {
    return {
      ok: false,
      source: null,
      error: 'Not a newsletter URL',
      resolverUsed: 'newsletter',
    };
  }

  const platform = detectPlatform(url);

  return {
    ok: true,
    source: {
      kind: 'newsletter',
      feedUrl: null,
      title: `Newsletter (${platform})`,
      description: null,
      language: null,
      iconUrl: null,
      metadata: { platform, originalUrl: url },
    },
    error: null,
    resolverUsed: 'newsletter',
  };
}
