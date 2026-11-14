import { appUrl, getPaymentAdmin, getStripe, marketplaceId, PaymentError, paymentFailure, requirePaymentUser } from "@/lib/stripe/server";
import type Stripe from "stripe";

export const runtime = "nodejs";
async function syncAccount(account: Stripe.Account, sellerId: string) {
  const admin = getPaymentAdmin();
  const { error } = await admin.from("seller_accounts").upsert({ seller_id: sellerId, stripe_account_id: account.id,
    charges_enabled: account.charges_enabled, payouts_enabled: account.payouts_enabled, details_submitted: account.details_submitted,
    updated_at: new Date().toISOString() }, { onConflict: "seller_id" });
  if (error) throw new PaymentError("Seller payment setup could not be saved. Please retry.", 503);
}
export async function GET(request: Request) {
  try {
    const { user } = await requirePaymentUser(request, true);
    const admin = getPaymentAdmin();
    const { data, error } = await admin.from("seller_accounts").select("stripe_account_id").eq("seller_id", user.id).maybeSingle();
    if (error) throw new PaymentError("Payment setup is unavailable. Check the payment database migration.", 503);
    if (!data) return Response.json({ connected: false, ready: false });
    const account = await getStripe().accounts.retrieve(data.stripe_account_id);
    await syncAccount(account, user.id);
    return Response.json({ connected: true, accountId: account.id, ready: account.charges_enabled && account.payouts_enabled && account.details_submitted,
      chargesEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled, detailsSubmitted: account.details_submitted,
      currentlyDue: account.requirements?.currently_due ?? [], disabledReason: account.requirements?.disabled_reason ?? null });
  } catch (error) { return paymentFailure(error); }
}
export async function POST(request: Request) {
  try {
    const { user } = await requirePaymentUser(request, true);
    const admin = getPaymentAdmin();
    const stripe = getStripe();
    const { data, error } = await admin.from("seller_accounts").select("stripe_account_id").eq("seller_id", user.id).maybeSingle();
    if (error) throw new PaymentError("Payment setup is unavailable. Apply the payment database migration first.", 503);
    const platform = data ? null : await stripe.accounts.retrieveCurrent();
    const account = data ? await stripe.accounts.retrieve(data.stripe_account_id) : await stripe.accounts.create({ type: "express", country: platform?.country ?? "US", email: user.email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { marketplace_id: marketplaceId(), seller_id: user.id },
      business_profile: { product_description: "Test marketplace purchases on Emarketplace" },
    }, { idempotencyKey: `connect-${marketplaceId()}-${user.id}` });
    await syncAccount(account, user.id);
    const link = await stripe.accountLinks.create({ account: account.id, type: "account_onboarding",
      refresh_url: `${appUrl()}/seller/payments?refresh=1`, return_url: `${appUrl()}/seller/payments?returned=1` });
    return Response.json({ url: link.url });
  } catch (error) { return paymentFailure(error); }
}
