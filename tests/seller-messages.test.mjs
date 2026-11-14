import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/seller-messages.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { processSellerMessage } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const listingId = "12345678-1234-4234-8234-123456789abc";
const messageId = "22345678-1234-4234-8234-123456789abc";
const conversationId = "32345678-1234-4234-8234-123456789abc";
const valid = { listingId, messageId, message: "Is this still available?" };
function fixture(overrides = {}) {
  const calls = [];
  return { calls, deps: {
    saveMessage: async data => { calls.push(["save", data]); return { messageId, conversationId, listingTitle: "Bike", recipientEmail: "seller@example.com", senderEmail: "buyer@example.com", duplicate: false }; },
    sendEmail: async data => { calls.push(["email", data]); },
    ...overrides,
  } };
}
test("chat saves with a stable message ID and does not email by default", async () => {
  const { calls, deps } = fixture();
  const result = await processSellerMessage(valid, deps);
  assert.equal(result.status, 200);
  assert.equal(result.body.saved, true);
  assert.equal(result.body.conversationId, conversationId);
  assert.equal(result.body.emailStatus, "skipped");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].messageId, messageId);
});
test("optional email uses database recipient and sender, ignoring browser email overrides", async () => {
  const { calls, deps } = fixture();
  const result = await processSellerMessage({ ...valid, notifyByEmail: true, recipientEmail: "attacker@example.com", buyerEmail: "fake@example.com" }, deps);
  assert.equal(result.body.emailStatus, "sent");
  assert.deepEqual(calls.map(call => call[0]), ["save", "email"]);
  assert.equal(calls[1][1].to, "seller@example.com");
  assert.equal(calls[1][1].replyTo, "buyer@example.com");
  assert.equal(calls[1][1].idempotencyKey, `chat-message/${messageId}`);
});
test("seller replies can optionally email the buyer", async () => {
  let delivered;
  const { deps } = fixture({ saveMessage: async () => ({ messageId, conversationId, listingTitle: "Bike", recipientEmail: "buyer@example.com", senderEmail: "seller@example.com" }), sendEmail: async email => { delivered = email; } });
  const result = await processSellerMessage({ conversationId, messageId, message: "Yes it is!", notifyByEmail: true }, deps);
  assert.equal(result.body.saved, true);
  assert.equal(delivered.to, "buyer@example.com");
  assert.equal(delivered.replyTo, "seller@example.com");
});
test("email failure preserves chat success", async () => {
  const { deps } = fixture({ sendEmail: async () => { throw new Error("Unavailable"); } });
  const result = await processSellerMessage({ ...valid, notifyByEmail: true }, deps);
  assert.equal(result.status, 200);
  assert.equal(result.body.saved, true);
  assert.equal(result.body.emailStatus, "failed");
});
test("unauthorized conversation and storage errors never trigger email", async () => {
  for (const [code, expected] of [["42501", 403], ["P0002", 404], ["22023", 400], ["offline", 503]]) {
    const { calls, deps } = fixture({ saveMessage: async () => { throw { code }; } });
    const result = await processSellerMessage({ ...valid, notifyByEmail: true }, deps);
    assert.equal(result.status, expected);
    assert.equal(calls.length, 0);
  }
});
test("invalid targets, IDs, and message lengths are rejected before persistence", async () => {
  for (const input of [{ ...valid, messageId: "bad" }, { ...valid, listingId: "bad" }, { ...valid, listingId: undefined }, { ...valid, conversationId: "bad" }, { ...valid, message: " " }, { ...valid, message: "x".repeat(1501) }]) {
    const { calls, deps } = fixture();
    assert.equal((await processSellerMessage(input, deps)).status, 400);
    assert.equal(calls.length, 0);
  }
});
