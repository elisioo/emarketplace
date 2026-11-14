"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { isAccountRole, type AccountRole } from "@/lib/auth";

const AuthContext = createContext<{ user: User | null; role: AccountRole | null; loading: boolean; roleLoading: boolean; error: string | null; reloadRole: () => void }>({ user: null, role: null, loading: true, roleLoading: true, error: null, reloadRole: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AccountRole | null>(null);
  const [roleUserId, setRoleUserId] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const client = getSupabase();
    if (!client) { setLoading(false); setError("Account services are unavailable. Please try again later."); return; }
    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) { setUser(session?.user ?? null); setLoading(false); }
    });
    client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      if (error) setError("Your session could not be restored. Please log in again.");
      setLoading(false);
    }).catch(() => {
      if (active) { setError("Account services could not be reached."); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) { setRole(null); setRoleUserId(null); setRoleLoading(false); return; }
    let active = true;
    setRoleLoading(true); setRole(null); setError(null);
    const client = getSupabase();
    if (!client) { setRoleLoading(false); setError("Account services are unavailable."); return; }
    Promise.resolve(client.from("profiles").select("role").eq("id", user.id).maybeSingle()).then(({ data, error }) => {
      if (!active) return;
      if (error) setError("Your account profile could not be loaded. Please retry. If this persists, the account database migration may be missing.");
      else setRole(isAccountRole(data?.role) ? data.role : null);
      setRoleUserId(user.id); setRoleLoading(false);
    }).catch(() => {
      if (active) { setRoleUserId(user.id); setRoleLoading(false); setError("Your account profile could not be loaded. Please retry."); }
    });
    return () => { active = false; };
  }, [user?.id, version]);

  return <AuthContext.Provider value={{ user, role: roleUserId === user?.id ? role : null, loading, roleLoading: !!user && (roleLoading || roleUserId !== user.id), error, reloadRole: () => setVersion(current => current + 1) }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
