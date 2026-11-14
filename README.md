# Emarketplace

A community marketplace built with Next.js 15, React 19, Supabase Postgres and Storage, Tailwind CSS, Resend, and the official Stripe SDK. Users must sign up or log in with Supabase Auth. At registration, choose a Buyer or Seller account. Only sellers can create listings.

**Live site: [emarketplace-eli.vercel.app](https://emarketplace-eli.vercel.app/)**

## Features

- **Create listings:** choose Item for sale, Vehicle for sale, or Home for sale or rent. Each type has relevant categories. Add a photo, title, description, price, and seller email, with an optional location. Photos upload to Supabase Storage and listings save to Postgres.
- **Browse and filter:** listing cards, category filters, keyword search, minimum/maximum prices, and sorting by newest or price.
- **Listing details:** each listing has its own page with a photo, full description, price, category, location, and seller information.
- **Buyer-seller chat:** private conversations, floating chat windows, unread badges, incoming-message popups, and read status. Messages save to Supabase; email notification is optional.
- **Inbox and notifications:** both buyers and sellers see their account conversations from any device. Messages and Notifications open the real inbox and unread conversations.
- **Wishlist:** heart buttons save favorites in browser local storage. Saved listings persist after refreshing, sync across tabs, and support the normal search, filter, and comparison controls.
- **Product comparison:** select two or three listings and compare prices, conditions, locations, categories, and descriptions side by side.
- **Share links:** copy a listing's URL from its detail page. A selectable link is provided when clipboard access is blocked.
- **Responsive interface:** Emarketplace branding, Plus Jakarta Sans and Inter typography, loading animations, modern dropdowns, and slim scrollbars that appear near the scrollable edge.

## Required authentication and account types

Use the Profile icon to log in or register as a **Buyer** or **Seller**. Authentication is required for the marketplace and its data. Buyers can browse, save, compare, and contact sellers; sellers can also create listings. The account type appears in the Profile menu. Existing accounts without a role are directed to choose their type once.

**Required database migration:** run [required-auth-and-roles.sql](supabase/required-auth-and-roles.sql) in Supabase SQL Editor after the original marketplace schema. This migration preserves existing listings and messages, creates private account profiles, records initial signup roles, and adds listing/message ownership IDs. It removes the old permissive policies, requires authentication to read listings, and enforces seller-only inserts and account-linked message inserts. Apply it before using this app version. The app cannot apply database migrations using its public Supabase key.

Roles are stored in the protected profiles table, independently of editable user metadata. Users can choose a role only once; later role changes require an administrator. Existing listings are retained without automatically claiming ownership by matching email addresses. New listings use the authenticated seller ID and email. Buyer messages use the authenticated sender ID and email. The server validates bearer tokens before saving messages or calling Resend.

In Supabase Authentication settings:

1. Enable the Email provider and allow new user signups.
2. Set Site URL to `https://emarketplace-eli.vercel.app`.
3. Add `https://emarketplace-eli.vercel.app/auth/confirm` and `http://localhost:3000/auth/confirm` to the allowed Redirect URLs. Add your local port if it differs.
4. With email confirmation enabled, confirm the signup email before logging in. Supabase sends these account emails separately from the Resend seller-notification route.

No service-role key is needed. Stripe onboarding, direct-charge Checkout, a 10% application fee, order confirmation, and signed Connect webhooks are implemented below. Wishlist remains browser-local; chat history is account-linked.

## Stripe Connect sandbox payments

Sellers open **Profile > Seller payments / Connect with Stripe**, then complete Stripe-hosted onboarding with test data. New connected accounts use Accounts v2 with Stripe-managed losses and a full Stripe dashboard, as required by the supplied sandbox; direct charges still use the connected account scope. The connected account ID and readiness flags are saved privately in Supabase. Available listings show **Buy Now** only when their linked seller can receive payments. Orders and sales are available from the Profile menu. Existing listings without a seller account ID are not automatically claimed by email.

Checkout uses a direct charge on the seller connected account and collects a 10% application fee. Prices and fees come from the database, never from the browser. Each listing represents one item and is reserved during Checkout. Stripe processing fees are separate from the platform fee. The buyer cannot buy their own listing.

**Database:** run [stripe-connect.sql](supabase/stripe-connect.sql) after the authentication migration. It creates private seller-account and order tables, server-only reservation/confirmation functions, and listing readiness/Sold fields. Payment columns cannot be set through authenticated listing inserts. Do not rerun the older authentication migration afterward because it changes table grants.

**Server environment:** set `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_WEBHOOK_SECRET`, and `APP_URL`. Keep the public test key in `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Only sandbox secret keys are accepted. The service-role key is used only by payment server routes; never give it a `NEXT_PUBLIC_` prefix. Use `APP_URL=http://localhost:3000` locally and `APP_URL=https://emarketplace-eli.vercel.app` in Vercel Production.

### Register the production Connect webhook

1. Deploy this version to the public production Vercel URL. Add the Stripe keys and server database key to Vercel first.
2. From the project folder, run:

   ```bash
   node --env-file=.env.local scripts/create-webhook.mjs https://emarketplace-eli.vercel.app/api/stripe/webhook
   ```

3. The script checks the deployed app identity, registers a **Connect** endpoint, and saves `STRIPE_WEBHOOK_SECRET` and `STRIPE_WEBHOOK_ENDPOINT_ID` directly to ignored `.env.local` without printing the secret. It refuses to duplicate or delete existing endpoints.
4. Copy `STRIPE_WEBHOOK_SECRET` into Vercel environment settings and redeploy.

The endpoint receives `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, and `account.updated`. It verifies the raw-body signature, rejects live events, and ignores unrelated orders/accounts in the shared sandbox. Paid fulfillment checks the account, namespace, session, amount, currency, PaymentIntent, and application fee. A database transaction marks the order Paid and listing Sold together; duplicate deliveries are idempotent. Expired or explicitly cancelled Checkout sessions release their reservation. A browser redirect alone never confirms payment.

For local webhooks, Stripe CLI can forward Connect events to `localhost:3000/api/stripe/webhook`; use the temporary signing secret it provides locally. The production endpoint uses its own separate signing secret.

### Sandbox verification

1. Register a Seller, open Seller payments, and finish hosted onboarding. Confirm payments and payouts show Enabled.
2. Publish a new listing with a price of at least $0.50, and sign in with another buyer account.
3. Select Buy Now and pay with `4242 4242 4242 4242`, a future expiry, any CVC, and any ZIP/postal code. No real money moves.
4. Verify the success page changes from Waiting for payment confirmation to Payment confirmed, the order is Paid in Supabase, and the listing shows Sold.
5. Verify the connected-account payment has a 10% application fee. The seller balance receives the sale less the platform fee and Stripe processing fees.
6. Retrying the same webhook must not create another order or sale. A second buyer must not be able to purchase the reserved/Sold item. Cancelling an open Checkout should make it available again.

The Supabase integration checks cover access restrictions, concurrent reservations, immutable price/fee snapshots, mismatched amounts, and idempotent atomic confirmation. Actual hosted onboarding and test-card payment must also be checked on the deployed URL.

## Local setup

Requires Node.js 20.9+ and npm.

```bash
npm install
```

Copy `.env.example` to `.env.local`:

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

```bash
# macOS / Linux
cp .env.example .env.local
```

Set these values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL="Emarketplace <onboarding@resend.dev>"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-test-publishable-key
STRIPE_SECRET_KEY=your-stripe-test-secret-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-signing-secret
APP_URL=http://localhost:3000
```

Use a public Supabase anon or publishable key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The separate service-role key belongs only in `SUPABASE_SERVICE_ROLE_KEY` for server-side payment operations. The Resend variables are server-only and must not have a `NEXT_PUBLIC_` prefix. Keep `.env.local` out of version control.

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). Development uses `.next-dev`; production builds use `.next`, so a build does not overwrite the running development server's files.

## Supabase setup

For a new project, use [schema-for-new-project.sql](supabase/schema-for-new-project.sql). If your tables and bucket already exist, verify the following, then apply `required-auth-and-roles.sql` instead of rerunning the original setup:

| Resource | Required configuration |
| --- | --- |
| `public.listings` | `id`, `title`, `description`, `price`, `category`, `seller_email`, `image_url`, `location`, `created_at`, `updated_at` |
| `public.messages` | `id`, `listing_id` referencing `listings.id`, `buyer_email`, `seller_email`, `message`, `created_at` |
| Storage | Public bucket named `listing-images`, allowing JPG, PNG, and WebP up to 5 MB |
| Authentication policies | Apply `required-auth-and-roles.sql` to require authenticated reads, seller-owned listing inserts/uploads, and authenticated message inserts |

The auth migration replaces the original anonymous policies. Both grants and row-level security policies must allow the authenticated operations. Public message reads are unnecessary. If you used the sample public message-read policy, see [privacy-fix-if-you-used-sample.sql](supabase/privacy-fix-if-you-used-sample.sql).

## Private chat and optional email

**Required migration:** after `required-auth-and-roles.sql`, run [private-chat.sql](supabase/private-chat.sql) in Supabase SQL Editor. It creates conversations, extends the existing messages table with sender/recipient IDs and read status, and replaces the old insert-only message policy with participant-only reads and validated message-send/read RPCs. It also adds the tables to the Supabase Realtime publication when that publication exists. Do not rerun the older auth migration afterward, as it resets message policies.

A buyer selects **Message Seller** on a listing. The floating chat window stays open while navigating. Sellers receive unread badges and a popup when a new message arrives while the app is open. Either participant can reply from Messages; Notifications shows unread conversations. Opening a focused conversation at its latest messages marks received messages as read. Earlier messages can be loaded in the conversation. Realtime updates have a visibility-aware periodic refresh fallback.

Only the conversation buyer and seller can read its messages. The server verifies the session, and a database function checks participation, derives the recipient, and atomically creates the conversation and saves the message. Client-generated message IDs make retries idempotent. Users cannot send messages as another account or select an unrelated recipient.

Existing messages are imported only when buyer and seller account IDs are already known. Listings with no seller ID keep an email contact option; matching an email alone does not claim a listing or private conversation. Old local sent-history copies are not uploaded. Browser-local history is no longer the header inbox.

Chat does not require Resend. **Also notify by email** is off by default. Selecting it sends an optional Resend notification after saving the chat message. Sellers can email buyers and buyers can email sellers; the authenticated sender is Reply-To. The chat header also has an Email action that opens the participant's address in the user's email application. Email replies do not appear in chat.

Without a verified domain, `Emarketplace <onboarding@resend.dev>` can send only to the Resend account email. Other recipients require a verified domain. See [Resend's sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain). Notification failure does not discard chat messages; the interface reports it separately. API acceptance does not guarantee inbox delivery.

### Test chat with two accounts

1. Apply both migrations in order and create a Seller account and a Buyer account in separate browser profiles.
2. Publish a new listing as the seller so it has a seller account ID.
3. As the buyer, open the listing, choose Message Seller, and send a message without selecting email.
4. As the seller, verify the popup, unread counts, inbox preview, and saved message. Open the conversation, verify unread clears, then reply.
5. Check the reply and Seen status on the buyer side. Refresh both sessions to verify persistence.
6. Verify a third account cannot read or send to that conversation. Confirm logged-out API requests return 401.
7. Optionally select Also notify by email or use the Email action. Check Resend restrictions before testing external recipients.

## Browser-local features

Wishlist IDs are stored under `emarketplace.wishlist.v1` and do not require an additional Supabase table. The old `emarketplace.sent-messages.v1` history, if present in a browser, is no longer used as the inbox.

Favorites belong to the browser profile and do not sync between devices. If browser storage is blocked, favorites work only for the current session. Chat history belongs to the signed-in account and is stored privately in Supabase.

Comparison selections remain while changing homepage filters. The supplied database schema has no dedicated condition field, so comparison shows **Not specified** when condition is unavailable. If an optional `condition` column exists, the homepage includes it automatically. Condition is never guessed from the description.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Tests cover source contracts and logic for listing-type categories, comparison limits, message-save/email outcomes, sent-message storage, and wishlist serialization. They do not replace end-to-end checks against the deployed site.

To verify the required workflows:

1. Sign up or log in as a Seller, click **Create new listing**, and choose a listing type.
2. Add a photo and required details, then publish. Verify the listing row and Storage photo in Supabase.
3. Return home and refresh. Confirm the listing appears and category filters work.
4. Open the listing and confirm its photo and full details.
5. Open **Message Seller** and send a chat message. Verify the message in Supabase and in the seller account inbox. Test optional email separately.
6. Test wishlist persistence after refreshing, comparison of two or three listings, chat replies and unread counts, and the Share button.

## Deployment on Vercel

The published site is [Emarketplace](https://emarketplace-eli.vercel.app/).

To deploy updates, use the connected repository or import the project into Vercel with the Next.js framework preset. Configure the following environment variables for the relevant deployment environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL` (set to the production origin)

Redeploy after changing environment variables. Keep credentials in Vercel's environment settings rather than source control.

## Troubleshooting

| Issue | Check |
| --- | --- |
| `Bucket not found` | The public Storage bucket must be named `listing-images` in the configured Supabase project. |
| Row-level security or permission errors | Verify table grants and RLS policies for authenticated reads, seller-owned inserts/uploads, and account-linked message inserts. |
| Missing table or column | Match the schema names listed above. |
| Listings do not load | Check the Supabase URL, public key, and listing read permissions. |
| Photos do not load | Confirm the bucket is public and the stored image URL is its public URL. |
| Seller notification fails | Check Resend environment variables, sender restrictions, and Resend logs. Messages may still be saved successfully. |
| Favorites or history disappear | Check browser storage settings and whether you are using a different browser profile or device. |
| Deployment cannot connect | Configure the environment variables in Vercel and redeploy. |

## Project structure

```text
src/
  app/
    page.tsx                   # Marketplace feed
    create/page.tsx            # Listing-type chooser
    create/[type]/page.tsx     # Listing creation form
    item/[id]/page.tsx         # Listing details and messaging
    api/messages/route.ts      # Save messages and notify sellers
    layout.tsx                 # Shared header and wishlist provider
    globals.css                # Responsive styles
  components/
    marketplace/               # Listings, comparison, wishlist, messaging
    ui/                        # Shared controls and scrollbar behavior
  lib/                         # Supabase client, validation, storage helpers
supabase/                      # Schema and privacy policy reference
tests/                        # Automated checks
```
