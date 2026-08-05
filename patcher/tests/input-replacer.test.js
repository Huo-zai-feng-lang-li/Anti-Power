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

const createFormattedFakeNode = (tagName) => ({
  tagName,
  style: {},
  childNodes: [],
  appendChild(node) {
    this.childNodes.push(node);
    return node;
  },
  set textContent(value) {
    this.childNodes = [{ textContent: value }];
  },
  get textContent() {
    return this.childNodes.map((node) => node.textContent).join("");
  },
});

const createFormattedFakeInput = () => ({
  childNodes: [],
  replaceChildren(...nodes) {
    this.childNodes = nodes;
  },
  get textContent() {
    return this.childNodes.map((node) => node.textContent).join("");
  },
  get innerText() {
    return this.childNodes.map((node) => node.textContent).join("\n");
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

test("preserves multiline formatting when replacing contenteditable text", () => {
  const input = createFormattedFakeInput();
  const documentRef = {
    createElement: (tagName) => createFormattedFakeNode(tagName),
    createTextNode: (text) => ({ textContent: text }),
  };

  const replaced = replaceContenteditableDom(input, "第一行\n  第二行", documentRef);

  assert.equal(replaced, true);
  assert.equal(input.childNodes.length, 2);
  assert.equal(input.childNodes[0].tagName, "div");
  assert.equal(input.childNodes[0].style.whiteSpace, "pre-wrap");
  assert.equal(input.childNodes[0].textContent, "第一行");
  assert.equal(input.childNodes[1].textContent, "  第二行");
  assert.equal(input.innerText, "第一行\n  第二行");
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
