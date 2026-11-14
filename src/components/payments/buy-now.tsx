"use client";
import { useState } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/marketplace/loading";
import { paymentRequest } from "@/components/payments/payment-request";
import type { Listing } from "@/lib/marketplace";

export function BuyNow({ listing }: { listing: Listing }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function buy() {
    setBusy(true); setError(null);
    try { const result = await paymentRequest("/api/stripe/checkout", { listingId: listing.id }); window.location.assign(result.url); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not start checkout."); setBusy(false); }
  }
  if (listing.status === "sold") return <div className="purchase-panel"><span className="sold-label">Sold</span><p>This listing has already been purchased.</p></div>;
  if (listing.seller_id === user?.id) return <div className="purchase-panel"><p>{listing.payments_enabled ? "Your listing is ready for purchases." : "Complete Stripe setup to enable Buy Now on your listings."}</p>{!listing.payments_enabled && <Link href="/seller/payments">Set up seller payments</Link>}</div>;
  if (!listing.payments_enabled || !listing.seller_id || Number(listing.price) < .5 || Number(listing.price) > 999999.99) return <div className="purchase-panel"><p>{Number(listing.price) < .5 ? "Contact the seller to arrange this item." : "Online checkout is not available for this listing yet."}</p></div>;
  return <div className="purchase-panel"><Button className="w-full" size="lg" disabled={busy} onClick={buy}>{busy ? <LoadingIndicator label="Opening checkout..."/> : <><CreditCard size={18}/>{listing.status === "reserved" ? "Check availability / resume checkout" : "Buy Now"}</>}</Button><p>Secure Stripe Checkout. Sandbox payments only.</p>{error && <div className="form-error" role="alert">{error}</div>}</div>;
}
