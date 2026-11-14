"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { parseWishlist, toggleWishlist, WISHLIST_KEY } from "@/lib/wishlist";

const WishlistContext = createContext<{ ids: string[]; ready: boolean; persistent: boolean; toggle: (id: string) => void } | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  useEffect(() => {
    try { setIds(parseWishlist(localStorage.getItem(WISHLIST_KEY))); } catch { setPersistent(false); }
    setReady(true);
    function sync(event: StorageEvent) {
      if (event.key === WISHLIST_KEY || event.key === null) {
        try { setIds(parseWishlist(localStorage.getItem(WISHLIST_KEY))); } catch { setPersistent(false); }
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function toggle(id: string) {
    if (!ready) return;
    const next = toggleWishlist(ids, id);
    setIds(next);
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(next)); setPersistent(true); }
    catch { setPersistent(false); }
  }
  return <WishlistContext.Provider value={{ ids, ready, persistent, toggle }}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("WishlistProvider is required");
  return value;
}
