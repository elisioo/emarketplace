import { paymentFailure, requirePaymentUser, requireUuid } from "@/lib/stripe/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { client } = await requirePaymentUser(request);
    const id = new URL(request.url).searchParams.get("order");
    let query = client.from("orders").select("id,listing_id,listing_title,buyer_id,seller_id,amount_cents,fee_cents,currency,status,created_at,paid_at").order("created_at", { ascending: false });
    if (id) query = query.eq("id", requireUuid(id));
    const { data, error } = await query.limit(50);
    if (error) throw error;
    return Response.json({ orders: data ?? [] });
  } catch (error) { return paymentFailure(error); }
}
