import { apiRequest, getToken } from "./api.js";

const DEFAULT_TTL_MS = 60_000;
const cache = new Map();

function makeKey(path) {
  return `${getToken() ?? "anonymous"} ${path}`;
}

export async function cachedApiRequest(path, options = {}) {
  const { ttlMs = DEFAULT_TTL_MS, force = false } = options;
  const key = makeKey(path);
  const now = Date.now();
  const hit = cache.get(key);

  if (!force && hit && hit.expiresAt > now) {
    return hit.promise;
  }

  const promise = apiRequest(path);
  cache.set(key, {
    path,
    promise,
    expiresAt: now + ttlMs,
  });

  try {
    return await promise;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

export function invalidateApiCache(prefixes = []) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];

  if (list.length === 0) {
    cache.clear();
    return;
  }

  for (const [key, entry] of cache.entries()) {
    if (list.some((prefix) => entry.path.startsWith(prefix))) {
      cache.delete(key);
    }
  }
}

export function invalidatePoolDataCache() {
  invalidateApiCache(["/players", "/matches", "/leaderboard"]);
}
