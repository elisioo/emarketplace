import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreateListing } from "@/components/marketplace/create-listing";
import { LISTING_TYPES, type ListingType } from "@/lib/marketplace";

export const metadata: Metadata = { title: "Listing details | Emarketplace" };

export default async function ListingFormPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!Object.prototype.hasOwnProperty.call(LISTING_TYPES, type)) notFound();
  return <CreateListing key={type} listingType={type as ListingType}/>;
}
