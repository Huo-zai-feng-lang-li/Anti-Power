import test from "node:test";
import assert from "node:assert/strict";
import { extractMermaidSource } from "../patches/cascade-panel/mermaid.js";

test("【Mermaid】精确行提取防嵌套测试", () => {
  const fakeContainer = {
    querySelectorAll: (selector) => {
      if (selector.includes(".line-content")) {
        return [
          { textContent: "graph TD" },
          { textContent: "  A[Start] --> B[End]" },
        ];
      }
      return [];
    },
    querySelector: () => null,
  };

  const extracted = extractMermaidSource(fakeContainer);
  assert.equal(extracted, "graph TD\n  A[Start] --> B[End]");
});

test("【Mermaid】单一文本节点兜底提取测试", () => {
  const fakeContainer = {
    querySelectorAll: () => [],
    querySelector: (selector) => {
      if (selector === "code") {
        return { textContent: "sequenceDiagram\n  Alice->>Bob: Hello" };
      }
      return null;
    },
  };

  const extracted = extractMermaidSource(fakeContainer);
  assert.equal(extracted, "sequenceDiagram\n  Alice->>Bob: Hello");
});
