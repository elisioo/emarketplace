export type MessageInput = { listingId?: unknown; buyerEmail?: unknown; message?: unknown };
type ListingRecipient = { id: string; title: string; seller_email: string };
type Dependencies = {
  findListing: (id: string) => Promise<ListingRecipient | null>;
  saveMessage: (message: { id: string; listing_id: string; buyer_email: string; seller_email: string; message: string }) => Promise<void>;
  sendEmail: (email: { to: string; replyTo: string; subject: string; text: string; idempotencyKey: string }) => Promise<void>;
  newId: () => string;
};

export async function processSellerMessage(input: MessageInput, deps: Dependencies) {
  const listingId = typeof input.listingId === "string" ? input.listingId : "";
  const buyerEmail = typeof input.buyerEmail === "string" ? input.buyerEmail.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listingId)
    || buyerEmail.length > 255 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(buyerEmail)
    || !message || message.length > 1500) {
    return { status: 400, body: { error: "Enter a valid listing, email address, and a message between 1 and 1,500 characters." } };
  }

  let listing: ListingRecipient | null;
  const id = deps.newId();
  try {
    // The recipient always comes from the listing, never from the browser.
    listing = await deps.findListing(listingId);
    if (!listing) return { status: 404, body: { error: "This listing is no longer available." } };
    await deps.saveMessage({ id, listing_id: listing.id, buyer_email: buyerEmail, seller_email: listing.seller_email, message });
  } catch {
    return { status: 503, body: { error: "Your message could not be saved. Please try again." } };
  }

  try {
    await deps.sendEmail({
      to: listing.seller_email,
      replyTo: buyerEmail,
      subject: `New inquiry on Emarketplace: ${listing.title.replace(/[\r\n]/g, " ").slice(0, 200)}`,
      text: `You have a new inquiry about your listing on Emarketplace.\n\nListing: ${listing.title}\nFrom: ${buyerEmail}\n\n${message}\n\nReply to this email to contact the buyer directly.`,
      idempotencyKey: `seller-message/${id}`,
    });
    return { status: 200, body: { saved: true, emailStatus: "sent" } };
  } catch {
    // A notification failure must never turn a saved message into a failed submission.
    return { status: 200, body: { saved: true, emailStatus: "failed" } };
  }
}
