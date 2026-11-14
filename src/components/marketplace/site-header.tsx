"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { usePathname, useRouter } from "next/navigation";
import { AccountMenu } from "@/components/auth/account-menu";
import { ChatInbox } from "@/components/chat/chat-inbox";
import { useChat } from "@/components/chat/chat-provider";
import { useState } from "react";
import Link from "next/link";
import { Bell, Mail, UserRound, X } from "lucide-react";

export function SiteHeader() {
  const { user } = useAuth();
  const { unread } = useChat();
  const router = useRouter();
  const pathname = usePathname();
  const [panel, setPanel] = useState<string | null>(null);
  if (pathname === "/login" || pathname === "/signup") return null;
  return <header className="site-header"><div className="site-header-inner">
    <Link href="/" className="brand-link" aria-label="Emarketplace homepage">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/Emarketplace-logo.png" alt="" className="brand-logo" />
      <span className="brand-name">Emarketplace</span>
    </Link>
    <nav className="header-actions" aria-label="Account">
      {[{ name: "Messages", Icon: Mail }, { name: "Notifications", Icon: Bell }, { name: "Profile", Icon: UserRound }].map(({ name, Icon }) =>
        <button key={name} type="button" className={`header-icon ${panel === name ? "active" : ""}`} aria-label={name} title={name} aria-expanded={panel === name} aria-controls="account-panel" onClick={() => { if (!user && name !== "Profile") { router.push("/login"); return; } setPanel(panel === name ? null : name); }}><Icon size={21} />{user && name !== "Profile" && unread > 0 && <span className="header-unread-badge" aria-label={`${unread} unread messages`}>{unread > 99 ? "99+" : unread}</span>}</button>)}
    </nav>
    {panel && <section id="account-panel" className={`account-panel ${panel !== "Profile" ? "messages-account-panel" : ""}`} aria-label={panel}>
      <div><h2>{panel}</h2><button type="button" aria-label="Close panel" onClick={() => setPanel(null)}><X size={18}/></button></div>
      {panel === "Profile" ? <AccountMenu onNavigate={() => setPanel(null)}/> : <ChatInbox notifications={panel === "Notifications"} onOpen={() => setPanel(null)}/>}
    </section>}
  </div></header>;
}
