import { getPaymentAdmin, getStripe, paymentFailure, PaymentError, readPaymentBody, requirePaymentUser, requireUuid } from "@/lib/stripe/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { user } = await requirePaymentUser(request);
    const { orderId } = await readPaymentBody(request);
    const id = requireUuid(orderId);
    const admin = getPaymentAdmin();
    const { data: order, error } = await admin.from("orders").select("*").eq("id", id).eq("buyer_id", user.id).maybeSingle();
    if (error || !order) throw new PaymentError("Order not found.", 404);
    if (order.status === "paid") return Response.json({ paid: true, listingId: order.listing_id });
    if (order.status === "expired") return Response.json({ cancelled: true, listingId: order.listing_id });
    if (!order.stripe_session_id) throw new PaymentError("This checkout is still being prepared. Try again shortly.", 409);
    const stripe = getStripe();
    let session = await stripe.checkout.sessions.retrieve(order.stripe_session_id, {}, { stripeAccount: order.stripe_account_id });
    if (session.status === "complete") return Response.json({ paid: true, listingId: order.listing_id });
    if (session.status === "open") session = await stripe.checkout.sessions.expire(session.id, {}, { stripeAccount: order.stripe_account_id });
    if (session.status !== "expired") throw new PaymentError("Checkout could not be cancelled yet.", 409);
    const { error: expireError } = await admin.rpc("expire_checkout", { p_order_id: order.id, p_session_id: session.id });
    if (expireError) throw expireError;
    return Response.json({ cancelled: true, listingId: order.listing_id });
  } catch (error) { return paymentFailure(error); }
}
