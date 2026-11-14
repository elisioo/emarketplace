"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { paymentRequest } from "@/components/payments/payment-request";
import { LoadingIndicator } from "@/components/marketplace/loading";
import { PaymentBreakdown } from "@/components/payments/payment-breakdown";
import { formatPrice } from "@/lib/marketplace";
import type { PaymentOrder } from "@/lib/payments";
export function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; paymentRequest("/api/stripe/orders").then(result => { if (active) setOrders(result.orders); }).catch(() => { if (active) setError("Orders could not be loaded."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  return <main className="shell payments-page"><h1 className="orders-heading">Orders &amp; sales</h1>{loading ? <LoadingIndicator label="Loading orders..."/> : error ? <p role="alert">{error}</p> : orders.length === 0 ? <p className="payments-intro">Your purchases and sales will appear here.</p> : <div className="orders-list">{orders.map(order => <Link href={`/checkout/success?order=${order.id}`} className="order-row order-row-with-breakdown" key={order.id}><div className="order-row-heading"><div><strong>{order.listing_title}</strong><span>{order.seller_id === user?.id ? "Sale" : "Purchase"} · {new Date(order.created_at).toLocaleDateString()}</span></div><strong>{formatPrice(order.amount_cents / 100)}</strong><span className={`order-status ${order.status}`}>{order.status}</span></div><PaymentBreakdown amountCents={order.amount_cents} feeCents={order.fee_cents} paid={order.status === "paid"} compact/></Link>)}</div>}<Link href="/" className="payment-back">Back to marketplace</Link></main>;
}
