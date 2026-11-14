export const PLATFORM_FEE_PERCENT = 10;
export const MIN_PAYMENT_CENTS = 50;
export const MAX_PAYMENT_CENTS = 99999999;
export type PaymentOrder = {
  id: string; listing_id: string; buyer_id: string; seller_id: string;
  buyer_email: string; listing_title: string; stripe_account_id: string;
  amount_cents: number; fee_cents: number; currency: string;
  status: "pending" | "paid" | "expired"; stripe_session_id: string | null;
  checkout_expires_at: string; created_at: string; paid_at: string | null;
};
export function priceToCents(value: number | string): number {
  const price = Number(value);
  const cents = Math.round(price * 100);
  if (!Number.isFinite(price) || !Number.isSafeInteger(cents) || cents < MIN_PAYMENT_CENTS || cents > MAX_PAYMENT_CENTS) throw new Error("Card payments require a price between $0.50 and $999,999.99.");
  return cents;
}
export function applicationFee(cents: number): number { return Math.round(cents * PLATFORM_FEE_PERCENT / 100); }
export function checkoutMatchesOrder(session: { id: string; payment_status: string; mode?: string | null; amount_total: number | null; currency: string | null; metadata: Record<string, string> | null }, order: PaymentOrder, accountId: string, marketplaceId: string): boolean {
  return session.mode === "payment" && session.payment_status === "paid"
    && session.metadata?.marketplace_id === marketplaceId && session.metadata?.order_id === order.id
    && order.stripe_account_id === accountId && (!order.stripe_session_id || order.stripe_session_id === session.id)
    && session.amount_total === order.amount_cents && session.currency === order.currency;
}
