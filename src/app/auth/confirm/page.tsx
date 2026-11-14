"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { LoadingIndicator } from "@/components/marketplace/loading";
import { Button } from "@/components/ui/button";

export default function ConfirmPage() {
  const { user, loading, error } = useAuth();
  return <main className="auth-page"><div className="auth-card"><h1>{loading ? "Confirming your account" : user ? "You're logged in" : "Finish signing in"}</h1>
    {loading ? <LoadingIndicator label="Checking confirmation..."/> : <><p className="auth-intro">{user ? "Your account is ready. Welcome to Emarketplace." : error || "If your email was confirmed, log in to continue. If the link expired, return to signup and try again."}</p><Button asChild><Link href={user ? "/" : "/login"}>{user ? "Browse marketplace" : "Log in"}</Link></Button></>}
  </div></main>;
}
