export type Conversation = {
  id: string; listing_id: string | null; listing_title: string;
  buyer_id: string; seller_id: string; buyer_email: string; seller_email: string;
  updated_at: string; last_message: string | null; last_sender_id: string | null;
  last_message_at: string | null; unread_count: number;
};
export type ChatMessage = { id: string; conversation_id: string; sender_id: string; recipient_id: string; message: string; created_at: string; read_at: string | null };
export type ChatTarget = { windowKey: string; conversationId?: string; listingId: string | null; title: string; peerEmail: string };
export function conversationPeer(conversation: Conversation, userId: string): string {
  return conversation.buyer_id === userId ? conversation.seller_email : conversation.buyer_email;
}
export function unreadTotal(conversations: Conversation[]): number {
  return conversations.reduce((total, item) => total + Math.max(0, Number(item.unread_count) || 0), 0);
}
export function mergeChatMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  return [...new Map([...existing, ...incoming].map(message => [message.id, message])).values()]
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id));
}
