"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { RoleChoice } from "@/components/auth/role-choice";
import { LoadingIndicator } from "@/components/marketplace/loading";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase";
import type { AccountRole } from "@/lib/auth";

export default function ChooseRolePage() {
  const { user, role, loading, roleLoading, error: profileError, reloadRole } = useAuth();
  const [choice, setChoice] = useState<AccountRole>("buyer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && !roleLoading && role) router.replace("/");
  }, [loading, user, roleLoading, role, router]);
  async function save() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const client = getSupabase();
      if (!client) throw new Error("Account services unavailable.");
      const { error } = await client.rpc("choose_account_role", { desired_role: choice });
      if (error) throw error;
      reloadRole();
    } catch { setError("Could not save your account type. Please retry and check that the account migration has been applied."); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-card"><h1>Choose your account type</h1><p className="auth-intro">Complete your existing account as a buyer or a seller. This choice is saved to your profile.</p>
    {loading || roleLoading || !user ? <LoadingIndicator label="Loading account..."/> : <><RoleChoice value={choice} onChange={setChoice} disabled={busy}/>{(error || profileError) && <p className="form-error" role="alert">{error || profileError}</p>}<Button className="w-full auth-submit" onClick={save} disabled={busy}>{busy ? <LoadingIndicator label="Saving account type..."/> : "Continue"}</Button></>}
  </div></main>;
}
