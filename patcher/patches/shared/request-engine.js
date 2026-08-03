import {
  broadcastFetch,
  probeLaunchpad,
  shouldUseLaunchpadProxy,
} from "./launchpad-proxy.js";

const PROBE_TIMEOUT_MS = 120;
const AVAILABLE_CACHE_TTL_MS = 10000;
const UNAVAILABLE_CACHE_TTL_MS = 500;

const getRuntime = () => ({
  protocol: globalThis.location?.protocol || "",
  title: globalThis.document?.title || "",
});

export const createBridgeCache = () => ({
  available: false,
  checkedAt: 0,
  pending: null,
});

const defaultBridgeCache = createBridgeCache();

const probeBridge = async (probe, bridgeCache, force = false) => {
  const now = Date.now();
  const ttl = bridgeCache.available
    ? AVAILABLE_CACHE_TTL_MS
    : UNAVAILABLE_CACHE_TTL_MS;

  if (!force && bridgeCache.checkedAt > 0 && now - bridgeCache.checkedAt < ttl) {
    return bridgeCache.available;
  }
  if (bridgeCache.pending) return bridgeCache.pending;

  bridgeCache.pending = Promise.resolve()
    .then(() => probe(PROBE_TIMEOUT_MS))
    .then((available) => {
      bridgeCache.available = Boolean(available);
      bridgeCache.checkedAt = Date.now();
      return bridgeCache.available;
    })
    .catch(() => {
      bridgeCache.available = false;
      bridgeCache.checkedAt = Date.now();
      return false;
    })
    .finally(() => {
      bridgeCache.pending = null;
    });

  return bridgeCache.pending;
};

export const requestPromptApi = async ({
  url,
  method,
  headers,
  body,
  timeoutMs,
  directRequest,
  probe = probeLaunchpad,
  proxyRequest = broadcastFetch,
  runtime = getRuntime(),
  bridgeCache = defaultBridgeCache,
}) => {
  const useProxy = shouldUseLaunchpadProxy(runtime);
  const request = { url, method, headers, body, timeoutMs };
  const bridgeReady = useProxy && await probeBridge(probe, bridgeCache);

  if (bridgeReady) {
    try {
      return await proxyRequest(url, { method, headers, body });
    } catch (error) {
      bridgeCache.available = false;
      bridgeCache.checkedAt = Date.now();
      console.warn("[PromptEnhance] Launchpad 请求失败，回退直连:", error);
    }
  }

  try {
    return await directRequest(request);
  } catch (directError) {
    if (useProxy && !bridgeReady && await probeBridge(probe, bridgeCache, true)) {
      return proxyRequest(url, { method, headers, body });
    }
    throw directError;
  }
};
