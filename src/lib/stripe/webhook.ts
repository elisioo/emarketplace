import type Stripe from "stripe";
import { checkoutMatchesOrder, type PaymentOrder } from "@/lib/payments";
import { getPaymentAdmin, getStripe, marketplaceId } from "@/lib/stripe/server";

export async function handleStripeEvent(event: Stripe.Event) {
  if (event.livemode) return { ignored: true };
  const namespace = marketplaceId();
  if (event.type === "account.updated") {
    const incoming = event.data.object as Stripe.Account;
    if (incoming.metadata?.marketplace_id !== namespace) return { ignored: true };
    const admin = getPaymentAdmin();
    const { data: stored, error } = await admin.from("seller_accounts").select("seller_id").eq("stripe_account_id", incoming.id).maybeSingle();
    if (error) throw error;
    if (!stored) return { ignored: true };
    const account = await getStripe().accounts.retrieve(incoming.id);
    const { error: updateError } = await admin.from("seller_accounts").update({ charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled, details_submitted: account.details_submitted, updated_at: new Date().toISOString() }).eq("stripe_account_id", account.id);
    if (updateError) throw updateError;
    return { received: true };
  }
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.expired"].includes(event.type)) return { ignored: true };
  const incoming = event.data.object as Stripe.Checkout.Session;
  if (incoming.metadata?.marketplace_id !== namespace || !incoming.metadata.order_id || !event.account) return { ignored: true };
  const admin = getPaymentAdmin();
  const { data, error } = await admin.from("orders").select("*").eq("id", incoming.metadata.order_id).maybeSingle();
  if (error) throw error;
  const order = data as PaymentOrder | null;
  if (!order || order.stripe_account_id !== event.account || (order.stripe_session_id && order.stripe_session_id !== incoming.id)) return { ignored: true };
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(incoming.id, {}, { stripeAccount: event.account });
  if (event.type === "checkout.session.expired") {
    if (session.status !== "expired") return { ignored: true };
    const { error } = await admin.rpc("expire_checkout", { p_order_id: order.id, p_session_id: session.id });
    if (error) throw error;
    return { received: true };
  }
  if (!checkoutMatchesOrder(session, order, event.account, namespace) || session.livemode) return { ignored: true };
  const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!intentId) throw new Error("Missing payment intent");
  const intent = await stripe.paymentIntents.retrieve(intentId, {}, { stripeAccount: event.account });
  if (intent.status !== "succeeded" || intent.amount_received !== order.amount_cents || intent.application_fee_amount !== order.fee_cents) throw new Error("Payment amount or application fee mismatch");
  const { error: confirmError } = await admin.rpc("confirm_checkout", { p_order_id: order.id, p_session_id: session.id,
    p_account_id: event.account, p_amount: session.amount_total, p_currency: session.currency, p_payment_intent: intentId });
  if (confirmError) throw confirmError;
  return { received: true };
}
