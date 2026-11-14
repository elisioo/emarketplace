-- Optional improvement for users who copied the sample schema, which made all buyer messages publicly readable.
-- WARNING: Make sure your app only INSERTs messages and doesn't need public SELECT first.
DROP POLICY IF EXISTS "Anyone can view messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own listings" ON public.listings;
REVOKE SELECT, UPDATE, DELETE ON public.messages FROM anon, authenticated;
GRANT INSERT ON public.messages TO anon, authenticated;
