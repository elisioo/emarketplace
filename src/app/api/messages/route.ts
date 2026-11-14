import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { processSellerMessage, type MessageInput } from "@/lib/seller-messages";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let input: MessageInput;
  try {
    const body = await request.text();
    if (body.length > 8000) return NextResponse.json({ error: "Message is too large." }, { status: 413 });
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid message");
    input = parsed;
  } catch {
    return NextResponse.json({ error: "Invalid message request." }, { status: 400 });
  }

  const client = getSupabase();
  if (!client) return NextResponse.json({ error: "Messaging is temporarily unavailable." }, { status: 503 });

  const result = await processSellerMessage(input, {
    newId: () => crypto.randomUUID(),
    findListing: async id => {
      const { data, error } = await client.from("listings").select("id,title,seller_email").eq("id", id).maybeSingle();
      if (error) throw new Error("Listing lookup failed");
      return data;
    },
    saveMessage: async message => {
      const { error } = await client.from("messages").insert(message);
      if (error) throw new Error("Message save failed");
    },
    sendEmail: async email => {
      const key = process.env.RESEND_API_KEY;
      const from = process.env.RESEND_FROM_EMAIL;
      if (!key || !from) throw new Error("Email is not configured");
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": email.idempotencyKey },
        body: JSON.stringify({ from, to: [email.to], reply_to: email.replyTo, subject: email.subject, text: email.text }),
      });
      if (!response.ok) {
        // Log only the status, not email contents, credentials, or personal information.
        console.error("Seller email notification rejected by Resend", response.status);
        throw new Error("Email notification failed");
      }
    },
  });
  return NextResponse.json(result.body, { status: result.status });
}
