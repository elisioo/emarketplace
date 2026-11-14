"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingIndicator } from "@/components/marketplace/loading";
import { getSupabase } from "@/lib/supabase";
import { RoleChoice } from "@/components/auth/role-choice";
import type { AccountRole } from "@/lib/auth";
import { useAuth } from "@/components/auth/auth-provider";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const router = useRouter();
  const { user, loading, error: sessionError } = useAuth();
  const [role, setRole] = useState<AccountRole>("buyer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (signup && password !== confirmation) { setError("Your passwords do not match."); return; }
    const client = getSupabase();
    if (!client) { setError("Account services are unavailable. Please try again later."); return; }
    setBusy(true);
    try {
      if (signup) {
        const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: { role }, emailRedirectTo: `${window.location.origin}/auth/confirm` } });
        if (error) throw error;
        if (!data.session) { setConfirmationSent(true); setPassword(""); setConfirmation(""); return; }
      } else {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="auth-page auth-page-standalone auth-split-page"><div className={`auth-split-card ${signup ? "signup" : "login"}`}>
    <aside className="auth-welcome-panel" aria-label={signup ? "Welcome to Emarketplace" : "Join Emarketplace"}>
      <div className="auth-welcome-copy"><span className="auth-welcome-brand">Emarketplace</span><h2>{signup ? "Already part of the family?" : "Hello, Friend!"}</h2><p>{signup ? "Your next great find is waiting for you." : "Your marketplace journey starts here."}</p></div>
      <div className="auth-welcome-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={signup ? "/img/signup.png" : "/img/login.png"} alt={signup ? "Illustration of a buyer and seller at an online marketplace" : "Illustration of a shopper with a cart full of finds"}/>
      </div>
      <div className="auth-welcome-action"><p>{signup ? "Have an account? Welcome back." : "New here? Let's get you started."}</p><Link href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Sign up"}</Link></div>
    </aside>
    <section className="auth-form-panel" aria-labelledby="auth-form-heading">
    <h1 id="auth-form-heading">{signup ? "Create Account" : "Welcome Back!"}</h1>
    <p className="auth-intro">{signup ? "Join Emarketplace as a buyer or seller." : "Sign in to Emarketplace"}</p>
    {loading ? <LoadingIndicator label="Checking your session..."/> : confirmationSent ? <div className="auth-confirmation" role="status"><Mail size={30}/><h2>Check your email</h2><p>If your address is eligible, a confirmation link will arrive at <strong>{email}</strong>. Open it to finish signing up. Check Spam too.</p><Link href="/login">Go to login</Link></div>
    : user ? <div className="auth-confirmation"><CheckCircle2 size={28}/><p>You are logged in as <strong>{user.email}</strong>.</p><Button asChild><Link href="/">Continue browsing</Link></Button></div>
    : <form onSubmit={submit} aria-busy={busy}>
      {signup && <RoleChoice value={role} onChange={setRole} disabled={busy}/>}
      <div className="field"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy}/></div>
      <div className="field"><Label htmlFor="auth-password">Password</Label><div className="auth-password"><Input id="auth-password" type={showPassword ? "text" : "password"} required minLength={signup ? 8 : undefined} autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{signup && <p className="field-hint">Use at least 8 characters.</p>}</div>
      {signup && <div className="field"><Label htmlFor="auth-confirm-password">Confirm password</Label><Input id="auth-confirm-password" type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy}/></div>}
      {(error || sessionError) && <div className="form-error" role="alert">{error || sessionError}</div>}
      <Button className="w-full auth-submit" type="submit" disabled={busy}>{busy ? <LoadingIndicator label={signup ? "Creating account..." : "Logging in..."}/> : <>{signup ? "Create account" : "Sign in"}<ArrowRight size={17}/></>}</Button>
      <p className="auth-switch">{signup ? "Already have an account?" : "New to Emarketplace?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Sign up"}</Link></p>
    </form>}
    <p className="auth-guest-note">An account is required to access Emarketplace.</p>
    </section>
  </div></main>;
}
