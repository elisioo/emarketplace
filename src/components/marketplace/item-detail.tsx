"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleAlert, Clock3, Mail, MapPin, MessageSquareText, ShieldAlert, ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPrice, relativeTime, type Listing } from "@/lib/marketplace";
import { ItemDetailSkeleton } from "@/components/marketplace/loading";
import { LoadingImage } from "@/components/marketplace/loading-image";
import { WishlistButton } from "@/components/marketplace/wishlist-button";
import { ShareListing } from "@/components/marketplace/share-listing";
import { BuyNow } from "@/components/payments/buy-now";
import { useChat } from "@/components/chat/chat-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { getSupabase } from "@/lib/supabase";

export function ItemDetail({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { openListing } = useChat();
  const created = searchParams.get("created") === "1";
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    setListing(null);
    const client = getSupabase();
    if (!client) { setLoadError("Supabase isn't configured."); setLoading(false); return; }
    function load() {
      client!.from("listings").select("*").eq("id", id).single().then(({ data, error }) => {
        if (!active) return;
        if (error) setLoadError(error.code === "PGRST116" ? "This listing doesn't exist, or it was removed." : "The listing could not be loaded.");
        else { setListing(data as Listing); setLoadError(null); }
        setLoading(false);
      });
    }
    load();
    const channel = client.channel(`listing-${id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "listings", filter: `id=eq.${id}` }, load).subscribe();
    const refresh = () => { if (document.visibilityState === "visible") load(); };
    const timer = setInterval(refresh, 12000);
    window.addEventListener("focus", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); void client.removeChannel(channel); };

  }, [id]);

  return <main className="shell detail-shell">
    <div className="back-line"><Link href="/"><ArrowLeft size={16}/> Back to Marketplace</Link><span>ITEM DETAILS ✦</span></div>
    {loading ? <ItemDetailSkeleton/> : loadError ? <div className="empty-state error-state"><CircleAlert size={35}/><h2>Listing unavailable</h2><p>{loadError}</p><Button asChild><Link href="/">Browse other listings</Link></Button></div> : listing && <>
      {created && <div className="success-banner"><CheckCircle2 size={19}/> Your listing has been published! You can now share its link.</div>}
      <div className="detail-grid">
        <div className="detail-left">
          <div className="detail-photo">{listing.image_url ? <LoadingImage src={listing.image_url} alt={listing.title}/> : <div className="no-image"><ShoppingBag size={48}/>No photo</div>}</div>
          {listing.description && <Card className="description-panel"><h2>A little more about this find</h2><p>{listing.description}</p></Card>}
        </div>
        <aside className="detail-right">
          <div className="detail-top-row"><div className="detail-label"><Sparkles size={15}/> FOUND ON EMARKETPLACE</div><div className="detail-item-actions"><WishlistButton id={listing.id} title={listing.title}/><ShareListing key={listing.id} id={listing.id}/></div></div>
          <h1>{listing.title}</h1>
          <div className="detail-big-price">{formatPrice(Number(listing.price))}</div>
          <Badge>{listing.category}</Badge>
          <div className="detail-facts"><span><Clock3 size={16}/> {relativeTime(listing.created_at)}</span><span><MapPin size={16}/> {listing.location || "Location not provided"}</span></div>
          <div className="seller-card"><span className="seller-avatar">S</span><div><strong>Seller information</strong><span>{listing.seller_email}</span></div></div>
          <BuyNow listing={listing}/>
          <Card className="message-panel"><div className="message-panel-heading"><MessageSquareText size={20}/><div><h2>Message the seller</h2><p>Ask a question and chat right here.</p></div></div>
            {listing.seller_id === user?.id ? <p className="listing-chat-note">This is your listing. Buyer conversations appear under the Messages icon.</p>
              : listing.seller_id ? <><Button className="w-full" size="lg" onClick={() => openListing(listing)}><MessageSquareText size={18}/> Message Seller</Button><p className="listing-chat-note">Replies appear in your private chat. You can also choose email from the chat window.</p></>
              : <><p className="listing-chat-note">This older listing is not linked to a seller account yet. You can contact the seller by email.</p><Button variant="outline" className="w-full" asChild><a href={`mailto:${encodeURIComponent(listing.seller_email)}?subject=${encodeURIComponent(`About ${listing.title}`)}`}><Mail size={18}/> Email seller</a></Button></>}
          </Card>
          <p className="detail-safety"><ShieldAlert size={16}/> Avoid sharing passwords, payment details, or personal documents.</p>
        </aside>
      </div>
    </>}
  </main>;
}
