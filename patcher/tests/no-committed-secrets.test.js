import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const secretPatterns = [
  /\bsk_tr_[A-Za-z0-9_-]{20,}\b/g,
  /\bfe_oa_[A-Za-z0-9_-]{20,}\b/g,
];

const maskSecret = (value) => `${value.slice(0, 6)}***${value.slice(-4)}`;

test("tracked files do not contain committed prompt-enhance secrets", () => {
  const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);

  const leaks = [];

  for (const file of files) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    for (const pattern of secretPatterns) {
      for (const match of content.matchAll(pattern)) {
        leaks.push(`${file}: ${maskSecret(match[0])}`);
      }
    }
  }

  assert.deepEqual(leaks, []);
});
