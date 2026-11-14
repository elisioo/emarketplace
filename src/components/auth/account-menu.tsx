"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/marketplace/loading";

export function AccountMenu({ onNavigate }: { onNavigate: () => void }) {
  const { user, role, loading, error: sessionError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function logout() {
    setBusy(true); setError(null);
    try {
      const client = getSupabase();
      if (!client) throw new Error("Account services are unavailable.");
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      onNavigate();
    } catch { setError("Could not log out. Please try again."); }
    finally { setBusy(false); }
  }
  if (loading) return <div className="account-menu"><LoadingIndicator label="Loading account..."/></div>;
  return <div className="account-menu">
    {user ? <><p className="account-user">Logged in as <strong>{user.email}</strong></p><span className="account-role-badge">{role === "seller" ? "Seller account" : role === "buyer" ? "Buyer account" : "Account setup needed"}</span>{role === "seller" && <Link href="/create" onClick={onNavigate}>Create a listing</Link>}{role === "seller" && <Link href="/seller/payments" onClick={onNavigate}>Seller payments / Connect with Stripe</Link>}<Link href="/orders" onClick={onNavigate}>Orders &amp; sales</Link>{!role && <Link href="/choose-role" onClick={onNavigate}>Choose account type</Link>}<Button variant="outline" className="w-full" onClick={logout} disabled={busy}>{busy ? <LoadingIndicator label="Logging out..."/> : "Log out"}</Button></>
    : <><p>Welcome to Emarketplace. Log in or create an account to get started.</p><Button asChild className="w-full"><Link href="/login" onClick={onNavigate}>Log in</Link></Button><Button variant="outline" asChild className="w-full"><Link href="/signup" onClick={onNavigate}>Create account</Link></Button></>}
    {(error || sessionError) && <p className="form-error" role="alert">{error || sessionError}</p>}
  </div>;
}
