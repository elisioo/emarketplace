"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Mail, Send, X, MessageCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useChat } from "@/components/chat/chat-provider";
import { getSupabase } from "@/lib/supabase";
import { mergeChatMessages, type ChatMessage, type ChatTarget } from "@/lib/chat";
import { LoadingIndicator } from "@/components/marketplace/loading";

export function ChatWindow({ target, onClose, onSaved }: { target: ChatTarget; onClose: () => void; onSaved: (id: string) => void }) {
  const { user } = useAuth();
  const { refresh } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(!!target.conversationId);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [text, setText] = useState("");
  const [email, setEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const retry = useRef<{ text: string; id: string } | null>(null);
  const currentMessages = useRef(messages);
  currentMessages.current = messages;
  const marked = useRef(new Set<string>());
  const oldLength = useRef(0);
  const followLatest = useRef(true);
  const markVisible = useRef<() => void>(() => {});
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; composer.current?.focus(); return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (messages.length > oldLength.current && !loadingOlder && followLatest.current) scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "auto" });
    oldLength.current = messages.length;
  }, [messages.length, loadingOlder]);

  useEffect(() => {
    if (!target.conversationId || !user) return;
    const client = getSupabase();
    if (!client) return;
    let alive = true;
    let pending = false;
    let queued = false;
    async function markRead(rows: ChatMessage[]) {
      if (!alive || !client || document.visibilityState !== "visible" || !document.hasFocus()) return;
      if (!followLatest.current) return;
      const ids = rows.filter(item => item.recipient_id === user!.id && !item.read_at && !marked.current.has(item.id)).map(item => item.id);
      if (!ids.length) return;
      ids.forEach(id => marked.current.add(id));
      const { error } = await client.rpc("mark_chat_read", { p_message_ids: ids });
      if (error) ids.forEach(id => marked.current.delete(id));
      else if (alive) { setMessages(current => current.map(item => ids.includes(item.id) ? { ...item, read_at: new Date().toISOString() } : item)); void refresh(); }
    }
    markVisible.current = () => { void markRead(currentMessages.current); };
    async function load() {
      if (!client || !alive) return;
      if (pending) { queued = true; return; }
      pending = true;
      try {
        const { data, error } = await client.from("messages").select("id,conversation_id,sender_id,recipient_id,message,created_at,read_at")
          .eq("conversation_id", target.conversationId!).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50);
        if (!alive) return;
        if (error) throw error;
        const rows = (data ?? []) as ChatMessage[];
        setMessages(current => mergeChatMessages(current, rows));
        if (currentMessages.current.length === 0) setHasOlder(rows.length === 50);
        setError(null);
        await markRead(rows);
      } catch { if (alive) setError("Messages could not be loaded. Try again."); }
      finally { pending = false; if (alive) { setLoading(false); if (queued) { queued = false; void load(); } } }
    }
    void load();
    const channel = client.channel(`conversation-${target.conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${target.conversationId}` }, () => void load()).subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") { void load(); void markRead(currentMessages.current); } };
    const timer = setInterval(onVisible, 6000);
    document.addEventListener("visibilitychange", onVisible); window.addEventListener("focus", onVisible);
    return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); void client.removeChannel(channel); };
  }, [target.conversationId, user?.id, revision, refresh]);

  async function older() {
    const first = messages[0];
    const client = getSupabase();
    if (!first || !client || loadingOlder) return;
    setLoadingOlder(true);
    const height = scroll.current?.scrollHeight ?? 0;
    try {
      const { data, error } = await client.from("messages").select("id,conversation_id,sender_id,recipient_id,message,created_at,read_at").eq("conversation_id", target.conversationId!)
        .or(`created_at.lt.${first.created_at},and(created_at.eq.${first.created_at},id.lt.${first.id})`).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50);
      if (error) throw error;
      setMessages(current => mergeChatMessages(current, (data ?? []) as ChatMessage[]));
      setHasOlder((data?.length ?? 0) === 50);
      requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight - height; });
    } catch { setError("Earlier messages could not be loaded."); }
    finally { setLoadingOlder(false); }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body || body.length > 1500 || sending) return;
    setSending(true); setError(null); setStatus("");
    if (!retry.current || retry.current.text !== body) retry.current = { text: body, id: crypto.randomUUID() };
    try {
      const client = getSupabase();
      const session = await client?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Please log in again before sending.");
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: target.conversationId, listingId: target.listingId, messageId: retry.current.id, message: body, notifyByEmail: email }) });
      const result = await response.json();
      if (!mounted.current) return;
      if (!response.ok || !result.saved) throw new Error(result.error || "Message could not be sent. Please try again.");
      setText(""); retry.current = null;
      setStatus(result.emailStatus === "failed" ? "Sent in chat. The optional email notification failed." : result.emailStatus === "sent" ? "Sent in chat. Email notification accepted." : "Sent in chat.");
      onSaved(result.conversationId); setRevision(current => current + 1); void refresh();
      composer.current?.focus();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not send. Please retry."); }
    finally { setSending(false); requestAnimationFrame(() => { if (mounted.current) composer.current?.focus(); }); }
  }

  return <section className="chat-window" role="region" aria-label={`Chat about ${target.title}`} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <header className="chat-window-header"><span className="chat-avatar"><MessageCircle size={22}/></span><div><strong>{target.peerEmail}</strong><span>{target.title}</span></div><a className="chat-icon-button" href={`mailto:${encodeURIComponent(target.peerEmail)}?subject=${encodeURIComponent(`About ${target.title} on Emarketplace`)}`} aria-label={`Email ${target.peerEmail}`} title="Contact by email"><Mail size={18}/></a><button className="chat-icon-button" type="button" aria-label="Close chat" onClick={onClose}><X size={20}/></button></header>
    {target.listingId && <Link className="chat-listing-link" href={`/item/${target.listingId}`}>View listing: {target.title}</Link>}
    <div className="chat-message-scroll" ref={scroll} role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions text" tabIndex={0} onScroll={event => {
      const element = event.currentTarget;
      followLatest.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
      if (followLatest.current) markVisible.current();
    }}>
      {loading ? <div className="chat-empty"><LoadingIndicator label="Loading conversation..."/></div> : <>
        {hasOlder && <button type="button" className="chat-load-older" disabled={loadingOlder} onClick={older}>{loadingOlder ? "Loading..." : "Load earlier messages"}</button>}
        {messages.length === 0 && <div className="chat-empty"><MessageCircle size={32}/><strong>Start the conversation</strong><p>Ask about the listing and get replies right here.</p></div>}
        {messages.map(item => <div key={item.id} className={`chat-message ${item.sender_id === user?.id ? "outgoing" : "incoming"}`}><div>{item.message}</div><span><span className="sr-only">{item.sender_id === user?.id ? "You, " : "Other participant, "}</span>{new Date(item.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{item.sender_id === user?.id && item.read_at ? " · Seen" : ""}</span></div>)}
      </>}
    </div>
    {error && <div className="chat-error" role="alert">{error} <button type="button" onClick={() => setRevision(current => current + 1)}>Refresh</button></div>}
    <form className="chat-composer" onSubmit={send} aria-busy={sending}>
      <label className="chat-email-option"><input type="checkbox" checked={email} onChange={event => setEmail(event.target.checked)} disabled={sending}/>Also notify by email</label>
      <div><textarea ref={composer} aria-label="Message" placeholder="Write a message..." value={text} onChange={event => setText(event.target.value)} maxLength={1500} rows={2} disabled={sending}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/><button type="submit" aria-label="Send message" disabled={sending || !text.trim()}>{sending ? <LoadingIndicator label=""/> : <Send size={20}/>}</button></div>
      <span className="chat-send-status" role="status">{status || `${text.length}/1500 · Enter to send, Shift+Enter for a new line`}</span>
    </form>
  </section>;
}
