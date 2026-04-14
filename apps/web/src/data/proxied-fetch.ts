import type { FetchFn, FetchPageOptions } from '@orbit/reader-resolvers';

export const proxiedFetch: FetchFn = (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
  return globalThis.fetch(proxyUrl, init);
};

export const readerFetchOptions: FetchPageOptions = {
  fetchFn: proxiedFetch,
};
