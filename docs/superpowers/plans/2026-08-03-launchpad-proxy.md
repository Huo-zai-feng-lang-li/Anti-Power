# Launchpad Proxy Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make prompt enhancement work without Ctrl+E when the API permits CORS, while retaining Launchpad as a fallback for blocked direct requests.

**Architecture:** Try the API directly first. On a `vscode-file` sidebar fetch failure, fall back to the focused BroadcastChannel transport. `workbench-jetski-agent.html` loads the same module as the response endpoint, and Rust installation code owns idempotent HTML injection and cleanup.

**Tech Stack:** Vanilla JavaScript modules, Rust/Tauri installer, Node's built-in test runner, Cargo tests, Vite/Vue build.

## Global Constraints

- Preserve the existing `Antigravity_Fetch_Proxy` channel name and message schema.
- Do not change provider URLs, API keys, request bodies, or prompt enhancement output handling.
- Keep injection idempotent and remove only the project-owned marker block.
- Maintain compatibility with both Cascade and Manager shared-module consumers.
- Do not claim no-Launchpad support for APIs that reject the workbench origin through CORS.

---

### Task 1: Add transport regression tests

**Files:**
- Create: `patcher/tests/launchpad-proxy.test.js`
- Test: `patcher/tests/launchpad-proxy.test.js`

**Interfaces:**
- Consumes: `patcher/patches/shared/launchpad-proxy.js` module factory exports.
- Produces: Failing coverage for response routing, proxy errors, and timeout cleanup.

- [ ] **Step 1: Write the failing test**

Use Node's built-in test runner with a fake BroadcastChannel and fake timer boundary. Assert that a matching `FETCH_RESPONSE` resolves with `ok/status/json`, an error response rejects with its message, and no response rejects with the exact timeout error.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test patcher/tests/launchpad-proxy.test.js`
Expected: FAIL because `patcher/patches/shared/launchpad-proxy.js` does not exist.

### Task 2: Extract the proxy transport

**Files:**
- Create: `patcher/patches/shared/launchpad-proxy.js`
- Modify: `patcher/patches/shared/enhance.js:108-162`

**Interfaces:**
- Produces: `broadcastFetch(url, options)` with the existing response shape.
- Consumes: `globalThis.BroadcastChannel`, `location.href`, and the existing channel payload schema.

- [ ] **Step 1: Implement the minimal transport**

Export `broadcastFetch`, register a responder only when `location.href` contains `workbench-jetski-agent.html`, and keep request listeners scoped by generated request id. The responder must remove its channel after handling a request and post either `{ id, type, ok, status, data }` or `{ id, type, error }`.

- [ ] **Step 2: Run the focused test**

Run: `node --test patcher/tests/launchpad-proxy.test.js`
Expected: PASS.

- [ ] **Step 3: Replace the duplicated transport in enhance.js**

Import `broadcastFetch` from `./launchpad-proxy.js` and delete the old listener and function implementation. Keep all callers unchanged.

### Task 3: Inject the Launchpad bridge through the installer

**Files:**
- Modify: `patcher/patches/workbench-jetski-agent.html:19-22`
- Modify: `patcher/src-tauri/src/commands/patch.rs:144-179,386-428,431-554,608-660`
- Test: `patcher/src-tauri/src/commands/patch.rs` (unit tests)

**Interfaces:**
- Produces: `sync_launchpad_proxy(workbench_dir, enabled)` behavior through installation flow.
- Consumes: existing `FeatureConfig`, `ManagerFeatureConfig`, embedded `shared/launchpad-proxy.js`, and the project-owned HTML marker.

- [x] **Step 1: Write the failing Rust tests**

Test a helper that inserts one marked module script before `</head>`, returns unchanged content when run twice, removes only the marked block when disabled, and leaves unrelated HTML intact.

- [x] **Step 2: Run the Rust test to verify it fails**

Run: `cargo test --manifest-path patcher/src-tauri/Cargo.toml launchpad_proxy`
Expected: FAIL because the injection helper and marker do not exist.

- [x] **Step 3: Implement idempotent installation lifecycle**

Add a project-owned marker block for `./shared/launchpad-proxy.js`. Call the sync helper after feature state is known, enable it when either prompt-enhance config is enabled, and remove it when both are disabled. Keep existing backup restoration behavior intact.

- [x] **Step 4: Run the focused Rust test**

Run: `cargo test --manifest-path patcher/src-tauri/Cargo.toml launchpad_proxy`
Expected: PASS.

### Task 4: Full verification and runtime proof

**Files:**
- Modify: `.agent/plan-提示词增强代理.md`

- [x] **Step 1: Run JavaScript and Rust tests**

Run: `node --test patcher/tests/launchpad-proxy.test.js` and `cargo test --manifest-path patcher/src-tauri/Cargo.toml`.

- [x] **Step 2: Run the application build**

Run: `npm run build --prefix patcher`.

- [ ] **Step 3: Verify the installed bridge**

Reinstall the patcher output if needed, restart Antigravity with `D:\Antigravity\Antigravity.exe --remote-debugging-port=9000`, then use CDP to confirm Launchpad loads `shared/launchpad-proxy.js` and receives a probe request.

- [x] **Step 4: Record evidence and inspect the diff**

Run: `git diff --check` and `git status --short`; record exit codes and any environment limitations in `.agent/plan-提示词增强代理.md`.

Evidence: JavaScript 6/6 passed, full Rust test suite passed, Vite build passed, release executable was generated. NSIS bundling remains environment-blocked by the download of `nsis-3.11.zip` timing out.

### Task 5: Direct-first fallback

**Files:**
- Modify: `patcher/patches/shared/launchpad-proxy.js`
- Modify: `patcher/patches/shared/enhance.js`
- Test: `patcher/tests/launchpad-proxy.test.js`

- [x] **Step 1: Write the failing tests**

Covered direct success without a proxy and proxy fallback after a direct fetch failure.

- [x] **Step 2: Implement and verify**

`fetchWithProxyFallback` now returns a successful direct response without opening Launchpad and only calls the proxy after a direct exception. Focused JavaScript tests pass 6/6.
