import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/seller-messages.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { processSellerMessage } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const listingId = "12345678-1234-4234-8234-123456789abc";
const valid = { listingId, buyerEmail: "buyer@example.com", message: "Is this still available?" };
function fixture(overrides = {}) {
  const calls = [];
  return { calls, deps: {
    newId: () => "message-id",
    findListing: async id => { calls.push(["find", id]); return { id, title: "Vintage Bike", seller_email: "seller@example.com" }; },
    saveMessage: async data => { calls.push(["save", data]); },
    sendEmail: async data => { calls.push(["email", data]); },
    ...overrides,
  } };
}

test("saves before email, uses listing recipient, and sets buyer reply-to", async () => {
  const { calls, deps } = fixture();
  const result = await processSellerMessage({ ...valid, seller_email: "attacker@example.com" }, deps);
  assert.equal(result.body.saved, true);
  assert.equal(result.body.emailStatus, "sent");
  assert.deepEqual(calls.map(call => call[0]), ["find", "save", "email"]);
  assert.equal(calls[1][1].seller_email, "seller@example.com");
  assert.equal(calls[2][1].to, "seller@example.com");
  assert.equal(calls[2][1].replyTo, valid.buyerEmail);
  assert.ok(calls[2][1].text.includes(valid.message));
  assert.equal(calls[2][1].idempotencyKey, "seller-message/message-id");
});

test("email failure preserves the saved-message success", async () => {
  const { calls, deps } = fixture({ sendEmail: async () => { throw new Error("Resend rejected"); } });
  const result = await processSellerMessage(valid, deps);
  assert.equal(result.status, 200);
  assert.equal(result.body.saved, true);
  assert.equal(result.body.emailStatus, "failed");
  assert.equal(calls.filter(call => call[0] === "save").length, 1);
});

test("save failure prevents email delivery", async () => {
  const { calls, deps } = fixture({ saveMessage: async () => { throw new Error("Database unavailable"); } });
  const result = await processSellerMessage(valid, deps);
  assert.equal(result.status, 503);
  assert.ok(!calls.some(call => call[0] === "email"));
});

test("missing listing prevents saving and email", async () => {
  const { calls, deps } = fixture({ findListing: async () => null });
  const result = await processSellerMessage(valid, deps);
  assert.equal(result.status, 404);
  assert.equal(calls.length, 0);
});

test("invalid inputs are rejected before database or email calls", async () => {
  for (const input of [{ ...valid, listingId: "bad" }, { ...valid, buyerEmail: "buyer@example.com\r\nBcc:other@example.com" }, { ...valid, message: " " }, { ...valid, message: "x".repeat(1501) }]) {
    const { calls, deps } = fixture();
    assert.equal((await processSellerMessage(input, deps)).status, 400);
    assert.equal(calls.length, 0);
  }
});
