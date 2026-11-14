import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/chat.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { conversationPeer, unreadTotal, mergeChatMessages } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("each participant sees the other participant's email", () => {
  const row = { buyer_id: "buyer", seller_id: "seller", buyer_email: "buyer@example.com", seller_email: "seller@example.com" };
  assert.equal(conversationPeer(row, "buyer"), "seller@example.com");
  assert.equal(conversationPeer(row, "seller"), "buyer@example.com");
});
test("unread badges safely total server counts", () => {
  assert.equal(unreadTotal([{ unread_count: 2 }, { unread_count: "3" }, { unread_count: 0 }]), 5);
  assert.equal(unreadTotal([]), 0);
});
test("refresh and pagination merge messages without duplicating bubbles and update read status", () => {
  const first = { id: "a", created_at: "2026-11-15T10:00:00Z", read_at: null };
  const next = { id: "b", created_at: "2026-11-15T10:01:00Z", read_at: null };
  const updated = { ...first, read_at: "2026-11-15T10:02:00Z" };
  const result = mergeChatMessages([next, first], [updated]);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(item => item.id), ["a", "b"]);
  assert.equal(result[0].read_at, updated.read_at);
});
