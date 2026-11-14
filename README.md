# Emarketplace

A community marketplace built with Next.js 15, React 19, Supabase Postgres and Storage, Tailwind CSS, and Resend. Visitors can browse, sell, and contact sellers without creating an account.

**Live site: [emarketplace-eli.vercel.app](https://emarketplace-eli.vercel.app/)**

## Features

- **Create listings:** choose Item for sale, Vehicle for sale, or Home for sale or rent. Each type has relevant categories. Add a photo, title, description, price, and seller email, with an optional location. Photos upload to Supabase Storage and listings save to Postgres.
- **Browse and filter:** listing cards, category filters, keyword search, minimum/maximum prices, and sorting by newest or price.
- **Listing details:** each listing has its own page with a photo, full description, price, category, location, and seller information.
- **Message sellers:** buyer messages save to Supabase before the server attempts a Resend email notification. The buyer's email is the Reply-To address.
- **Sent-message history:** the Messages icon shows the latest 100 messages sent from this browser, with listing links, timestamps, and email notification status. Replies arrive by email.
- **Wishlist:** heart buttons save favorites in browser local storage. Saved listings persist after refreshing, sync across tabs, and support the normal search, filter, and comparison controls.
- **Product comparison:** select two or three listings and compare prices, conditions, locations, categories, and descriptions side by side.
- **Share links:** copy a listing's URL from its detail page. A selectable link is provided when clipboard access is blocked.
- **Responsive interface:** Emarketplace branding, Plus Jakarta Sans and Inter typography, loading animations, modern dropdowns, and slim scrollbars that appear near the scrollable edge.

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
```

Use a public Supabase anon or publishable key, never a service-role key. The Resend variables are server-only and must not have a `NEXT_PUBLIC_` prefix. Keep `.env.local` out of version control.

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). Development uses `.next-dev`; production builds use `.next`, so a build does not overwrite the running development server's files.

## Supabase setup

For a new project, use [schema-for-new-project.sql](supabase/schema-for-new-project.sql). If your tables and bucket already exist, verify the following instead of rerunning setup:

| Resource | Required configuration |
| --- | --- |
| `public.listings` | `id`, `title`, `description`, `price`, `category`, `seller_email`, `image_url`, `location`, `created_at`, `updated_at` |
| `public.messages` | `id`, `listing_id` referencing `listings.id`, `buyer_email`, `seller_email`, `message`, `created_at` |
| Storage | Public bucket named `listing-images`, allowing JPG, PNG, and WebP up to 5 MB |
| Anonymous permissions | `SELECT` and `INSERT` on listings, `INSERT` on messages, and uploads to the `listing-images` bucket |

Both grants and row-level security policies must allow these operations. Public message reads are unnecessary. If you used the sample public message-read policy, see [privacy-fix-if-you-used-sample.sql](supabase/privacy-fix-if-you-used-sample.sql).

## Seller email notifications

The browser submits to `/api/messages`. The server validates the input, looks up the seller address from the listing, saves the message, and calls Resend. The browser cannot override the recipient. Emails include the listing title and buyer's message, with the buyer's address as Reply-To.

Without a verified domain, use `Emarketplace <onboarding@resend.dev>`. This test sender can only send to the email address associated with your Resend account. Use that address as the listing's seller email when testing. Sending to other sellers requires a verified domain and a matching sender address. See [Resend's sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

An email failure does not discard the saved message. The interface distinguishes saved messages from messages whose notification was accepted by Resend. API acceptance does not guarantee inbox delivery; check the seller inbox, Spam folder, and Resend logs.

## Browser-local features

Wishlist IDs are stored under `emarketplace.wishlist.v1`. Sent-message history is stored under `emarketplace.sent-messages.v1`. These features do not require additional Supabase tables.

History and favorites belong to the browser profile and are visible to anyone using it. They do not sync between devices. Clearing local sent-message history does not delete Supabase records. Messages sent before the history feature was added are not imported. If browser storage is blocked, these features work only for the current session.

Comparison selections remain while changing homepage filters. The supplied database schema has no dedicated condition field, so comparison shows **Not specified** when condition is unavailable. If an optional `condition` column exists, the homepage includes it automatically. Condition is never guessed from the description.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Tests cover source contracts and logic for listing-type categories, comparison limits, message-save/email outcomes, sent-message storage, and wishlist serialization. They do not replace end-to-end checks against the deployed site.

To verify the required workflows:

1. Open the live site, click **Create new listing**, and choose a listing type.
2. Add a photo and required details, then publish. Verify the listing row and Storage photo in Supabase.
3. Return home and refresh. Confirm the listing appears and category filters work.
4. Open the listing and confirm its photo and full details.
5. Submit **Message Seller**. Verify the new row in Supabase `messages` and, when the sender is allowed to email that seller, check the seller inbox and Resend logs.
6. Test wishlist persistence after refreshing, comparison of two or three listings, sent-message history, and the Share button.

## Deployment on Vercel

The published site is [Emarketplace](https://emarketplace-eli.vercel.app/).

To deploy updates, use the connected repository or import the project into Vercel with the Next.js framework preset. Configure the following environment variables for the relevant deployment environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Redeploy after changing environment variables. Keep credentials in Vercel's environment settings rather than source control.

## Troubleshooting

| Issue | Check |
| --- | --- |
| `Bucket not found` | The public Storage bucket must be named `listing-images` in the configured Supabase project. |
| Row-level security or permission errors | Verify table grants and RLS policies for anonymous listing reads/inserts, message inserts, and Storage uploads. |
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
