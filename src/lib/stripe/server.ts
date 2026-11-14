import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { getSupabase } from "@/lib/supabase";

let stripe: Stripe | undefined;
export class PaymentError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw new PaymentError("Stripe sandbox payments are not configured.", 503);
  return stripe ??= new Stripe(key, { maxNetworkRetries: 2, timeout: 15000 });
}
export function getPaymentAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.startsWith("your-")) throw new PaymentError("The payment database is not configured on the server.", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
export function marketplaceId() {
  return `emarketplace_${createHash("sha256").update(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "unconfigured").digest("hex").slice(0, 20)}`;
}
export function appUrl() {
  const value = process.env.APP_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://emarketplace-eli.vercel.app");
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new PaymentError("App URL is invalid.", 503);
  return url.origin;
}
export async function requirePaymentUser(request: Request, sellerOnly = false) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new PaymentError("Please log in to continue.", 401);
  const client = getSupabase(token);
  if (!client) throw new PaymentError("Accounts are unavailable.", 503);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.email) throw new PaymentError("Your session expired. Please log in again.", 401);
  const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profileError) throw new PaymentError("Your account could not be verified.", 503);
  if (!profile?.role || (sellerOnly && profile.role !== "seller")) throw new PaymentError(sellerOnly ? "A seller account is required." : "Choose your account type first.", 403);
  return { user: data.user, client };
}
export function paymentFailure(error: unknown) {
  if (error instanceof PaymentError) return Response.json({ error: error.message }, { status: error.status });
  // Stripe and database errors can contain private request data; keep the response generic.
  console.error("Payment request failed", error instanceof Error ? error.name : "DatabaseError");
  return Response.json({ error: "Payments are temporarily unavailable. Please try again." }, { status: 503 });
}
export async function readPaymentBody(request: Request) {
  const body = await request.text();
  if (body.length > 4000) throw new PaymentError("Request is too large.", 413);
  try { const parsed: unknown = JSON.parse(body); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); return parsed as Record<string, unknown>; }
  catch { throw new PaymentError("Invalid request."); }
}
export function requireUuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new PaymentError("Choose a valid listing or order.");
  return value;
}
