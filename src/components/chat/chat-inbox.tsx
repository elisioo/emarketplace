"use client";

import { MessageCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useChat } from "@/components/chat/chat-provider";
import { conversationPeer } from "@/lib/chat";
import { LoadingIndicator } from "@/components/marketplace/loading";

export function ChatInbox({ notifications = false, onOpen }: { notifications?: boolean; onOpen: () => void }) {
  const { user } = useAuth();
  const { inbox, loading, error, refresh, openConversation } = useChat();
  const rows = notifications ? inbox.filter(item => Number(item.unread_count) > 0) : inbox;
  return <div className="chat-inbox">
    <p className="chat-inbox-note">{notifications ? "Unread messages from your marketplace conversations." : "Your private buyer and seller conversations."}</p>
    {loading ? <div className="chat-empty"><LoadingIndicator label="Loading messages..."/></div> : error ? <div className="chat-inbox-error" role="alert"><p>{error}</p><button type="button" onClick={() => void refresh()}>Try again</button></div> : rows.length === 0 ? <div className="chat-empty"><MessageCircle size={29}/><strong>{notifications ? "You're all caught up" : "No conversations yet"}</strong><p>{notifications ? "New messages will appear here." : "Open a listing and select Message Seller to start a chat."}</p></div> :
      <ul className="chat-inbox-list">{rows.map(item => <li key={item.id}><button type="button" className={Number(item.unread_count) > 0 ? "unread" : ""} onClick={() => { openConversation(item); onOpen(); }}>
        <span className="chat-avatar"><MessageCircle size={20}/></span><span className="chat-inbox-preview"><strong>{item.listing_title}</strong><span>{user ? conversationPeer(item, user.id) : ""}</span><p>{item.last_sender_id === user?.id ? "You: " : ""}{item.last_message || "Start a conversation"}</p></span>
        <span className="chat-inbox-side">{item.last_message_at && <time dateTime={item.last_message_at}>{new Date(item.last_message_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>}{Number(item.unread_count) > 0 && <span className="chat-unread-count">{Number(item.unread_count) > 99 ? "99+" : item.unread_count}</span>}</span>
      </button></li>)}</ul>}
  </div>;
}
