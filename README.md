# Emarketplace

A student-inspired marketplace for the Test 3 developer challenge, built using **React 19, Next.js 15 (App Router), Supabase Postgres + Storage, Tailwind CSS 3, and shadcn/ui-style source components**.

The source code contains functional UI for all four required features:

- **Create listing:** a required product photo, title, category, price, seller email; description; optional location. Files upload to Supabase Storage (`listing-images`), then the listing is saved in Supabase Postgres (`public.listings`).
- **Browse and filter:** public listings loaded newest first; category filters and keyword search (bonus); mobile-friendly card grid.
- **Detail route:** `/item/[id]` with product photo, full description, price, location, category, seller email, and timestamp.
- **Message seller:** a buyer enters their email and message. A row is inserted into `public.messages` with `listing_id`, `buyer_email`, and `seller_email`. The server then sends a notification using Resend, with the buyer email as Reply-To. Email failure does not discard the saved message.

There is **no authentication**, as permitted by the challenge. The example has browser-only form validation; on a long-lived production service add authentication, spam/rate limits, server-side validation, moderation, and abuse protection. Seller email addresses are displayed publicly, as requested by the sample challenge. Only use test information.

## Already set up Supabase? Start here

You do **not** need to run the SQL schema again if you already created the following:

1. In **Table Editor**, verify `public.listings` columns: `id`, `title`, `description`, `price`, `category`, `seller_email`, `image_url`, `location`, `created_at`, `updated_at`.
2. Verify `public.messages` columns: `id`, `listing_id` (FK to `listings.id`), `buyer_email`, `seller_email`, `message`, `created_at`.
3. In **Storage**, verify the **public** bucket is exactly named **`listing-images`** (case-sensitive). It should allow JPG, PNG, and WebP, up to 5 MB.
4. Verify anonymous/public-key clients have `SELECT` and `INSERT` access to `public.listings`, `INSERT` access to `public.messages`, and `INSERT` access to `storage.objects` for `bucket_id = 'listing-images'`, with RLS policies allowing these operations.
5. For privacy, the challenge's example policy `"Anyone can view messages"` exposes all buyers' emails and messages. You can remove it using `supabase/privacy-fix-if-you-used-sample.sql`; the app does not require public message reads.

For a **brand-new** Supabase project, the complete SQL is in `supabase/schema-for-new-project.sql`.

## Setup on your computer

Requires Node.js 20.9+ and npm.

```bash
npm install
cp .env.example .env.local  # on Windows: copy .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
```

Get these values in Supabase Dashboard **Connect** or **Project Settings → API Keys**. The variable name `ANON_KEY` works with either the legacy public anon key or modern publishable key. **NEVER** use the service-role key, secret key, or database password here. `.env.local` is excluded from Git by `.gitignore`.

Then:

```bash
npm run dev
```

Open http://localhost:3000.

## Test all four criteria

1. Click **Create new listing**, choose a listing type,, upload a JPG/PNG/WebP smaller than 5 MB, fill required fields, and publish.
2. The app redirects to the saved listing's unique detail page. In Supabase **Table Editor → listings**, verify the row exists.
3. In Supabase **Storage → listing-images**, verify an uploaded file exists under `listings/`.
4. Return home, refresh, and verify the listing still appears. Try category filtering and search.
5. Open the item detail page, enter a buyer email/message, and click **Send message**.
6. Verify the new record in Supabase **Table Editor → messages**. The confirmation distinguishes a saved message from a saved message with a successful email API response. Verify email arrival in the seller inbox when Resend is configured.
7. Run `npm run build` before deployment and resolve any errors.

## Deploy using GitHub → Vercel

1. Push this **project folder** to a new **public** GitHub repository. Do not commit `.env.local`.
2. On Vercel, click **Add New → Project**, import that repository, and set framework = Next.js.
3. In Vercel **Environment Variables**, add the same two `NEXT_PUBLIC_SUPABASE_*` variables for **Production**.
4. Deploy. Submit your **production** URL (`https://your-app.vercel.app`), public GitHub repository, and **screenshots of the deployed functional app**, at https://apply.capm.us (select **3) Marketplace**).
5. Optional: record an up-to-three-minute demo of listing creation, browsing/category filtering, detail page, and buyer message persistence.

## Troubleshooting

| Error | Most likely cause / fix |
|---|---|
| `Bucket not found` | Create a public Storage bucket named **`listing-images`** in the same Supabase project as `.env.local`. |
| `new row violates row-level security policy` | Verify table/storage policies allow anonymous INSERT; use the SQL provided or inspect your RLS policies. |
| `permission denied for table` | Both SQL grants and RLS policies must allow the operation. |
| `Could not find the table` or `column ... does not exist` | Check schema/column names exactly; they must match the supplied Test 3 schema. |
| Listings don't load | Verify `SELECT` grant and RLS policy on `public.listings`, project URL, and browser Network panel. |
| Photos load poorly | Bucket must be public; URLs must be generated via `.getPublicUrl(uploaded.path)`. |
| Public app doesn't connect | Add env vars in Vercel **Production**, then redeploy. |
| Messages don't arrive as email | Check RESEND_API_KEY and RESEND_FROM_EMAIL on the server, verify the sender domain in Resend, and check Resend logs. |

## Structure

```
src/
  app/
    page.tsx                   # Browse all listings, search/filter
    create/page.tsx            # Create listing
    item/[id]/page.tsx         # Individual listing and buyer messages
    layout.tsx                 # Shared header/footer
    globals.css                # Responsive visual design
  components/
    marketplace/              # Functional feature components
    ui/                       # shadcn/ui style Button, Card, Input, etc.
  lib/
    supabase.ts                # Public Supabase client
    marketplace.ts             # Types, categories, validation, formatting
supabase/                      # SQL reference + privacy hardening
```

## Verification note

This project is packaged with source-level contract tests. **Live posting, Storage uploads, and Vercel deployment can only be verified after you configure your own Supabase credentials.** The ZIP does not contain your private environment values, and it does not include a live deployed site.

## Seller email notifications (Resend)

Message Seller posts to the server route `/api/messages`. The server validates the request, reads the seller address from the listing, saves the message in Supabase, then calls Resend. No login or Supabase service-role key is required. Buyers cannot override the recipient. Emails contain the listing title, buyer email, and plain-text message; replying goes to the buyer.

Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `.env.local` and your deployment's server environment. Never use a `NEXT_PUBLIC_` prefix for these values. Redeploy after changing production environment variables.

Use a sender such as `Emarketplace <notifications@your-verified-domain.com>` on a domain verified in Resend. The default `onboarding@resend.dev` test sender can only deliver to your Resend account email. See [Resend sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

Messages remain saved if Resend is unavailable or rejects the email. The UI reports that partial success without inviting a duplicate submission. A successful API response means Resend accepted the notification, not guaranteed inbox delivery. Check Resend delivery logs and the seller inbox for end-to-end verification.

## Product comparison

Use Compare on listing cards to select two or three listings, then open the floating comparison panel. Selections remain while changing homepage search, price, sort, and category filters. Compare prices, conditions, locations, categories, and full descriptions, and follow View listing for more details. Remove a selection or clear the tray to start again. The table scrolls horizontally on small screens and the dialog supports Escape and keyboard navigation.

Existing listings do not have a dedicated condition column in the supplied Supabase schema. Comparison displays Not specified when condition is unavailable; it never guesses condition from the description. If a nullable condition column already exists, the homepage fetch includes it automatically.

## Sent-message history

The header Messages icon shows the latest 100 messages successfully submitted from this browser, with listing links and email notification status. History is stored locally and is visible to anyone using the same browser profile. Clear local history removes these local copies without deleting the Supabase records. Earlier submissions and messages sent on other devices are not imported. Seller replies arrive at the buyer's email address; this is sent-message history, not an in-app inbox. Public access to Supabase messages is not required or enabled by this feature.

## Wishlist

Tap the heart on a listing card or item details page to save it. Open Saved listings in the marketplace sidebar to browse favorites, then use the usual search, category, price, sort, and comparison controls. Tap the heart again to remove a favorite. Listing IDs are stored under emarketplace.wishlist.v1 in this browser's local storage and synchronize across tabs. No login or new Supabase table is needed. If browser storage is blocked, favorites remain only for the current session. Unavailable listings are omitted from the saved view.
#   e m a r k e t p l a c e  
 