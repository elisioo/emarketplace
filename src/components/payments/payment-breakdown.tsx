import { formatPrice } from "@/lib/marketplace";

export function PaymentBreakdown({ amountCents, feeCents, paid, compact = false }: { amountCents: number; feeCents: number; paid: boolean; compact?: boolean }) {
  return <section className={`payment-breakdown ${compact ? "compact" : ""}`} aria-label="Payment breakdown">
    <h2>{paid ? "Payment breakdown" : "Expected payment breakdown"}</h2>
    <dl>
      <div><dt>Sale total</dt><dd>{formatPrice(amountCents / 100)}</dd></div>
      <div><dt>Platform fee (10%)</dt><dd>{formatPrice(feeCents / 100)}</dd></div>
      <div className="seller-share"><dt>Seller share</dt><dd>{formatPrice((amountCents - feeCents) / 100)}</dd></div>
    </dl>
    <p>Seller share is before Stripe processing fees and currency conversion.</p>
  </section>;
}
