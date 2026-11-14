"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Clock3, Mail, MapPin, MessageSquareText, ShieldAlert, ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPrice, relativeTime, validateEmail, type Listing } from "@/lib/marketplace";
import { ItemDetailSkeleton, LoadingIndicator } from "@/components/marketplace/loading";
import { LoadingImage } from "@/components/marketplace/loading-image";
import { WishlistButton } from "@/components/marketplace/wishlist-button";
import { ShareListing } from "@/components/marketplace/share-listing";
import { rememberSentMessage } from "@/lib/sent-messages";
import { getSupabase } from "@/lib/supabase";

export function ItemDetail({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const created = searchParams.get("created") === "1";
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"sent" | "failed" | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    setListing(null);
    const client = getSupabase();
    if (!client) { setLoadError("Supabase isn't configured."); setLoading(false); return; }
    client.from("listings")
      .select("id,title,description,price,category,seller_email,image_url,location,created_at,updated_at")
      .eq("id", id).single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setLoadError(error.code === "PGRST116" ? "This listing doesn't exist, or it was removed." : error.message);
        else setListing(data as Listing);
        setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!listing || sending || sent) return;
    setMessageError(null);
    if (!validateEmail(buyerEmail)) { setMessageError("Please enter a valid email address."); return; }
    if (!message.trim() || message.trim().length > 1500) { setMessageError("Enter a message between 1 and 1,500 characters."); return; }
    setSending(true);
    setEmailStatus(null);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id, buyerEmail: buyerEmail.trim(), message: message.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.saved) throw new Error(result.error || "Could not send your message. Please try again.");
      setEmailStatus(result.emailStatus === "sent" ? "sent" : "failed");
      rememberSentMessage({
        id: crypto.randomUUID(), listingId: listing.id, listingTitle: listing.title,
        sellerEmail: listing.seller_email, buyerEmail: buyerEmail.trim(), message: message.trim(),
        sentAt: new Date().toISOString(), emailStatus: result.emailStatus === "sent" ? "sent" : "failed",
      });
      setSent(true);
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

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
          <Card className="message-panel"><div className="message-panel-heading"><MessageSquareText size={20}/><div><h2>Message the seller</h2><p>Have a question? Say hello.</p></div></div>
            {sent ? <div className="message-success" role="status"><CheckCircle2 size={24}/><strong>{emailStatus === "sent" ? "Message sent!" : "Message saved"}</strong><p>{emailStatus === "sent" ? "Your message was saved and the seller email notification was accepted. The seller can reply to your email directly." : "Your message was saved, but the email notification could not be sent. Please contact the seller directly using the email shown above."}</p><Button variant="outline" className="w-full" onClick={()=>{setSent(false);setMessage("");}}>Write another message</Button></div>
            : <form onSubmit={sendMessage} className="message-form">
                <Label htmlFor="buyer-email">Your email <span className="required">*</span></Label><Input id="buyer-email" type="email" required autoComplete="email" placeholder="you@example.com" value={buyerEmail} onChange={(e)=>setBuyerEmail(e.target.value)}/>
                <Label htmlFor="buyer-message">Your message <span className="required">*</span></Label><Textarea id="buyer-message" required maxLength={1500} rows={5} placeholder={`Hi! Is ${listing.title} still available?`} value={message} onChange={(e)=>setMessage(e.target.value)}/>
                <p className="field-hint">{message.length}/1500 characters</p>
                {messageError && <div className="form-error" role="alert"><CircleAlert size={16}/>{messageError}</div>}
                <Button className="w-full" size="lg" type="submit" disabled={sending}>{sending ? <LoadingIndicator label="Sending message..."/> : <>Send message <ArrowRight size={17}/></>}</Button>
              </form>}
          </Card>
          <p className="detail-safety"><ShieldAlert size={16}/> Avoid sharing passwords, payment details, or personal documents.</p>
        </aside>
      </div>
    </>}
  </main>;
}
