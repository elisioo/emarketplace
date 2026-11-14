"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { isPublicAuthPath, requiresSeller } from "@/lib/auth";
import { LoadingIndicator } from "@/components/marketplace/loading";
import { Button } from "@/components/ui/button";

export function AuthGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, role, loading, roleLoading, error, reloadRole } = useAuth();
  const publicPath = isPublicAuthPath(path);
  useEffect(() => {
    if (publicPath || loading) return;
    if (!user) router.replace("/login");
    else if (!roleLoading && !error && !role) router.replace("/choose-role");
  }, [publicPath, loading, user, roleLoading, role, error, router]);
  if (publicPath) return children;
  if (loading || !user || roleLoading) return <main className="route-loading shell"><LoadingIndicator label="Checking your account..."/></main>;
  if (error) return <main className="auth-page"><div className="auth-card"><h1>Account unavailable</h1><p className="auth-intro" role="alert">{error}</p><Button onClick={reloadRole}>Try again</Button></div></main>;
  if (!role) return <main className="route-loading shell"><LoadingIndicator label="Setting up your account..."/></main>;
  if (requiresSeller(path) && role !== "seller") return <main className="auth-page"><div className="auth-card"><h1>Seller account required</h1><p className="auth-intro">Your account is registered as a buyer. Only sellers can create listings.</p><Button asChild><Link href="/">Browse products</Link></Button></div></main>;
  return children;
}
