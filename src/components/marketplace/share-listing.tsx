"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";

export function ShareListing({ id }: { id: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const [url, setUrl] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (status === "manual") { manualInput.current?.focus(); manualInput.current?.select(); }
  }, [status]);

  async function copyLink() {
    const link = new URL(`/item/${encodeURIComponent(id)}`, window.location.origin).href;
    setUrl(link);
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(link);
      setStatus("copied");
      timer.current = setTimeout(() => setStatus("idle"), 3000);
    } catch {
      // Browser permissions or an insecure origin can block clipboard access.
      setStatus("manual");
    }
  }

  return <div className="listing-share">
    <button type="button" className={`listing-share-button ${status === "copied" ? "copied" : ""}`} onClick={copyLink} aria-label={status === "copied" ? "Listing link copied" : "Copy listing share link"} title="Copy listing link">
      {status === "copied" ? <Check size={19}/> : <Share2 size={19}/>}<span>{status === "copied" ? "Link copied!" : "Share"}</span>
    </button>
    <span className="sr-only" role="status">{status === "copied" ? "Listing link copied to clipboard." : status === "manual" ? "Copy the link from the field below." : ""}</span>
    {status === "manual" && <div className="share-manual"><label htmlFor="listing-share-url">Copy this listing link</label><input ref={manualInput} id="listing-share-url" readOnly value={url} onFocus={event => event.target.select()}/><button type="button" onClick={() => setStatus("idle")}>Close</button></div>}
  </div>;
}
