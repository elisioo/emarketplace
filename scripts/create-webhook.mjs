import Stripe from "stripe";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_")) throw new Error("A Stripe sandbox secret key is required.");
const stripe = new Stripe(key);
const namespace = `emarketplace_${createHash("sha256").update(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "unconfigured").digest("hex").slice(0,20)}`;
const target = new URL(process.argv[2] || "https://emarketplace-eli.vercel.app/api/stripe/webhook");
if (target.protocol !== "https:" || target.pathname !== "/api/stripe/webhook") throw new Error("Use the public production HTTPS webhook URL.");
const ready = await fetch(target, { signal: AbortSignal.timeout(20000) });
let identity;
try { identity = await ready.json(); } catch {}
if (!ready.ok || identity?.integration !== "emarketplace-stripe-connect-v1" || identity?.marketplaceId !== namespace) {
  throw new Error("Deploy this app's webhook route to that production URL first. No Stripe endpoint was created.");
}
let existing;
for await (const endpoint of stripe.webhookEndpoints.list({ limit: 100 })) {
  if (endpoint.url === target.href) { existing = endpoint; break; }
}
if (existing) {
  if (existing.metadata?.marketplace_id === namespace && process.env.STRIPE_WEBHOOK_ENDPOINT_ID === existing.id && process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
    console.log(`Webhook already configured: ${existing.id}. No duplicate created.`);
    process.exit(0);
  }
  throw new Error(`An endpoint already exists for this URL (${existing.id}). Reuse its signing secret; this script will not delete or duplicate it.`);
}
const endpoint = await stripe.webhookEndpoints.create({ url: target.href, connect: true,
  enabled_events: ["checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_succeeded", "account.updated"],
  metadata: { marketplace_id: namespace },
}, { idempotencyKey: `webhook-${namespace}-${createHash("sha256").update(target.href).digest("hex").slice(0,16)}` });
if (!endpoint.secret) throw new Error("Stripe did not return a signing secret.");
let env = await readFile(".env.local", "utf8");
for (const [name, value] of Object.entries({ STRIPE_WEBHOOK_SECRET: endpoint.secret, STRIPE_WEBHOOK_ENDPOINT_ID: endpoint.id })) {
  const pattern = new RegExp(`^${name}=.*$`, "m");
  env = pattern.test(env) ? env.replace(pattern, `${name}=${value}`) : `${env}\n${name}=${value}\n`;
}
await writeFile(".env.local", env, { mode: 0o600 });
console.log(`Created Connect webhook ${endpoint.id} for ${target.href}.`);
console.log("Signing secret saved in .env.local without printing it. Set STRIPE_WEBHOOK_SECRET in Vercel and redeploy.");
