const CHANNEL_NAME = "Antigravity_Fetch_Proxy";
const DEFAULT_TIMEOUT_MS = 10000;
const PROXY_PING = "PROXY_PING";
const PROXY_PONG = "PROXY_PONG";

const isProxyHost = (locationHref) => {
  try {
    const pathname = new URL(locationHref).pathname.toLowerCase();
    return pathname.endsWith("/workbench-jetski-agent.html")
      || pathname.endsWith("/launchpad-bridge.html");
  } catch {
    const pathname = locationHref.toLowerCase();
    return pathname.endsWith("/workbench-jetski-agent.html")
      || pathname.endsWith("/launchpad-bridge.html");
  }
};

export const shouldUseLaunchpadProxy = ({ protocol, title }) =>
  protocol === "vscode-file:" && !title.includes("Launchpad");

const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

export const fetchWithProxyFallback = async ({
  url,
  options,
  directFetch = globalThis.fetch,
  proxyFetch = broadcastFetch,
  useProxyFallback = shouldUseLaunchpadProxy({
    protocol: globalThis.location?.protocol || "",
    title: globalThis.document?.title || "",
  }),
}) => {
  try {
    return await directFetch(url, options);
  } catch (directError) {
    if (!useProxyFallback) throw directError;
    try {
      return await proxyFetch(url, options);
    } catch (proxyError) {
      throw new Error(
        `${getErrorMessage(directError)}; ${getErrorMessage(proxyError)}`,
      );
    }
  }
};

const handleFetchRequest = async (channel, data, fetchImpl) => {
  try {
    const response = await fetchImpl(data.url, data.options);
    const body = await response.json().catch(() => ({}));
    channel.postMessage({
      id: data.id,
      type: "FETCH_RESPONSE",
      ok: response.ok,
      status: response.status,
      data: body,
    });
  } catch (error) {
    channel.postMessage({
      id: data.id,
      type: "FETCH_RESPONSE",
      error: getErrorMessage(error),
    });
  }
};

const probeRequest = (channel, timeoutMs) =>
  new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const handler = (event) => {
      if (event.data?.id !== id || event.data.type !== PROXY_PONG) return;
      clearTimeout(timeout);
      channel.removeEventListener("message", handler);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      channel.removeEventListener("message", handler);
      resolve(false);
    }, timeoutMs);

    channel.addEventListener("message", handler);
    channel.postMessage({ id, type: PROXY_PING });
  });

export const createProxyTransport = ({
  channelFactory = globalThis.BroadcastChannel,
  fetchImpl = globalThis.fetch,
  locationHref = globalThis.location?.href || "",
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
  if (typeof channelFactory !== "function") {
    throw new Error("BroadcastChannel is unavailable");
  }

  const channel = new channelFactory(CHANNEL_NAME);
  if (isProxyHost(locationHref)) {
    channel.addEventListener("message", (event) => {
      const data = event.data || {};
      if (data.type === PROXY_PING) {
        channel.postMessage({ id: data.id, type: PROXY_PONG });
      } else if (data.type === "FETCH_REQUEST") {
        void handleFetchRequest(channel, data, fetchImpl);
      }
    });
  }

  const broadcastFetch = (url, options, requestTimeoutMs = timeoutMs) =>
    new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);
      const handler = (event) => {
        const data = event.data;
        if (!data || data.id !== id || data.type !== "FETCH_RESPONSE") return;

        clearTimeout(timeout);
        channel.removeEventListener("message", handler);
        if (data.error) {
          reject(new Error(data.error));
          return;
        }

        resolve({
          ok: data.ok,
          status: data.status,
          json: async () => data.data,
        });
      };
      const effectiveTimeoutMs = Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0
        ? requestTimeoutMs
        : timeoutMs;
      const timeout = setTimeout(() => {
        channel.removeEventListener("message", handler);
        reject(new Error("Proxy Fetch Timeout (Is Launchpad open?)"));
      }, effectiveTimeoutMs);

      channel.addEventListener("message", handler);
      channel.postMessage({ id, type: "FETCH_REQUEST", url, options });
    });

  return {
    broadcastFetch,
    probeLaunchpad: (probeTimeoutMs = 500) => probeRequest(channel, probeTimeoutMs),
    close: () => channel.close?.(),
  };
};

const defaultTransport =
  typeof window !== "undefined" && typeof globalThis.BroadcastChannel === "function"
    ? createProxyTransport()
    : null;

export const broadcastFetch = defaultTransport?.broadcastFetch || (() => {
  throw new Error("BroadcastChannel is unavailable");
});

export const probeLaunchpad =
  defaultTransport?.probeLaunchpad || (async () => false);
