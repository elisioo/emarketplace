"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/components/marketplace/wishlist-provider";

export function WishlistButton({ id, title, compact = false }: { id: string; title: string; compact?: boolean }) {
  const { ids, toggle, ready } = useWishlist();
  const saved = ids.includes(id);
  const label = `${saved ? "Remove" : "Save"} ${title} ${saved ? "from" : "to"} wishlist`;
  return <button type="button" className={`wishlist-button ${compact ? "compact" : ""} ${saved ? "saved" : ""}`} aria-label={label} aria-pressed={saved} title={label} disabled={!ready} onClick={() => toggle(id)}>
    <Heart size={19} fill={saved ? "currentColor" : "none"}/>{!compact && <span>{saved ? "Saved" : "Save"}</span>}
  </button>;
}
