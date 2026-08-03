import {
  broadcastFetch,
  probeLaunchpad,
  shouldUseLaunchpadProxy,
} from "./launchpad-proxy.js";

const PROBE_TIMEOUT_MS = 120;
const AVAILABLE_CACHE_TTL_MS = 10000;
const UNAVAILABLE_CACHE_TTL_MS = 500;
const BRIDGE_FRAME_TIMEOUT_MS = 800;
const DIRECT_FALLBACK_TIMEOUT_MS = 2500;
const BRIDGE_FRAME_SELECTOR = "[data-antigravity-power-proxy]";

const getRuntime = () => ({
  protocol: globalThis.location?.protocol || "",
  title: globalThis.document?.title || "",
  href: globalThis.location?.href || "",
});

export const createBridgeCache = () => ({
  available: false,
  checkedAt: 0,
  pending: null,
});

const defaultBridgeCache = createBridgeCache();
let bridgeFramePending = null;

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

const waitForBridgeFrame = (frame) => new Promise((resolve) => {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    resolve();
  };

  frame.addEventListener?.("load", finish, { once: true });
  frame.addEventListener?.("error", finish, { once: true });
  setTimeout(finish, BRIDGE_FRAME_TIMEOUT_MS);
});

const ensureLaunchpadBridge = async ({
  runtime,
  documentRef,
  probe,
  bridgeCache,
}) => {
  if (!documentRef?.createElement) return false;
  if (bridgeFramePending) return bridgeFramePending;

  bridgeFramePending = (async () => {
    const existing = documentRef.querySelector?.(BRIDGE_FRAME_SELECTOR);
    const frame = existing || documentRef.createElement("iframe");
    if (!existing) {
      const href = runtime.href || globalThis.location?.href;
      if (!href) return false;
      frame.setAttribute("data-antigravity-power-proxy", "");
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      frame.style.cssText = "display:none!important;width:0;height:0;border:0";
      frame.src = new URL("launchpad-bridge.html", href).href;
      (documentRef.body || documentRef.documentElement)?.appendChild(frame);
      await waitForBridgeFrame(frame);
    }
    const ready = await probeBridge(probe, bridgeCache, true);
    if (!ready && !existing) frame.remove?.();
    return ready;
  })().finally(() => {
    bridgeFramePending = null;
  });

  return bridgeFramePending;
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
  ensureBridge = ensureLaunchpadBridge,
}) => {
  const useProxy = shouldUseLaunchpadProxy(runtime);
  const request = { url, method, headers, body, timeoutMs };
  let bridgeReady = useProxy && await probeBridge(probe, bridgeCache);

  if (useProxy && !bridgeReady) {
    bridgeReady = await ensureBridge({
      runtime,
      documentRef: globalThis.document,
      probe,
      bridgeCache,
    });
  }

  if (bridgeReady) {
    try {
      return await proxyRequest(url, { method, headers, body }, timeoutMs);
    } catch (error) {
      bridgeCache.available = false;
      bridgeCache.checkedAt = Date.now();
      console.warn("[PromptEnhance] Launchpad 请求失败:", error);
      throw error;
    }
  }

  try {
    return await directRequest({
      ...request,
      timeoutMs: useProxy
        ? Math.min(timeoutMs || DIRECT_FALLBACK_TIMEOUT_MS, DIRECT_FALLBACK_TIMEOUT_MS)
        : timeoutMs,
    });
  } catch (directError) {
    if (useProxy && !bridgeReady && await probeBridge(probe, bridgeCache, true)) {
      return proxyRequest(url, { method, headers, body }, timeoutMs);
    }
    throw directError;
  }
};
