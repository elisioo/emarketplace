import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import Stripe from "stripe";
const compile = file => ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const paymentsUrl = dataUrl(compile("src/lib/payments.ts"));
const { priceToCents, applicationFee, checkoutMatchesOrder } = await import(paymentsUrl);

test("prices use integer cents and the platform fee is 10 percent", () => {
  assert.equal(priceToCents("1000.01"), 100001);
  assert.equal(priceToCents(98), 9800);
  assert.equal(applicationFee(10000), 1000);
  assert.equal(applicationFee(100001), 10000);
  for (const value of [0, -1, .49, Infinity, NaN, 1000000]) assert.throws(() => priceToCents(value));
});
const order = { id: "order-1", stripe_account_id: "acct_ours", stripe_session_id: "cs_ours", amount_cents: 10000, fee_cents: 1000, currency: "usd", status: "pending" };
const session = { id: "cs_ours", mode: "payment", payment_status: "paid", amount_total: 10000, currency: "usd", metadata: { marketplace_id: "ours", order_id: "order-1" }, payment_intent: "pi_ours", status: "complete", livemode: false };
test("fulfillment requires paid status, matching amount, currency, account, session, and namespace", () => {
  assert.equal(checkoutMatchesOrder(session, order, "acct_ours", "ours"), true);
  for (const patch of [{ payment_status: "unpaid" }, { mode: "setup" }, { amount_total: 9999 }, { currency: "eur" }, { id: "cs_other" }, { metadata: { marketplace_id: "other", order_id: "order-1" } }]) assert.equal(checkoutMatchesOrder({ ...session, ...patch }, order, "acct_ours", "ours"), false);
  assert.equal(checkoutMatchesOrder(session, order, "acct_other", "ours"), false);
});
test("Stripe signatures reject tampered bodies", () => {
  const stripe = new Stripe("sk_test_example");
  const secret = "whsec_example";
  const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed", data: { object: session } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(stripe.webhooks.constructEvent(payload, header, secret).id, "evt_test");
  assert.throws(() => stripe.webhooks.constructEvent(payload.replace('10000','9999'), header, secret));
});

// Inject only external boundaries; exercise the real webhook implementation.
let state;
const serverUrl = dataUrl(`export const marketplaceId=()=>"ours"; export const getPaymentAdmin=()=>globalThis.__stripePaymentTest.admin; export const getStripe=()=>globalThis.__stripePaymentTest.stripe;`);
const webhookSource = compile("src/lib/stripe/webhook.ts").replace('"@/lib/payments"', JSON.stringify(paymentsUrl)).replace('"@/lib/stripe/server"', JSON.stringify(serverUrl));
const { handleStripeEvent } = await import(dataUrl(webhookSource));
function fixture() {
  const rpc = [];
  state = { rpc, order: { ...order }, retrievedAccount: null, retrievedSession: { ...session }, intent: { status: "succeeded", amount_received: 10000, application_fee_amount: 1000 } };
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: state.order, error: null }) };
  globalThis.__stripePaymentTest = {
    admin: { from: () => chain, rpc: async (name, args) => { rpc.push([name, args]); return { error: null }; } },
    stripe: { checkout: { sessions: { retrieve: async (_id, _params, options) => { state.retrievedAccount = options.stripeAccount; return state.retrievedSession; } } }, paymentIntents: { retrieve: async () => state.intent } },
  };
  return state;
}
const event = (object = session, account = "acct_ours", type = "checkout.session.completed") => ({ id: "evt_ours", type, account, livemode: false, data: { object } });
test("webhook confirms orders in the connected-account scope", async () => {
  const current = fixture();
  await handleStripeEvent(event());
  assert.equal(current.retrievedAccount, "acct_ours");
  assert.equal(current.rpc[0][0], "confirm_checkout");
  assert.equal(current.rpc[0][1].p_amount, 10000);
});
test("shared-sandbox events for unrelated orders or accounts are ignored", async () => {
  const current = fixture();
  assert.equal((await handleStripeEvent(event({ ...session, metadata: { marketplace_id: "someone-else" } }))).ignored, true);
  assert.equal((await handleStripeEvent(event(session, "acct_other"))).ignored, true);
  current.order = null;
  assert.equal((await handleStripeEvent(event())).ignored, true);
  assert.equal(current.rpc.length, 0);
});
test("unpaid sessions and wrong application fees never mark listings sold", async () => {
  const current = fixture();
  current.retrievedSession = { ...session, payment_status: "unpaid" };
  await handleStripeEvent(event());
  assert.equal(current.rpc.length, 0);
  current.retrievedSession = session;
  current.intent.application_fee_amount = 0;
  await assert.rejects(() => handleStripeEvent(event()));
  assert.equal(current.rpc.length, 0);
});
test("expired Checkout sessions release their reservation rather than becoming paid", async () => {
  const current = fixture();
  current.retrievedSession = { ...session, status: "expired", payment_status: "unpaid" };
  await handleStripeEvent(event(session, "acct_ours", "checkout.session.expired"));
  assert.equal(current.rpc[0][0], "expire_checkout");
});

const connectServerUrl = dataUrl(`
export class PaymentError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const requirePaymentUser=async()=>({user:{id:"seller-test",email:"seller@example.com"}});
export const getPaymentAdmin=()=>globalThis.__connectTest.admin;
export const getStripe=()=>globalThis.__connectTest.stripe;
export const marketplaceId=()=>"ours";
export const appUrl=()=>"https://example.com";
export const paymentFailure=error=>Response.json({error:error.message},{status:error.status||503});
`);
const connectSource = compile("src/app/api/stripe/connect/route.ts").replace('"@/lib/stripe/server"', JSON.stringify(connectServerUrl));
const { POST: connectSeller } = await import(dataUrl(connectSource));
test("seller onboarding uses sandbox-supported managed-risk Accounts v2 and persists its account ID", async () => {
  let creation, link, saved;
  const projection = { id: "acct_new", charges_enabled: false, payouts_enabled: false, details_submitted: false };
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({data:null,error:null}) };
  globalThis.__connectTest = {
    admin: { from: () => ({...chain,upsert:async row=>{saved=row;return {error:null}}}) },
    stripe: { accounts: { retrieveCurrent:async()=>({country:"EE"}),retrieve:async()=>projection,create:()=>{throw new Error("Legacy account creation must not be used")}},
      v2: { core: { accounts: { create:async(params)=>{creation=params;return {id:"acct_new"}}},accountLinks:{create:async(params)=>{link=params;return {url:"https://connect.stripe.com/test-link"}}} } } },
  };
  const response = await connectSeller(new Request("https://example.com/api/stripe/connect",{method:"POST"}));
  assert.equal(response.status,200);
  assert.equal(creation.defaults.responsibilities.losses_collector,"stripe");
  assert.equal(creation.defaults.responsibilities.fees_collector,"stripe");
  assert.equal(creation.dashboard,"full");
  assert.equal(creation.identity.country,"EE");
  assert.equal(creation.configuration.merchant.capabilities.card_payments.requested,true);
  assert.equal(saved.stripe_account_id,"acct_new");
  assert.equal(link.use_case.type,"account_onboarding");
  assert.equal(link.use_case.account_onboarding.return_url,"https://example.com/seller/payments?returned=1");
});
