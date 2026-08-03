import assert from "node:assert/strict";
import test from "node:test";
import { createSingleFlight } from "../patches/shared/enhance.js";
import { replaceContenteditableDom } from "../patches/shared/input-replacer.js";

const createFakeInput = (text) => ({
  childNodes: [{ textContent: text }],
  replaceChildren(...nodes) {
    this.childNodes = nodes;
  },
  get textContent() {
    return this.childNodes.map((node) => node.textContent).join("");
  },
});

test("replaces all existing contenteditable text instead of appending", () => {
  const input = createFakeInput("原始提示词");
  const documentRef = { createTextNode: (text) => ({ textContent: text }) };

  const replaced = replaceContenteditableDom(input, "优化后的提示词", documentRef);

  assert.equal(replaced, true);
  assert.equal(input.textContent, "优化后的提示词");
  assert.equal(input.childNodes.length, 1);
});

test("shares one in-flight enhancement when the button is clicked twice", async () => {
  const runOnce = createSingleFlight();
  let runs = 0;
  let release;

  const first = runOnce(async () => {
    runs += 1;
    await new Promise((resolve) => { release = resolve; });
    return "enhanced";
  });
  const second = runOnce(async () => {
    runs += 1;
    return "duplicate";
  });

  await new Promise((resolve) => queueMicrotask(resolve));
  release();

  assert.equal(await first, "enhanced");
  assert.equal(await second, "enhanced");
  assert.equal(runs, 1);

  await runOnce(async () => { runs += 1; });
  assert.equal(runs, 2);
});
