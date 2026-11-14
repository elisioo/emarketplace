import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Car, CircleHelp, House, ShoppingBag, Tag, Store } from "lucide-react";

export const metadata: Metadata = { title: "Create new listing | Emarketplace" };

const listingTypes = [
  { type: "item", title: "Item for sale", description: "Create a listing for one or more items you'd like to sell.", Icon: ShoppingBag, color: "pink" },
  { type: "vehicle", title: "Vehicle for sale", description: "Sell a car, motorcycle, truck, or another vehicle.", Icon: Car, color: "teal" },
  { type: "home", title: "Home for sale or rent", description: "List a house, apartment, or property for sale or rent.", Icon: House, color: "orange" },
];

export default function CreatePage() {
  return <main className="listing-type-page">
    <aside className="listing-type-sidebar">
      <Link href="/" className="listing-type-back"><ArrowLeft size={17}/> Back to Marketplace</Link>
      <h1>Create new listing</h1>
      <div className="listing-type-nav selected"><span><Tag size={20}/></span>Choose listing type</div>
      <div className="listing-type-divider"/>
      <Link href="/" className="listing-type-nav"><span><Store size={20}/></span>Browse listings</Link>
      <details className="seller-help"><summary className="listing-type-nav"><span><CircleHelp size={20}/></span>Seller help</summary>
        <div className="seller-help-copy">Choose a listing type, add a clear photo, and fill in your item's details. Set a price and provide your email so buyers can contact you. No account needed.</div>
      </details>
    </aside>
    <section className="listing-type-main" aria-labelledby="listing-type-heading">
      <div className="listing-type-content">
        <h2 id="listing-type-heading">Choose listing type</h2>
        <p className="listing-type-subtitle">What would you like to list on Emarketplace?</p>
        <div className="listing-type-grid">
          {listingTypes.map(({ type, title, description, Icon, color }) => <Link key={type} href={`/create/${type}`} className="listing-type-card">
            <span className={`listing-type-art ${color}`}><Icon size={38} strokeWidth={1.7}/></span>
            <h3>{title}</h3><p>{description}</p><span className="listing-type-card-action">Get started <span aria-hidden="true">&rarr;</span></span>
          </Link>)}
        </div>
        <p className="listing-type-note">Free to list. No login required.</p>
      </div>
    </section>
  </main>;
}
