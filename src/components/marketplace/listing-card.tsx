import Link from "next/link";
import { WishlistButton } from "@/components/marketplace/wishlist-button";
import { LoadingImage } from "@/components/marketplace/loading-image";
import { ArrowUpRight, Check, GitCompareArrows, ImageOff, MapPin } from "lucide-react";
import { formatPrice, relativeTime, type Listing } from "@/lib/marketplace";

export function ListingCard({ listing, selected = false, compareDisabled = false, onToggleCompare }: { listing: Listing; selected?: boolean; compareDisabled?: boolean; onToggleCompare?: () => void }) {
  return (
    <article className={`listing-card ${selected ? "is-comparing" : ""}`}>
      <div className="listing-wishlist"><WishlistButton id={listing.id} title={listing.title} compact/></div>
      <Link href={`/item/${listing.id}`} className="listing-card-link" aria-label={`View ${listing.title} for ${formatPrice(Number(listing.price))}`}>
        <div className="listing-image-wrap">
          {listing.image_url ? <LoadingImage src={listing.image_url} alt={listing.title} loading="lazy" className="listing-photo" />
          : <div className="listing-image-placeholder"><ImageOff size={32} /><span>No photo yet</span></div>}
          {listing.status === "sold" && <span className="listing-sold-badge">Sold</span>}
          <span className="listing-open"><ArrowUpRight size={16}/></span>
        </div>
        <div className="listing-body">
          <div className="listing-price">{formatPrice(Number(listing.price))}</div>
          <div className="listing-title" title={listing.title}>{listing.title}</div>
          <div className="listing-meta"><MapPin size={13} /> {listing.location || "Location not specified"}</div>
          <div className="listing-bottom"><span>{listing.category}</span><span>{relativeTime(listing.created_at)}</span></div>
        </div>
      </Link>
      {onToggleCompare && <div className="listing-compare-action"><button type="button" aria-pressed={selected} aria-label={`${selected ? "Remove" : "Add"} ${listing.title} ${selected ? "from" : "to"} comparison`} disabled={compareDisabled && !selected} onClick={onToggleCompare} title={compareDisabled && !selected ? "Remove a selected listing to compare another (maximum 3)." : undefined}>
        {selected ? <Check size={16}/> : <GitCompareArrows size={16}/>} {selected ? "Selected for comparison" : "Compare"}
      </button></div>}
    </article>
  );
}
