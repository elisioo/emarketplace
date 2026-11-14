"use client";
import { getSupabase } from "@/lib/supabase";
export async function paymentRequest(path: string, body?: unknown) {
  const client = getSupabase();
  const session = await client?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("Please log in before continuing.");
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Payments are unavailable. Please try again.");
  return result;
}
