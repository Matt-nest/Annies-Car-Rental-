/**
 * queryCache — lightweight request deduplication + 30-second TTL cache.
 *
 * Rules:
 *  1. Same key requested within TTL → returns the cached resolved value immediately.
 *  2. Same key requested while a fetch is in-flight → returns the same Promise (no duplicate request).
 *  3. Failed fetches evict the entry so the next call retries fresh.
 *  4. invalidateCache(key?) clears one key or the whole cache.
 */

const _cache = new Map(); // key → { promise, data, resolvedAt }

const DEFAULT_TTL = 30_000; // 30 seconds

export function cachedQuery(key, fetcher, ttl = DEFAULT_TTL) {
  const now = Date.now();
  const entry = _cache.get(key);

  // 1. Cache hit within TTL — return resolved value
  if (entry && entry.data !== undefined && (now - entry.resolvedAt) < ttl) {
    return Promise.resolve(entry.data);
  }

  // 2. In-flight dedup — return the existing promise
  if (entry && entry.promise) {
    return entry.promise;
  }

  // 3. New fetch
  const promise = fetcher()
    .then((data) => {
      // Only update if this promise is still the current one (avoids stale writes)
      const current = _cache.get(key);
      if (current && current.promise === promise) {
        _cache.set(key, { promise: null, data, resolvedAt: Date.now() });
      }
      return data;
    })
    .catch((err) => {
      // Evict on failure so the next call retries
      const current = _cache.get(key);
      if (current && current.promise === promise) {
        _cache.delete(key);
      }
      throw err;
    });

  // Preserve stale data while re-fetching so widgets don't flash empty
  _cache.set(key, {
    promise,
    data: entry?.data,
    resolvedAt: entry?.resolvedAt ?? 0,
  });

  return promise;
}

/** Invalidate a single key or the entire cache. */
export function invalidateCache(key) {
  if (key !== undefined) {
    _cache.delete(key);
  } else {
    _cache.clear();
  }
}
