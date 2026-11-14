"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CheckCircle2, CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/marketplace/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { paymentRequest } from "@/components/payments/payment-request";

type Status = { connected: boolean; ready: boolean; accountId?: string; chargesEnabled?: boolean; payoutsEnabled?: boolean; detailsSubmitted?: boolean; currentlyDue?: string[] };
export function SellerPayments() {
  const { role } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setStatus(await paymentRequest("/api/stripe/connect")); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not load payment status."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (role === "seller") void refresh(); else setLoading(false); }, [role, refresh]);
  async function connect() {
    setBusy(true); setError(null);
    try { const result = await paymentRequest("/api/stripe/connect", {}); window.location.assign(result.url); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not open Stripe onboarding."); setBusy(false); }
  }
  return <main className="shell payments-page"><Link href="/" className="payment-back">Back to marketplace</Link><div className="payments-card">
    <span className="payment-hero-icon"><CreditCard size={28}/></span><span className="sandbox-badge">Stripe sandbox</span><h1>Get ready to sell</h1><p className="payments-intro">Connect your seller account with Stripe to accept test payments on your listings.</p>
    {role !== "seller" ? <p className="form-error">A seller account is required to connect with Stripe.</p> : loading ? <LoadingIndicator label="Checking Stripe account..."/> : <>
      {status?.ready ? <div className="payment-ready"><CheckCircle2 size={23}/><div><strong>Your account is ready</strong><p>Buyers can now purchase your available listings.</p></div></div> : <div className="payment-setup-note"><ShieldCheck size={22}/><p>{status?.connected ? "Your account is connected. Complete the remaining Stripe requirements to enable purchases." : "Stripe hosts the onboarding form. Use sandbox identity and bank details; no real money moves."}</p></div>}
      {status?.connected && <><div className="stripe-status-grid"><span>Account details <strong>{status.detailsSubmitted ? "Submitted" : "Needed"}</strong></span><span>Payments <strong>{status.chargesEnabled ? "Enabled" : "Pending"}</strong></span><span>Payouts <strong>{status.payoutsEnabled ? "Enabled" : "Pending"}</strong></span></div><p className="payment-account-id">Connected account: {status.accountId}</p></>}
      <div className="payments-actions"><Button onClick={connect} disabled={busy}>{busy ? <LoadingIndicator label="Opening Stripe..."/> : <>{status?.ready ? "Review Stripe setup" : status?.connected ? "Continue Stripe onboarding" : "Connect with Stripe"}<ExternalLink size={16}/></>}</Button><Button variant="outline" disabled={busy} onClick={() => void refresh()}>Refresh status</Button></div>
      {status?.ready && <Link href="/create" className="payment-create-link">Create a listing</Link>}
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="payment-fee-note"><h2>How payments work</h2><p>A $100.00 sale includes a $10.00 platform fee. The remaining $90.00 goes to your connected Stripe balance before Stripe processing fees.</p><p>Use sandbox identity and bank details for the account country shown by Stripe. Test payments only.</p></div>
  </div></main>;
}
