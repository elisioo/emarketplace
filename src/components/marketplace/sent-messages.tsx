"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, ArrowUpRight } from "lucide-react";
import { clearSentMessages, readSentMessages, SENT_MESSAGES_CHANGED, type SentMessage } from "@/lib/sent-messages";

export function SentMessages({ onNavigate }: { onNavigate: () => void }) {
  const [messages, setMessages] = useState<SentMessage[]>([]);
  useEffect(() => {
    const refresh = () => setMessages([...readSentMessages()]);
    refresh();
    window.addEventListener(SENT_MESSAGES_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(SENT_MESSAGES_CHANGED, refresh); window.removeEventListener("storage", refresh); };
  }, []);

  return <div className="sent-messages">
    <p className="sent-history-note">Sent from this browser. Replies arrive in your email inbox. History is visible to anyone using this browser.</p>
    {messages.length === 0 ? <div className="sent-messages-empty"><Mail size={28}/><strong>No sent messages yet</strong><p>Open a listing and message the seller. Messages sent from now on will appear here.</p></div>
    : <><div className="sent-messages-toolbar"><span>{messages.length} sent {messages.length === 1 ? "message" : "messages"}</span><button type="button" onClick={clearSentMessages}>Clear local history</button></div>
      <ul className="sent-message-list">{messages.map(item => <li key={item.id}>
        <Link href={`/item/${item.listingId}`} onClick={onNavigate}>{item.listingTitle}<ArrowUpRight size={15}/></Link>
        <div className="sent-message-recipient">To: {item.sellerEmail}</div>
        <p className="sent-message-body">{item.message}</p>
        <div className="sent-message-from">From: {item.buyerEmail}</div>
        <div className="sent-message-meta"><time dateTime={item.sentAt}>{new Date(item.sentAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time><span className={item.emailStatus === "sent" ? "email-accepted" : "email-failed"}>{item.emailStatus === "sent" ? "Email accepted" : "Saved; email failed"}</span></div>
      </li>)}</ul><p className="sent-history-note">Up to 100 messages are kept on this device. Clearing history does not delete messages saved in Emarketplace.</p></>}
  </div>;
}
