import assert from "node:assert/strict";
import test from "node:test";
import {
  createProxyTransport,
  fetchWithProxyFallback,
  probeLaunchpad,
  shouldUseLaunchpadProxy,
} from "../patches/shared/launchpad-proxy.js";
import {
  createBridgeCache,
  requestPromptApi,
} from "../patches/shared/request-engine.js";

class FakeBroadcastChannel {
  static channels = new Map();

  constructor(name) {
    this.name = name;
    this.listeners = new Set();
    const channels = FakeBroadcastChannel.channels.get(name) || new Set();
    channels.add(this);
    FakeBroadcastChannel.channels.set(name, channels);
  }

  addEventListener(type, listener) {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type, listener) {
    if (type === "message") this.listeners.delete(listener);
  }

  postMessage(data) {
    const channels = FakeBroadcastChannel.channels.get(this.name) || [];
    queueMicrotask(() => {
      for (const channel of channels) {
        for (const listener of channel.listeners) {
          listener({ data });
        }
      }
    });
  }

  close() {
    FakeBroadcastChannel.channels.get(this.name)?.delete(this);
    this.listeners.clear();
  }
}

const createTransport = (options = {}) =>
  createProxyTransport({
    channelFactory: FakeBroadcastChannel,
    timeoutMs: 20,
    ...options,
  });

test("uses the Launchpad proxy for vscode-file sidebar requests", () => {
  assert.equal(
    shouldUseLaunchpadProxy({ protocol: "vscode-file:", title: "Antigravity" }),
    true,
  );
  assert.equal(
    shouldUseLaunchpadProxy({ protocol: "vscode-file:", title: "Launchpad" }),
    false,
  );
  assert.equal(
    shouldUseLaunchpadProxy({ protocol: "https:", title: "Antigravity" }),
    false,
  );
});

test("uses direct fetch without requiring Launchpad", async () => {
  const response = await fetchWithProxyFallback({
    url: "https://api.example.test/chat",
    options: {},
    useProxyFallback: true,
    directFetch: async () => ({ ok: true, status: 200 }),
    proxyFetch: async () => {
      throw new Error("Launchpad should not be called");
    },
  });

  assert.equal(response.status, 200);
});

test("falls back to Launchpad only after direct fetch fails", async () => {
  const response = await fetchWithProxyFallback({
    url: "https://api.example.test/chat",
    options: {},
    useProxyFallback: true,
    directFetch: async () => {
      throw new Error("CORS blocked");
    },
    proxyFetch: async () => ({ ok: true, status: 200 }),
  });

  assert.equal(response.status, 200);
});

test("detects an available Launchpad bridge before sending the API request", async () => {
  const responder = createTransport({
    locationHref: "vscode-file://vscode-app/workbench-jetski-agent.html",
  });
  const requester = createTransport({ locationHref: "vscode-file://vscode-app/workbench.html" });

  assert.equal(await requester.probeLaunchpad(20), true);

  responder.close();
  requester.close();
});

test("accepts the hidden Launchpad bridge page as a proxy responder", async () => {
  const responder = createTransport({
    locationHref: "vscode-file://vscode-app/launchpad-bridge.html",
  });
  const requester = createTransport({ locationHref: "vscode-file://vscode-app/workbench.html" });

  assert.equal(await requester.probeLaunchpad(20), true);

  responder.close();
  requester.close();
});

test("reports Launchpad as unavailable without waiting for the API timeout", async () => {
  const requester = createTransport({ locationHref: "vscode-file://vscode-app/workbench.html" });

  assert.equal(await requester.probeLaunchpad(5), false);

  requester.close();
});

test("uses the responsive Launchpad bridge before starting a slow direct engine", async () => {
  let directCalls = 0;

  const response = await requestPromptApi({
    url: "https://api.example.test/chat",
    method: "POST",
    headers: {},
    body: "{}",
    runtime: { protocol: "vscode-file:", title: "Antigravity" },
    probe: async () => true,
    proxyRequest: async () => ({ ok: true, status: 200 }),
    directRequest: async () => {
      directCalls += 1;
      throw new Error("direct should not run");
    },
    bridgeCache: createBridgeCache(),
  });

  assert.equal(response.status, 200);
  assert.equal(directCalls, 0);
});

test("creates a bridge before falling back to direct fetch", async () => {
  let ensureCalls = 0;
  let directCalls = 0;

  const response = await requestPromptApi({
    url: "https://api.example.test/chat",
    method: "POST",
    headers: {},
    body: "{}",
    runtime: { protocol: "vscode-file:", title: "Antigravity", href: "vscode-file://vscode-app/workbench.html" },
    probe: async () => false,
    ensureBridge: async () => {
      ensureCalls += 1;
      return true;
    },
    proxyRequest: async () => ({ ok: true, status: 200 }),
    directRequest: async () => {
      directCalls += 1;
      throw new Error("direct should not run");
    },
    bridgeCache: createBridgeCache(),
  });

  assert.equal(response.status, 200);
  assert.equal(ensureCalls, 1);
  assert.equal(directCalls, 0);
});

test("auto-loads a hidden bridge page when the probe is initially offline", async () => {
  const previousDocument = globalThis.document;
  const frames = [];
  const probes = [false, true];
  globalThis.document = {
    querySelector: () => null,
    createElement: () => ({
      style: {},
      setAttribute: () => {},
      addEventListener: (type, listener) => {
        if (type === "load") queueMicrotask(listener);
      },
      remove: () => {},
    }),
    body: {
      appendChild: (frame) => frames.push(frame),
    },
  };

  try {
    const response = await requestPromptApi({
      url: "https://api.example.test/chat",
      method: "POST",
      headers: {},
      body: "{}",
      runtime: {
        protocol: "vscode-file:",
        title: "Antigravity",
        href: "vscode-file://vscode-app/workbench.html",
      },
      probe: async () => probes.shift(),
      proxyRequest: async () => ({ ok: true, status: 200 }),
      directRequest: async () => {
        throw new Error("direct should not run");
      },
      bridgeCache: createBridgeCache(),
    });

    assert.equal(response.status, 200);
    assert.equal(frames.length, 1);
    assert.match(frames[0].src, /launchpad-bridge\.html$/);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test("does not append a slow CORS fallback after a proxy failure", async () => {
  let directCalls = 0;

  await assert.rejects(
    requestPromptApi({
      url: "https://api.example.test/chat",
      method: "POST",
      headers: {},
      body: "{}",
      timeoutMs: 15000,
      runtime: { protocol: "vscode-file:", title: "Antigravity" },
      probe: async () => true,
      proxyRequest: async () => {
        throw new Error("Proxy Fetch Timeout");
      },
      directRequest: async () => {
        directCalls += 1;
        throw new Error("CORS fallback");
      },
      bridgeCache: createBridgeCache(),
    }),
    /Proxy Fetch Timeout/,
  );

  assert.equal(directCalls, 0);
});

test("passes the prompt timeout to the proxy transport", async () => {
  let receivedTimeout;

  await requestPromptApi({
    url: "https://api.example.test/chat",
    method: "POST",
    headers: {},
    body: "{}",
    timeoutMs: 2345,
    runtime: { protocol: "vscode-file:", title: "Antigravity" },
    probe: async () => true,
    proxyRequest: async (...args) => {
      receivedTimeout = args[2];
      return { ok: true, status: 200 };
    },
    directRequest: async () => {
      throw new Error("direct should not run");
    },
    bridgeCache: createBridgeCache(),
  });

  assert.equal(receivedTimeout, 2345);
});

test("caches Launchpad availability so repeated clicks do not wait on probing", async () => {
  const bridgeCache = createBridgeCache();
  let probeCalls = 0;

  const request = () => requestPromptApi({
    url: "https://api.example.test/chat",
    method: "POST",
    headers: {},
    body: "{}",
    runtime: { protocol: "vscode-file:", title: "Antigravity" },
    probe: async () => {
      probeCalls += 1;
      return true;
    },
    proxyRequest: async () => ({ ok: true, status: 200 }),
    directRequest: async () => {
      throw new Error("direct should not run");
    },
    bridgeCache,
  });

  await request();
  await request();

  assert.equal(probeCalls, 1);
});

test("uses direct engine when Launchpad is unavailable", async () => {
  const response = await requestPromptApi({
    url: "https://api.example.test/chat",
    method: "POST",
    headers: {},
    body: "{}",
    runtime: { protocol: "vscode-file:", title: "Antigravity" },
    probe: async () => false,
    directRequest: async () => ({ ok: true, status: 200 }),
    bridgeCache: createBridgeCache(),
  });

  assert.equal(response.status, 200);
});

test("retries through Launchpad if it appears after a direct failure", async () => {
  const probes = [false, true];
  const response = await requestPromptApi({
    url: "https://api.example.test/chat",
    method: "POST",
    headers: {},
    body: "{}",
    runtime: { protocol: "vscode-file:", title: "Antigravity" },
    probe: async () => probes.shift(),
    directRequest: async () => {
      throw new Error("CORS blocked");
    },
    proxyRequest: async () => ({ ok: true, status: 200 }),
    bridgeCache: createBridgeCache(),
  });

  assert.equal(response.status, 200);
});

test("routes a proxy response back to the matching request", async () => {
  const responder = createTransport({
    locationHref: "vscode-file://vscode-app/workbench-jetski-agent.html",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "enhanced" } }] }),
    }),
  });
  const requester = createTransport({ locationHref: "vscode-file://vscode-app/workbench.html" });

  const response = await requester.broadcastFetch("https://api.example.test/chat", {
    method: "POST",
  });

  assert.equal(response.ok, true);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    choices: [{ message: { content: "enhanced" } }],
  });
  responder.close();
  requester.close();
});

test("returns the Launchpad fetch error to the requester", async () => {
  const responder = createTransport({
    locationHref: "vscode-file://vscode-app/workbench-jetski-agent.html",
    fetchImpl: async () => {
      throw new Error("upstream unavailable");
    },
  });
  const requester = createTransport({ locationHref: "vscode-file://vscode-app/workbench.html" });

  await assert.rejects(
    requester.broadcastFetch("https://api.example.test/chat", {}),
    /upstream unavailable/,
  );
  responder.close();
  requester.close();
});

test("times out when Launchpad has no proxy responder", async () => {
  const requester = createTransport({ locationHref: "vscode-file://vscode-app/workbench.html" });

  await assert.rejects(
    requester.broadcastFetch("https://api.example.test/chat", {}),
    /Proxy Fetch Timeout/,
  );
  requester.close();
});
