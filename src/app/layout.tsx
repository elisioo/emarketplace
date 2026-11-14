import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketplace/site-header";
import { ScrollbarVisibility } from "@/components/ui/scrollbar-visibility";
import { WishlistProvider } from "@/components/marketplace/wishlist-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AuthGate } from "@/components/auth/auth-gate";
import { ChatProvider } from "@/components/chat/chat-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emarketplace",
  description: "Discover, buy, and sell with your local community on Emarketplace.",
  icons: { icon: "/img/Emarketplace-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider><WishlistProvider><ChatProvider><ScrollbarVisibility/><SiteHeader /><AuthGate>{children}</AuthGate></ChatProvider></WishlistProvider></AuthProvider></body></html>;
}
