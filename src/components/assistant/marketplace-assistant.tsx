"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { RotateCcw, Send, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useChat } from "@/components/chat/chat-provider";
import { getSupabase } from "@/lib/supabase";
import { isPublicAuthPath } from "@/lib/auth";
import { ASSISTANT_WELCOME, type AssistantTurn } from "@/lib/assistant";

type Turn = AssistantTurn & { id: string };
const welcome = (): Turn[] => [{ id: "welcome", role: "assistant", content: ASSISTANT_WELCOME }];
const suggestions = ["How do I buy an item?", "How do I start selling?", "Help me compare products"];
function BotAvatar({ className = "" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`bot-avatar ${className}`} src="/gif/bot.gif" alt="" width={44} height={44}/>;
}
function MessageText({ text }: { text: string }) {
  return <>{text.split(/(\/item\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi).map((part, index) => /^\/item\/[0-9a-f-]{36}$/i.test(part) ? <Link key={index} href={part}>View listing</Link> : <span key={index}>{part}</span>)}</>;
}
export function MarketplaceAssistant() {
  const { user, role } = useAuth();
  const { hasActiveChat, closeChat } = useChat();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>(welcome);
  const [owner, setOwner] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const requestId = useRef(0);
  useEffect(() => {
    controller.current?.abort(); requestId.current++;
    setOwner(user?.id ?? null); setTurns(welcome()); setText(""); setBusy(false); setError(null); setOpen(false);
  }, [user?.id]);
  useEffect(() => () => { controller.current?.abort(); requestId.current++; }, []);
  useEffect(() => { if (hasActiveChat) setOpen(false); }, [hasActiveChat]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => {
    if (open && followLatest.current) scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "auto" });
  }, [open, turns, busy, error]);

  function reset() {
    controller.current?.abort(); requestId.current++; controller.current = null;
    setTurns(welcome()); setText(""); setBusy(false); setError(null); followLatest.current = true; input.current?.focus();
  }
  function toggleOpen() {
    if (open) { setOpen(false); launcher.current?.focus(); }
    else { closeChat(); setOpen(true); }
  }
  async function send(value = text, retry = false) {
    if (controller.current || !user || !role) return;
    const content = value.trim();
    if (!retry && (!content || content.length > 1500)) return;
    const history = retry ? turns : [...turns, { id: crypto.randomUUID(), role: "user" as const, content }];
    if (history.at(-1)?.role !== "user") return;
    const ownRequest = ++requestId.current;
    const abort = new AbortController(); controller.current = abort;
    setTurns(history); setText(""); setError(null); setBusy(true); followLatest.current = true;
    try {
      const client = getSupabase();
      const session = await client?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Please log in again to continue chatting.");
      const listingId = pathname.match(/^\/item\/([0-9a-f-]{36})$/i)?.[1];
      // Limit context without storing or uploading private buyer-seller conversations.
      const messages = history.slice(-8).map(({ role, content }) => ({ role, content: content.slice(0, 1800) }));
      const response = await fetch("/api/assistant", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messages, listingId }), signal: abort.signal });
      const result = await response.json();
      if (ownRequest !== requestId.current) return;
      if (!response.ok || typeof result.reply !== "string") throw new Error(result.error || "The assistant couldn't respond. Please retry.");
      setTurns(current => [...current, { id: crypto.randomUUID(), role: "assistant", content: result.reply }]);
    } catch (error) {
      if (ownRequest === requestId.current && !abort.signal.aborted) setError(error instanceof Error ? error.message : "Something went wrong. Please retry.");
    } finally {
      if (ownRequest === requestId.current) { controller.current = null; setBusy(false); requestAnimationFrame(() => { if (open) input.current?.focus(); }); }
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(); }
  if (!user || !role || owner !== user.id || isPublicAuthPath(pathname)) return null;

  return <>
    {open && <section id="marketplace-assistant" className="assistant-panel" aria-labelledby="assistant-title" role="region" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); launcher.current?.focus(); } }}>
      <header className="assistant-header"><BotAvatar/><div><h2 id="assistant-title">Emarketplace Assistant</h2><p>AI shopping help</p></div><button type="button" aria-label="Start a new assistant conversation" title="New conversation" onClick={reset}><RotateCcw size={17}/></button><button type="button" aria-label="Close assistant" onClick={toggleOpen}><X size={20}/></button></header>
      <div className="assistant-messages" ref={scroll} role="log" aria-label="Assistant conversation" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={event => { const element = event.currentTarget; followLatest.current = element.scrollHeight - element.scrollTop - element.clientHeight < 60; }}>
        {turns.map(turn => <div key={turn.id} className={`assistant-message ${turn.role}`}>
          {turn.role === "assistant" && <BotAvatar/>}<div><span className="sr-only">{turn.role === "assistant" ? "Assistant: " : "You: "}</span><MessageText text={turn.content}/></div>
        </div>)}
        {turns.length === 1 && <div className="assistant-suggestions">{suggestions.map(question => <button key={question} type="button" onClick={() => void send(question)} disabled={busy}>{question}</button>)}</div>}
        {busy && <div className="assistant-message assistant"><BotAvatar/><div className="assistant-typing" role="status" aria-label="Assistant is thinking"><i/><i/><i/></div></div>}
        {error && <div className="assistant-error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => void send("", true)}>Try again</button></div>}
      </div>
      <form className="assistant-composer" onSubmit={submit} aria-busy={busy}><div><textarea ref={input} aria-label="Ask the Emarketplace assistant" placeholder="Ask me about Emarketplace..." value={text} onChange={event => setText(event.target.value)} rows={2} maxLength={1500} disabled={busy} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/><button type="submit" disabled={busy || !text.trim()} aria-label="Send to assistant"><Send size={19}/></button></div><p>AI replies may be inaccurate. For seller replies, use Messages.</p></form>
    </section>}
    <button ref={launcher} type="button" className={`assistant-launcher ${hasActiveChat ? "beside-chat" : ""} ${open ? "is-open" : ""}`} onClick={toggleOpen} aria-label={open ? "Close AI assistant" : "Open AI assistant"} aria-expanded={open} aria-controls="marketplace-assistant" title="Ask Emarketplace Assistant">
      {open ? <X size={25}/> : <BotAvatar/>}<span className="assistant-launcher-dot" aria-hidden="true"/>
    </button>
  </>;
}
