import assert from "node:assert/strict";
import test from "node:test";
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
