import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/marketplace.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { LISTING_TYPES, isCategoryAllowed } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("item listings accept goods and reject vehicle, property, and group categories", () => {
  for (const category of ["Apparel", "Electronics", "Home Goods", "Sporting Goods"]) assert.equal(isCategoryAllowed("item", category), true);
  for (const category of ["Vehicles", "Home Sales", "Property Rentals", "Buy and sell groups", ""]) assert.equal(isCategoryAllowed("item", category), false);
});

test("vehicle listings only accept Vehicles and default to it", () => {
  assert.deepEqual(LISTING_TYPES.vehicle.categories, ["Vehicles"]);
  assert.equal(isCategoryAllowed("vehicle", LISTING_TYPES.vehicle.defaultCategory), true);
  for (const category of ["Electronics", "Home Sales", "Property Rentals", ""]) assert.equal(isCategoryAllowed("vehicle", category), false);
});

test("home listings require a choice between selling and renting", () => {
  assert.equal(LISTING_TYPES.home.defaultCategory, "");
  assert.equal(isCategoryAllowed("home", "Home Sales"), true);
  assert.equal(isCategoryAllowed("home", "Property Rentals"), true);
  for (const category of ["Vehicles", "Home Goods", "Electronics", ""]) assert.equal(isCategoryAllowed("home", category), false);
});
