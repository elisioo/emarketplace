import { getStripe, marketplaceId } from "@/lib/stripe/server";
import { handleStripeEvent } from "@/lib/stripe/webhook";
export const runtime = "nodejs";
export async function GET() { return Response.json({ integration: "emarketplace-stripe-connect-v1", marketplaceId: marketplaceId(), mode: "sandbox" }); }
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret?.startsWith("whsec_")) return Response.json({ error: "Webhook signing is not configured." }, { status: 503 });
  let event;
  try { event = getStripe().webhooks.constructEvent(await request.text(), signature, secret); }
  catch { return Response.json({ error: "Invalid webhook signature." }, { status: 400 }); }
  if (event.livemode) return Response.json({ error: "Live-mode events are not accepted." }, { status: 400 });
  try { return Response.json(await handleStripeEvent(event)); }
  catch (error) { console.error("Stripe webhook processing failed", event.id, error instanceof Error ? error.name : "DatabaseError"); return Response.json({ error: "Webhook processing failed. Retry delivery." }, { status: 500 }); }
}
