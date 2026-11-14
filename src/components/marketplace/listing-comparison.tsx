"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GitCompareArrows, ImageOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingImage } from "@/components/marketplace/loading-image";
import { formatPrice, type Listing } from "@/lib/marketplace";

export function ListingComparison({ listings, onRemove, onClear }: { listings: Listing[]; onRemove: (id: string) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const compareButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      compareButton.current?.focus();
    };
  }, [open]);

  useEffect(() => { if (listings.length === 0) setOpen(false); }, [listings.length]);

  if (listings.length === 0) return null;

  return <>
    <aside className="compare-tray" aria-label="Selected listings for comparison">
      <div className="compare-tray-heading"><GitCompareArrows size={23}/><div><strong>Compare listings</strong><p aria-live="polite">{listings.length} of 3 selected{listings.length === 1 ? " · Choose at least one more" : ""}</p></div></div>
      <div className="compare-tray-items">{listings.map(listing => <span className="compare-chip" key={listing.id}><span title={listing.title}>{listing.title}</span><button type="button" onClick={() => onRemove(listing.id)} aria-label={`Remove ${listing.title} from comparison`}><X size={14}/></button></span>)}</div>
      <div className="compare-tray-actions"><button type="button" className="compare-clear" onClick={onClear}>Clear</button><Button ref={compareButton} disabled={listings.length < 2} onClick={() => setOpen(true)}>Compare ({listings.length})</Button></div>
    </aside>
    <dialog ref={dialog} className="comparison-dialog" aria-labelledby="comparison-title" aria-describedby="comparison-description" onCancel={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false); } }}>
      <div className="comparison-header"><div><span className="tiny-eyebrow">FIND YOUR BEST FIT</span><h2 id="comparison-title">Compare listings</h2><p id="comparison-description">Compare up to three listings side by side.</p></div><button type="button" className="comparison-close" aria-label="Close comparison" onClick={() => setOpen(false)} autoFocus><X size={21}/></button></div>
      {listings.length < 2 && <div className="comparison-hint">Choose another listing to continue comparing. <button type="button" onClick={() => setOpen(false)}>Browse listings</button></div>}
      <div className="comparison-table-scroll" tabIndex={0} role="region" aria-label="Listing comparison table; scroll horizontally on smaller screens">
        <table className="comparison-table">
          <caption className="sr-only">Listing photos, prices, conditions, locations, categories, and descriptions</caption>
          <thead><tr><th scope="col" className="comparison-row-label">Listing</th>{listings.map(listing => <th key={listing.id} scope="col"><div className="comparison-product">
            <button type="button" className="comparison-remove" onClick={() => onRemove(listing.id)} aria-label={`Remove ${listing.title} from comparison`}><X size={16}/></button>
            <div className="comparison-photo">{listing.image_url ? <LoadingImage src={listing.image_url} alt={listing.title} className="listing-photo"/> : <div className="no-image"><ImageOff size={28}/><span>No photo</span></div>}</div>
            <Link href={`/item/${listing.id}`}>{listing.title}</Link>
          </div></th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">Price</th>{listings.map(listing => <td key={listing.id} className="comparison-price">{formatPrice(Number(listing.price))}</td>)}</tr>
            <tr><th scope="row">Condition</th>{listings.map(listing => <td key={listing.id}>{listing.condition?.trim() || "Not specified"}</td>)}</tr>
            <tr><th scope="row">Location</th>{listings.map(listing => <td key={listing.id}>{listing.location?.trim() || "Not specified"}</td>)}</tr>
            <tr><th scope="row">Category</th>{listings.map(listing => <td key={listing.id}>{listing.category}</td>)}</tr>
            <tr><th scope="row">Description</th>{listings.map(listing => <td key={listing.id} className="comparison-description">{listing.description?.trim() || "No description provided."}</td>)}</tr>
            <tr><th scope="row"><span className="sr-only">View details</span></th>{listings.map(listing => <td key={listing.id}><Button variant="outline" size="sm" asChild><Link href={`/item/${listing.id}`}>View listing<span className="sr-only">: {listing.title}</span></Link></Button></td>)}</tr>
          </tbody>
        </table>
      </div>
      <div className="comparison-footer"><span>Condition is shown when provided by the seller.</span><Button variant="outline" size="sm" onClick={() => setOpen(false)}>Keep browsing</Button></div>
    </dialog>
  </>;
}
