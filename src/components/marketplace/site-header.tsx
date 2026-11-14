"use client";

import { SentMessages } from "@/components/marketplace/sent-messages";
import { useState } from "react";
import Link from "next/link";
import { Bell, Mail, UserRound, X } from "lucide-react";

export function SiteHeader() {
  const [panel, setPanel] = useState<string | null>(null);
  return <header className="site-header"><div className="site-header-inner">
    <Link href="/" className="brand-link" aria-label="Emarketplace homepage">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/Emarketplace-logo.png" alt="" className="brand-logo" />
      <span className="brand-name">Emarketplace</span>
    </Link>
    <nav className="header-actions" aria-label="Account">
      {[{ name: "Messages", Icon: Mail }, { name: "Notifications", Icon: Bell }, { name: "Profile", Icon: UserRound }].map(({ name, Icon }) =>
        <button key={name} type="button" className={`header-icon ${panel === name ? "active" : ""}`} aria-label={name} title={name} aria-expanded={panel === name} aria-controls="account-panel" onClick={() => setPanel(panel === name ? null : name)}><Icon size={21} /></button>)}
    </nav>
    {panel && <section id="account-panel" className={`account-panel ${panel === "Messages" ? "messages-account-panel" : ""}`} aria-label={panel}>
      <div><h2>{panel}</h2><button type="button" aria-label="Close panel" onClick={() => setPanel(null)}><X size={18}/></button></div>
      <>{panel === "Messages" ? <SentMessages onNavigate={() => setPanel(null)}/> : <p>{panel === "Notifications" ? "You're all caught up. No notifications yet." : "Welcome to Emarketplace. Browse your community or create a listing to start selling."}</p>}</>
      {panel === "Profile" && <Link href="/create" onClick={() => setPanel(null)}>Create a listing</Link>}
    </section>}
  </div></header>;
}
