export const SEARCH_PROVIDERS = {
  youtube: "ytsearch",
  soundcloud: "scsearch",
};

export function buildSearchUrl(provider, query, limit) {
  const prefix = SEARCH_PROVIDERS[provider];
  if (!prefix) throw new Error(`Unsupported search provider: ${provider}`);
  const term = String(query).trim();
  const count = Number(limit);
  if (!term) throw new Error("Search query must not be empty");
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    throw new Error("Search limit must be an integer from 1 to 50");
  }
  return `${prefix}${count}:${term}`;
}

export function normalizeSearchResults(info = {}) {
  const results = (info.entries || []).filter(Boolean).map((entry) => ({
    id: entry.id || null,
    title: entry.title || null,
    url:
      entry.webpage_url ||
      entry.original_url ||
      entry.url ||
      (entry.ie_key && entry.id
        ? `${entry.ie_key.toLowerCase()}:${entry.id}`
        : null),
    duration_s: entry.duration ?? null,
    uploader: entry.uploader || entry.channel || null,
  }));
  return {
    extractor: info.extractor || null,
    count: results.length,
    results,
  };
}
