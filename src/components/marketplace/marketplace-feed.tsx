"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, LayoutGrid, Search, ShoppingBag, X, Car, House, Shirt, Tag, Smartphone, Film, Heart, Gift, Flower2, Paintbrush, Sofa, Hammer, Music, BriefcaseBusiness, PawPrint, Bike, Puzzle, Users, Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useWishlist } from "@/components/marketplace/wishlist-provider";
import { ListingComparison } from "@/components/marketplace/listing-comparison";
import { MAX_COMPARISON_ITEMS, toggleComparison } from "@/lib/comparison";
import { ListingCard } from "@/components/marketplace/listing-card";
import { CATEGORIES, matchesListing, type Listing } from "@/lib/marketplace";
import { getSupabase } from "@/lib/supabase";

const categoryIcons = [Car, House, Shirt, Tag, Smartphone, Film, Heart, Gift, Flower2, Paintbrush, Sofa, Hammer, House, Music, BriefcaseBusiness, PawPrint, Bike, Puzzle, Users];

export function MarketplaceFeed() {
  const { ids: wishlistIds, persistent: wishlistPersistent } = useWishlist();
  const [savedOnly, setSavedOnly] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const comparedListings = comparisonIds.map(id => listings.find(listing => listing.id === id)).filter((listing): listing is Listing => !!listing);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const clearFilters = () => { setCategory("All"); setQuery(""); setMinPrice(""); setMaxPrice(""); setSort("newest"); };

  useEffect(() => {
    let active = true;
    const client = getSupabase();
    if (!client) {
      setError("The marketplace is temporarily unavailable. Please try again shortly.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    client.from("listings")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error: requestError }) => {
        if (!active) return;
        if (requestError) setError("We couldn't connect to the marketplace. Please try again.");
        else setListings((data ?? []) as Listing[]);
        setLoading(false);
      });
    return () => { active = false; };
  }, [refreshToken]);

  const filtered = useMemo(() => {
    const items = listings.filter((item) => (!savedOnly || wishlistIds.includes(item.id)) && matchesListing(item, query, category)
      && (minPrice === "" || Number(item.price) >= Number(minPrice))
      && (maxPrice === "" || Number(item.price) <= Number(maxPrice)));
    return items.sort((a, b) => sort === "price-low" ? Number(a.price) - Number(b.price) : sort === "price-high" ? Number(b.price) - Number(a.price) : Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""));
  }, [listings, query, category, minPrice, maxPrice, sort, savedOnly, wishlistIds]);
  const hasFilters = !!(query.trim() || category !== "All" || minPrice || maxPrice);
  const heading = query.trim() ? "Search results" : category === "All" ? "Marketplace" : category;

  return <main className={`market-page shell ${comparedListings.length ? "has-comparison" : ""}`}>
    <aside className="sidebar-panel" aria-label="Marketplace filters">
      <div className="side-intro">
        <Link href="/" className="sidebar-breadcrumb">Emarketplace</Link>
        <h1>Search found</h1>
        <div className="search-area"><Search size={18} aria-hidden="true"/>
          <Input aria-label="Search Marketplace" placeholder="Search Marketplace" value={query} onChange={(e) => setQuery(e.target.value)}/>
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={16}/></button>}
        </div>
        <Button className="sidebar-create w-full" asChild><Link href="/create"><Plus size={18}/> Create new listing</Link></Button>
      </div>
      <div className="sidebar-filters">
        <label htmlFor="sort-listings">Sort by</label>
        <Select id="sort-listings" label="Sort listings" value={sort} onValueChange={setSort} options={[{ value: "newest", label: "Newest first" }, { value: "price-low", label: "Price: low to high" }, { value: "price-high", label: "Price: high to low" }]}/>
        <span className="filter-label">Price</span>
        <div className="price-range"><Input type="number" min="0" aria-label="Minimum price" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)}/><span>to</span><Input type="number" min="0" aria-label="Maximum price" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}/></div>
        {minPrice !== "" && maxPrice !== "" && Number(minPrice) > Number(maxPrice) && <p className="range-hint">Maximum price must be at least the minimum.</p>}
        {hasFilters && <button className="clear-filters" type="button" onClick={clearFilters}>Clear filters</button>}
      </div>
      <button type="button" className={`wishlist-nav ${savedOnly ? "selected" : ""}`} aria-pressed={savedOnly} onClick={() => { setSavedOnly(!savedOnly); clearFilters(); }}><span><Heart size={20} fill={savedOnly ? "currentColor" : "none"}/></span>Saved listings <span className="wishlist-count">{listings.filter(item => wishlistIds.includes(item.id)).length}</span></button>
      <h2 className="side-heading">Categories</h2>
      <nav className="category-nav" aria-label="Filter listings by category">
        {["All", ...CATEGORIES].map((item, index) => { const Icon = index === 0 ? LayoutGrid : categoryIcons[index - 1]; return <button type="button" key={item} onClick={() => setCategory(item)} aria-pressed={category === item} className={`category-item ${category === item ? "selected" : ""}`}><span><Icon size={20}/></span>{item === "All" ? "Browse all" : item}</button>; })}
      </nav>
    </aside>
    <section className="main-content" aria-label="Marketplace listings">
      <div className="market-toolbar"><div><h2>{savedOnly ? "Saved listings" : hasFilters ? heading === "Marketplace" ? "Filtered listings" : heading : "Today's picks"}</h2><p><MapPin size={14}/> Discover finds from your community</p></div><span className="results-label" aria-live="polite">{loading ? "Loading listings..." : error ? "" : `${filtered.length} ${filtered.length === 1 ? "listing" : "listings"}`}</span></div>
      {savedOnly && <p className="wishlist-info" role="status">{wishlistPersistent ? "Your favorites are saved in this browser. Tap a heart again to remove a listing." : "Browser storage is unavailable. Favorites will last only for this session."}</p>}
      {category !== "All" && <div className="category-summary"><span className="category-summary-icon">{(() => { const Icon = categoryIcons[CATEGORIES.indexOf(category as typeof CATEGORIES[number])]; return Icon ? <Icon size={24}/> : null; })()}</span><div><h3>Shop {category}</h3><p>Explore the latest listings in your community.</p></div></div>}
      {loading ? <div className="listing-grid" role="status" aria-label="Loading listings">{Array.from({ length: 8 }).map((_, i) => <div className="listing-skeleton" key={i}><div/><span/><span/></div>)}</div>
      : error ? <div className="empty-state error-state"><span className="empty-icon"><AlertTriangle size={32}/></span><h3>We couldn't load listings</h3><p>{error}</p><Button variant="outline" onClick={() => setRefreshToken((n)=>n+1)}>Try again</Button></div>
      : filtered.length === 0 ? <div className="empty-state"><span className="empty-icon"><ShoppingBag size={36}/></span><h3>{savedOnly ? hasFilters ? "No saved listings match" : "No saved listings yet" : listings.length === 0 && !hasFilters ? "No listings yet" : "No listings found"}</h3><p>{savedOnly ? "Save listings with the heart button to find them here. Try clearing any filters or browse for more favorites." : listings.length === 0 && !hasFilters ? "Good finds start with your community. Be the first to share something on Emarketplace." : "Try a different search, category, or price range to find what you're looking for."}</p>{hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : savedOnly ? <Button variant="outline" onClick={() => setSavedOnly(false)}>Browse listings</Button> : <Button asChild><Link href="/create"><Plus size={17}/> Create a listing <ArrowRight size={16}/></Link></Button>}</div>
      : <div className="listing-grid">{filtered.map((item) => <ListingCard key={item.id} listing={item} selected={comparisonIds.includes(item.id)} compareDisabled={comparedListings.length >= MAX_COMPARISON_ITEMS} onToggleCompare={() => setComparisonIds(ids => toggleComparison(ids, item.id))}/>)}</div>}
    </section>
    <ListingComparison listings={comparedListings} onRemove={id => setComparisonIds(ids => ids.filter(value => value !== id))} onClear={() => setComparisonIds([])}/>
  </main>;
}
