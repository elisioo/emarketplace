import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/comparison.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { toggleComparison } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("comparison accepts up to three unique listings and rejects a fourth", () => {
  let ids = [];
  for (const id of ["a", "b", "c", "d"]) ids = toggleComparison(ids, id);
  assert.deepEqual(ids, ["a", "b", "c"]);
});

test("selected listings can be removed at the limit, then replaced", () => {
  const original = ["a", "b", "c"];
  const removed = toggleComparison(original, "b");
  assert.deepEqual(removed, ["a", "c"]);
  assert.deepEqual(toggleComparison(removed, "d"), ["a", "c", "d"]);
  assert.deepEqual(original, ["a", "b", "c"]);
});

test("toggling the only selected listing clears selection", () => {
  assert.deepEqual(toggleComparison(["a"], "a"), []);
});
