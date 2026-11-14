export type MessageInput = { listingId?: unknown; conversationId?: unknown; messageId?: unknown; message?: unknown; notifyByEmail?: unknown };
export type SavedChat = { messageId: string; conversationId: string; listingTitle: string; recipientEmail: string; senderEmail: string; duplicate: boolean };
type Dependencies = {
  saveMessage: (input: { listingId: string | null; conversationId: string | null; messageId: string; message: string }) => Promise<SavedChat>;
  sendEmail: (email: { to: string; replyTo: string; subject: string; text: string; idempotencyKey: string }) => Promise<void>;
};
export async function processSellerMessage(input: MessageInput, deps: Dependencies) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const listingId = typeof input.listingId === "string" ? input.listingId : null;
  const conversationId = typeof input.conversationId === "string" ? input.conversationId : null;
  const messageId = typeof input.messageId === "string" ? input.messageId : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!uuid.test(messageId) || (listingId !== null && !uuid.test(listingId)) || !(conversationId ? uuid.test(conversationId) : listingId && uuid.test(listingId)) || !message || message.length > 1500) {
    return { status: 400, body: { error: "Choose a listing or conversation and enter a message between 1 and 1,500 characters." } };
  }
  let saved: SavedChat;
  try { saved = await deps.saveMessage({ listingId, conversationId, messageId, message }); }
  catch (error) {
    const code = (error as { code?: string })?.code;
    return { status: code === "42501" ? 403 : code === "P0002" ? 404 : code === "22023" ? 400 : 503,
      body: { error: code === "42501" ? "This conversation is not available to your account." : code === "22023" ? "Chat is not available for this listing or message. Please check the listing and try again." : "Your message could not be saved. Please try again." } };
  }
  if (input.notifyByEmail !== true) return { status: 200, body: { saved: true, conversationId: saved.conversationId, messageId: saved.messageId, emailStatus: "skipped" } };
  try {
    await deps.sendEmail({ to: saved.recipientEmail, replyTo: saved.senderEmail,
      subject: `New message on Emarketplace: ${saved.listingTitle.replace(/[\r\n]/g, " ").slice(0, 200)}`,
      text: `You have a new message about ${saved.listingTitle} on Emarketplace.\n\nFrom: ${saved.senderEmail}\n\n${message}\n\nOpen Emarketplace to reply in chat, or reply to this email to contact the sender.`,
      idempotencyKey: `chat-message/${saved.messageId}` });
    return { status: 200, body: { saved: true, conversationId: saved.conversationId, messageId: saved.messageId, emailStatus: "sent" } };
  } catch {
    return { status: 200, body: { saved: true, conversationId: saved.conversationId, messageId: saved.messageId, emailStatus: "failed" } };
  }
}
