"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/marketplace/loading";
import { paymentRequest } from "@/components/payments/payment-request";
import { formatPrice } from "@/lib/marketplace";
import type { PaymentOrder } from "@/lib/payments";

export function CheckoutResult({ orderId, cancel = false }: { orderId: string; cancel?: boolean }) {
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function load() {
      try {
        if (!orderId) throw new Error("No order was selected.");
        if (cancel && attempts === 0) { const result = await paymentRequest("/api/stripe/cancel", { orderId }); if (active) setCancelled(result.cancelled === true); }
        const result = await paymentRequest(`/api/stripe/orders?order=${encodeURIComponent(orderId)}`);
        if (!active) return;
        const current = result.orders[0] as PaymentOrder | undefined;
        if (!current) throw new Error("This order is not available to your account.");
        setOrder(current); setError(null); setLoading(false);
        attempts++;
        if (current.status === "pending" && attempts < 20) timer = setTimeout(load, 3000);
      } catch (error) { if (active) { setError(error instanceof Error ? error.message : "Order could not be loaded."); setLoading(false); } }
    }
    setLoading(true); void load();
    return () => { active = false; clearTimeout(timer); };
  }, [orderId, cancel, version]);
  const paid = order?.status === "paid";
  return <main className="shell payments-page"><div className="payments-card checkout-result">
    {loading ? <LoadingIndicator label={cancel ? "Cancelling checkout..." : "Confirming your payment..."}/> : <>
      {paid ? <CheckCircle2 size={42} className="checkout-success-icon"/> : <Clock3 size={42} className="checkout-waiting-icon"/>}
      <h1>{paid ? "Payment confirmed!" : cancelled || order?.status === "expired" ? "Checkout cancelled" : "Waiting for payment confirmation"}</h1>
      <p className="payments-intro">{paid ? "Your order is saved and the listing is marked Sold." : cancelled || order?.status === "expired" ? "This checkout is closed. The listing can be purchased again if it remains available." : "We are waiting for Stripe's signed payment confirmation. This page does not mark an order as paid by itself."}</p>
      {order && <dl className="order-summary"><div><dt>Listing</dt><dd>{order.listing_title}</dd></div><div><dt>Total</dt><dd>{formatPrice(order.amount_cents / 100)}</dd></div><div><dt>Order ID</dt><dd>{order.id}</dd></div><div><dt>Status</dt><dd>{order.status}</dd></div></dl>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="payments-actions">{!paid && !cancelled && <Button variant="outline" onClick={() => setVersion(current => current + 1)}>Refresh confirmation</Button>}<Button asChild><Link href={order ? `/item/${order.listing_id}` : "/"}>{paid ? "View purchased listing" : "Back to marketplace"}</Link></Button></div>
    </>}
  </div></main>;
}
