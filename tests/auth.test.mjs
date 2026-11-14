import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/auth.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { isAccountRole, requiresSeller, isPublicAuthPath } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("only buyer and seller are valid account types", () => {
  assert.equal(isAccountRole("buyer"), true);
  assert.equal(isAccountRole("seller"), true);
  for (const value of [null, undefined, "admin", "", "SELLER", {}]) assert.equal(isAccountRole(value), false);
});
test("all listing creation routes require seller access", () => {
  for (const path of ["/create", "/create/item", "/create/vehicle", "/create/home"]) assert.equal(requiresSeller(path), true);
  for (const path of ["/", "/item/123", "/create-other"]) assert.equal(requiresSeller(path), false);
});
test("only authentication and role-setup pages bypass the marketplace gate", () => {
  for (const path of ["/login", "/signup", "/auth/confirm", "/choose-role"]) assert.equal(isPublicAuthPath(path), true);
  for (const path of ["/", "/create", "/item/123", "/signup-other"]) assert.equal(isPublicAuthPath(path), false);
});
