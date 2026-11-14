import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("all three required pages exist", () => {
  for (const file of ["src/app/page.tsx", "src/app/create/page.tsx", "src/app/item/[id]/page.tsx"])
    assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), true);
});
test("listing insert includes exactly the columns required by schema", () => {
  const code = read("src/components/marketplace/create-listing.tsx");
  for (const field of ["title", "description", "price", "category", "seller_email", "image_url", "location"])
    assert.match(code, new RegExp(`\\b${field}(?:\\s*:|\\s*[,}])`));
});
test("photo upload uses correct public bucket and saves its URL", () => {
  const code = read("src/components/marketplace/create-listing.tsx");
  assert.match(code, /\.from\("listing-images"\)/);
  assert.match(code, /\.getPublicUrl\(uploaded\.path\)/);
  assert.match(code, /image_url: urlData\.publicUrl/);
});
test("homepage fetches real listings and filters category and search", () => {
  const code = read("src/components/marketplace/marketplace-feed.tsx");
  assert.match(code, /\.from\("listings"\)/);
  assert.match(code, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(code, /matchesListing\(item, query, category\)/);
});
test("detail page queries listing by id", () => {
  const code = read("src/components/marketplace/item-detail.tsx");
  assert.match(code, /\.eq\("id", id\)\.single\(\)/);
});
test("message seller saves through the server and reports email status truthfully", () => {
  const ui = read("src/components/marketplace/item-detail.tsx");
  const code = read("src/lib/seller-messages.ts");
  const route = read("src/app/api/messages/route.ts");
  assert.match(ui, /fetch\("\/api\/messages"/);
  assert.match(route, /\.from\("messages"\)\.insert\(/);
  for (const field of ["listing_id", "buyer_email", "seller_email", "message"])
    assert.match(code, new RegExp(`\\b${field}(?:\\s*:|\\s*[,}])`));
  assert.match(ui, /emailStatus === "sent"/);
  assert.doesNotMatch(ui, /RESEND_API_KEY/);
});
test("no secrets embedded", () => {
  const code = read("src/lib/supabase.ts");
  assert.match(code, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(code, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(code, /service_role|sb_secret_/);
});
