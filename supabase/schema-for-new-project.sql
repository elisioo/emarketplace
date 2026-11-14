-- Test 3 Marketplace: use ONLY for a fresh Supabase project.
-- Already set up your tables/bucket? Do not run this again; use README setup checklist.

CREATE TABLE IF NOT EXISTS public.listings (
  id uuid primary key default gen_random_uuid(),
  title varchar(255) not null,
  description text,
  price decimal(10,2) not null,
  category varchar(100) not null,
  seller_email varchar(255) not null,
  image_url text,
  location varchar(255) default 'Palo Alto, CA',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade,
  buyer_email varchar(255) not null,
  seller_email varchar(255) not null,
  message text not null,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON public.listings(created_at desc);
CREATE INDEX IF NOT EXISTS idx_messages_listing_id ON public.messages(listing_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_listings_updated_at ON public.listings;
CREATE TRIGGER update_listings_updated_at
BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.listings, public.messages FROM anon, authenticated;
GRANT SELECT, INSERT ON public.listings TO anon, authenticated;
GRANT INSERT ON public.messages TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view listings" ON public.listings;
CREATE POLICY "Anyone can view listings"
ON public.listings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can create listings" ON public.listings;
CREATE POLICY "Anyone can create listings"
ON public.listings FOR INSERT TO anon, authenticated
WITH CHECK (length(btrim(title)) > 0 AND price >= 0 AND length(btrim(category)) > 0 AND length(btrim(seller_email)) > 0);

-- No public SELECT of private messages. No client-side SELECT is needed after insert.
DROP POLICY IF EXISTS "Anyone can view messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can create messages" ON public.messages;
CREATE POLICY "Anyone can create messages"
ON public.messages FOR INSERT TO anon, authenticated
WITH CHECK (listing_id IS NOT NULL AND length(btrim(buyer_email)) > 0 AND length(btrim(seller_email)) > 0 AND length(btrim(message)) > 0);

-- Since Test 3 has no login, a seller email address does not establish ownership.
DROP POLICY IF EXISTS "Users can update their own listings" ON public.listings;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-images', 'listing-images', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can upload listing images" ON storage.objects;
CREATE POLICY "Anyone can upload listing images"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'listing-images');

-- A public bucket serves public file URLs without an object SELECT policy.
