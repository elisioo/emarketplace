"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getSupabase } from "@/lib/supabase";
import { conversationPeer, unreadTotal, type ChatTarget, type Conversation } from "@/lib/chat";
import type { Listing } from "@/lib/marketplace";
import { ChatWindow } from "@/components/chat/chat-window";
import { X, MessageCircle } from "lucide-react";

type ChatContextValue = {
  inbox: Conversation[]; unread: number; loading: boolean; error: string | null;
  hasActiveChat: boolean; closeChat: () => void;
  refresh: () => Promise<void>; openConversation: (conversation: Conversation) => void; openListing: (listing: Listing) => void;
};
const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [inbox, setInbox] = useState<Conversation[]>([]);
  const [owner, setOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ChatTarget | null>(null);
  const [notice, setNotice] = useState<Conversation | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const refreshAction = useRef<() => Promise<void>>(async () => {});
  const refresh = useCallback(() => refreshAction.current(), []);

  useEffect(() => {
    setInbox([]); setActive(null); setNotice(null); setError(null); setOwner(user?.id ?? null);
    if (!user || !role) { setLoading(false); return; }
    const client = getSupabase();
    if (!client) { setError("Chat is temporarily unavailable."); return; }
    let alive = true;
    let pending = false;
    let queued = false;
    let initialized = false;
    let known = new Map<string, string | null>();
    setLoading(true);
    async function load() {
      if (!alive || !client) return;
      if (pending) { queued = true; return; }
      pending = true;
      try {
        const { data, error } = await client.rpc("get_chat_inbox");
        if (!alive) return;
        if (error) throw error;
        const next = (data ?? []) as Conversation[];
        if (initialized) {
          const incoming = next.find(item => item.last_sender_id !== user!.id && Number(item.unread_count) > 0 && item.last_message_at !== known.get(item.id));
          if (incoming && !(activeRef.current?.conversationId === incoming.id && document.visibilityState === "visible" && document.hasFocus())) setNotice(incoming);
        }
        known = new Map(next.map(item => [item.id, item.last_message_at]));
        initialized = true;
        setInbox(next); setError(null);
      } catch { if (alive) setError("Chat could not be loaded. Please try again."); }
      finally {
        pending = false;
        if (alive) { setLoading(false); if (queued) { queued = false; void load(); } }
      }
    }
    refreshAction.current = load;
    void load();
    const channel = client.channel(`inbox-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `sender_id=eq.${user.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `buyer_id=eq.${user.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `seller_id=eq.${user.id}` }, () => void load())
      .subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    const interval = setInterval(onVisible, 8000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      alive = false; refreshAction.current = async () => {};
      clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible);
      void client.removeChannel(channel);
    };
  }, [user?.id, role]);

  const ownInbox = owner === user?.id ? inbox : [];
  function openConversation(conversation: Conversation) {
    if (!user) return;
    setActive({ windowKey: `conversation:${conversation.id}`, conversationId: conversation.id, listingId: conversation.listing_id, title: conversation.listing_title, peerEmail: conversationPeer(conversation, user.id) });
    setNotice(null);
  }
  function openListing(listing: Listing) {
    if (!user || !listing.seller_id || listing.seller_id === user.id) return;
    const existing = ownInbox.find(item => item.listing_id === listing.id && item.buyer_id === user.id);
    if (existing) openConversation(existing);
    else setActive({ windowKey: `listing:${listing.id}`, listingId: listing.id, title: listing.title, peerEmail: listing.seller_email });
  }
  return <ChatContext.Provider value={{ inbox: ownInbox, unread: unreadTotal(ownInbox), loading, error, refresh, openConversation, openListing, hasActiveChat: !!active && owner === user?.id, closeChat: () => setActive(null) }}>
    {children}
    {user && role && owner === user.id && active && <ChatWindow key={active.windowKey} target={active} onClose={() => setActive(null)} onSaved={conversationId => setActive(current => current ? { ...current, conversationId } : current)} />}
    {user && owner === user.id && notice && <aside className="chat-toast" aria-label="New message" role="status"><MessageCircle size={22}/><button className="chat-toast-content" type="button" onClick={() => openConversation(notice)}><strong>New message about {notice.listing_title}</strong><span>{notice.last_message}</span><small>Open conversation</small></button><button type="button" className="chat-icon-button" aria-label="Dismiss message notification" onClick={() => setNotice(null)}><X size={16}/></button></aside>}
  </ChatContext.Provider>;
}
export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error("ChatProvider is required");
  return value;
}
