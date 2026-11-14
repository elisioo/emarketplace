import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/wishlist.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { parseWishlist, toggleWishlist } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("wishlist survives serialization and refresh without duplicate favorites", () => {
  let ids = toggleWishlist([], "bike");
  ids = toggleWishlist(ids, "camera");
  const reloaded = parseWishlist(JSON.stringify(ids));
  assert.deepEqual(reloaded, ["bike", "camera"]);
  assert.deepEqual(toggleWishlist(reloaded, "bike"), ["camera"]);
  assert.deepEqual(reloaded, ["bike", "camera"]);
});
test("wishlist tolerates corrupted or missing local storage", () => {
  for (const value of [null, "bad json", "{}", "null"]) assert.deepEqual(parseWishlist(value), []);
  assert.deepEqual(parseWishlist('["bike",null,42,"bike","",{}]'), ["bike"]);
});
