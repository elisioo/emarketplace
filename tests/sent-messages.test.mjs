import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/sent-messages.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const history = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
globalThis.window = new EventTarget();
const makeMessage = id => ({ id, listingId: "listing-id", listingTitle: "Bike", sellerEmail: "seller@example.com", buyerEmail: "buyer@example.com", message: "Still available?", sentAt: "2026-11-15T00:00:00.000Z", emailStatus: "sent" });

test("sent history persists newest first and clear only removes its local storage", () => {
  values.set("unrelated", "keep");
  history.rememberSentMessage(makeMessage("a"));
  history.rememberSentMessage(makeMessage("b"));
  assert.deepEqual(history.readSentMessages().map(item => item.id), ["b", "a"]);
  assert.equal(values.has("emarketplace.sent-messages.v1"), true);
  history.clearSentMessages();
  assert.deepEqual(history.readSentMessages(), []);
  assert.equal(values.get("unrelated"), "keep");
});

test("history caps storage at 100 messages and avoids duplicate ids", () => {
  history.clearSentMessages();
  for (let i = 0; i < 105; i++) history.rememberSentMessage(makeMessage(String(i)));
  history.rememberSentMessage(makeMessage("104"));
  const messages = history.readSentMessages();
  assert.equal(messages.length, 100);
  assert.equal(messages[0].id, "104");
  assert.equal(messages[99].id, "5");
});

test("sent history stays available for the session when browser storage is blocked", () => {
  history.clearSentMessages();
  globalThis.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
  history.rememberSentMessage(makeMessage("session"));
  assert.equal(history.readSentMessages()[0].id, "session");
  history.clearSentMessages();
  assert.deepEqual(history.readSentMessages(), []);
});
