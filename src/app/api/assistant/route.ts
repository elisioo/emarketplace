import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { getSupabase } from "@/lib/supabase";
import { assistantInstructions, parseAssistantRequest } from "@/lib/assistant";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return Response.json({ error: "Please log in to chat with the assistant." }, { status: 401 });
  const client = getSupabase(token);
  if (!client) return Response.json({ error: "The assistant is temporarily unavailable." }, { status: 503 });
  let body;
  try {
    const text = await request.text();
    if (text.length > 24000) return Response.json({ error: "This conversation is too long. Start a new chat." }, { status: 413 });
    body = parseAssistantRequest(JSON.parse(text));
  } catch { return Response.json({ error: "Please enter a valid message." }, { status: 400 }); }
  if (!body) return Response.json({ error: "Please enter a valid message, or start a new conversation." }, { status: 400 });
  try {
    const { data: auth, error: authError } = await client.auth.getUser(token);
    if (authError || !auth.user) return Response.json({ error: "Your session expired. Please log in again." }, { status: 401 });
    const fields = "id,title,price,category,location,status";
    const [profile, catalog, current] = await Promise.all([
      client.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
      client.from("listings").select(fields).eq("status", "available").order("created_at", { ascending: false }).limit(12),
      body.listingId ? client.from("listings").select(fields).eq("id", body.listingId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (profile.error) return Response.json({ error: "Your account could not be verified. Please try again." }, { status: 503 });
    if (!profile.data?.role) return Response.json({ error: "Choose your account type before using the assistant." }, { status: 403 });
    const key = process.env.GROQ_API_KEY || process.env.GROQ_API;
    if (!key) return Response.json({ error: "The assistant is not available right now. Please try again later." }, { status: 503 });
    const groq = createGroq({ apiKey: key });
    const result = await generateText({
      model: groq(process.env.GROQ_MODEL || "openai/gpt-oss-20b"),
      instructions: assistantInstructions(catalog.data ?? [], current.data, !catalog.error),
      messages: body.messages,
      maxOutputTokens: 1200,
      providerOptions: { groq: { reasoningEffort: "low" } },
      timeout: 20000,
      abortSignal: request.signal,
      maxRetries: 1,
    });
    if (!result.text.trim()) throw new Error("Empty reply");
    return Response.json({ reply: result.text.trim() });
  } catch (error) {
    // Never log credentials, user chat content, or provider request bodies.
    console.error("Marketplace assistant request failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "I couldn't respond just now. Please try again in a moment." }, { status: 503 });
  }
}
