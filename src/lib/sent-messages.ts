"use client";

export type SentMessage = {
  id: string;
  listingId: string;
  listingTitle: string;
  sellerEmail: string;
  buyerEmail: string;
  message: string;
  sentAt: string;
  emailStatus: "sent" | "failed";
};
const storageKey = "emarketplace.sent-messages.v1";
export const SENT_MESSAGES_CHANGED = "emarketplace:sent-messages-changed";
let memory: SentMessage[] = [];
let storageUnavailable = false;

export function readSentMessages(): SentMessage[] {
  if (storageUnavailable) return memory;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(parsed)) return memory;
    memory = parsed.filter((item): item is SentMessage => !!item && typeof item === "object"
      && ["id", "listingId", "listingTitle", "sellerEmail", "buyerEmail", "message", "sentAt"].every(key => typeof item[key] === "string")
      && Number.isFinite(Date.parse(item.sentAt)) && (item.emailStatus === "sent" || item.emailStatus === "failed")).slice(0, 100);
    return memory;
  } catch { storageUnavailable = true; return memory; }
}

export function rememberSentMessage(message: SentMessage) {
  memory = [message, ...readSentMessages().filter(item => item.id !== message.id)].slice(0, 100);
  try { localStorage.setItem(storageKey, JSON.stringify(memory)); storageUnavailable = false; } catch { storageUnavailable = true; }
  window.dispatchEvent(new Event(SENT_MESSAGES_CHANGED));
}

export function clearSentMessages() {
  memory = [];
  try { localStorage.removeItem(storageKey); storageUnavailable = false; } catch { storageUnavailable = true; }
  window.dispatchEvent(new Event(SENT_MESSAGES_CHANGED));
}
