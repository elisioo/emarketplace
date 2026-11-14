import { ItemDetailSkeleton } from "@/components/marketplace/loading";
import { Suspense } from "react";
import { ItemDetail } from "@/components/marketplace/item-detail";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<main className="shell detail-shell"><ItemDetailSkeleton/></main>}><ItemDetail id={id}/></Suspense>;
}
