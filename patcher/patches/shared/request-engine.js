import {
  broadcastFetch,
  probeLaunchpad,
  shouldUseLaunchpadProxy,
} from "./launchpad-proxy.js";

const getRuntime = () => ({
  protocol: globalThis.location?.protocol || "",
  title: globalThis.document?.title || "",
});

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
}) => {
  const useProxy = shouldUseLaunchpadProxy(runtime);
  const request = { url, method, headers, body, timeoutMs };

  if (useProxy && await probe(350)) {
    try {
      return await proxyRequest(url, { method, headers, body });
    } catch (error) {
      console.warn("[PromptEnhance] Launchpad 请求失败，回退直连:", error);
    }
  }

  try {
    return await directRequest(request);
  } catch (directError) {
    if (useProxy && await probe(350)) {
      return proxyRequest(url, { method, headers, body });
    }
    throw directError;
  }
};
