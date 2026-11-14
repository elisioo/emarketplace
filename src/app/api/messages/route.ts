import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { processSellerMessage, type MessageInput, type SavedChat } from "@/lib/seller-messages";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Please log in to message a seller." }, { status: 401 });
  const client = getSupabase(token);
  if (!client) return NextResponse.json({ error: "Messaging is temporarily unavailable." }, { status: 503 });
  let user;
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user?.email) return NextResponse.json({ error: "Your session expired. Please log in again." }, { status: 401 });
    user = data.user;
    const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) return NextResponse.json({ error: "Your account profile could not be loaded." }, { status: 503 });
    if (!profile?.role) return NextResponse.json({ error: "Choose your account type before sending messages." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Account verification is unavailable. Please try again." }, { status: 503 });
  }
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

  const result = await processSellerMessage(input, {
    saveMessage: async message => {
      const { data, error } = await client.rpc("send_chat_message", {
        p_message_id: message.messageId, p_message: message.message,
        p_conversation_id: message.conversationId, p_listing_id: message.listingId,
      });
      if (error) throw error;
      return data as SavedChat;
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
