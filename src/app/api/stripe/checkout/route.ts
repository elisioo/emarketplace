import { getPaymentAdmin, getStripe, marketplaceId, PaymentError, paymentFailure, readPaymentBody, requirePaymentUser, requireUuid, appUrl } from "@/lib/stripe/server";
import { priceToCents, type PaymentOrder } from "@/lib/payments";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { user } = await requirePaymentUser(request);
    const { listingId: raw } = await readPaymentBody(request);
    const listingId = requireUuid(raw);
    const admin = getPaymentAdmin();
    const stripe = getStripe();
    // Reconcile stale reservations only after Stripe proves the old session is expired.
    const { data: listing, error: listingError } = await admin.from("listings").select("reserved_order_id").eq("id", listingId).maybeSingle();
    if (listingError) throw new PaymentError("Checkout is unavailable. Check the payment database migration.", 503);
    if (listing?.reserved_order_id) {
      const { data: previous } = await admin.from("orders").select("id,stripe_session_id,stripe_account_id,status").eq("id", listing.reserved_order_id).maybeSingle();
      if (previous?.status === "pending" && previous.stripe_session_id) {
        const oldSession = await stripe.checkout.sessions.retrieve(previous.stripe_session_id, {}, { stripeAccount: previous.stripe_account_id });
        if (oldSession.status === "expired") {
          const { error } = await admin.rpc("expire_checkout", { p_order_id: previous.id, p_session_id: oldSession.id });
          if (error) throw error;
        }
      }
    }
    const { data, error } = await admin.rpc("reserve_checkout", { p_listing_id: listingId, p_buyer_id: user.id, p_buyer_email: user.email });
    if (error) throw new PaymentError(error.code === "P0001" ? "This listing is sold or another buyer is checking out. Please try again later." : error.code === "22023" ? "This listing is not eligible for purchase. The seller may need to finish Stripe setup." : "Checkout could not be prepared.", error.code === "P0001" ? 409 : 400);
    const order = data as PaymentOrder;
    priceToCents(order.amount_cents / 100);
    const account = await stripe.accounts.retrieve(order.stripe_account_id);
    if (!account.charges_enabled || !account.payouts_enabled || !account.details_submitted) {
      // No new session is created for a seller whose readiness has changed.
      if (!order.stripe_session_id) await admin.rpc("expire_checkout", { p_order_id: order.id, p_session_id: null });
      throw new PaymentError("The seller needs to complete payment setup before purchases can resume.", 409);
    }
    if (order.stripe_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(order.stripe_session_id, {}, { stripeAccount: order.stripe_account_id });
      if (existing.status === "complete") return Response.json({ url: `${appUrl()}/checkout/success?order=${order.id}` });
      if (existing.status !== "open" || !existing.url) throw new PaymentError("This checkout has expired. Return to the listing and try again.", 409);
      return Response.json({ url: existing.url });
    }
    const expiresAt = Math.floor(Date.parse(order.checkout_expires_at) / 1000) - 60;
    if (expiresAt < Math.floor(Date.now() / 1000) + 30 * 60) {
      throw new PaymentError("This checkout needs to be recovered before starting a new payment. Please contact support with your order ID.", 409);
    }
    const metadata = { marketplace_id: marketplaceId(), order_id: order.id, listing_id: order.listing_id };
    const session = await stripe.checkout.sessions.create({ mode: "payment", allowed_payment_method_types: ["card"], client_reference_id: order.id,
      customer_email: order.buyer_email, expires_at: expiresAt,
      line_items: [{ price_data: { currency: "usd", unit_amount: order.amount_cents, product_data: { name: order.listing_title } }, quantity: 1 }],
      payment_intent_data: { application_fee_amount: order.fee_cents, metadata }, metadata,
      success_url: `${appUrl()}/checkout/success?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/checkout/cancel?order=${order.id}`,
    }, { stripeAccount: order.stripe_account_id, idempotencyKey: `checkout-${order.id}` });
    const { error: saveError } = await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id).is("stripe_session_id", null);
    if (saveError) throw new PaymentError("Your checkout was created but could not be linked. Please retry; the same checkout will be reused.", 503);
    if (!session.url) throw new PaymentError("Stripe did not return a checkout URL.", 503);
    return Response.json({ url: session.url });
  } catch (error) { return paymentFailure(error); }
}
