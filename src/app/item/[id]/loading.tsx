import { ItemDetailSkeleton } from "@/components/marketplace/loading";

export default function Loading() {
  return <main className="shell detail-shell"><div className="back-line">Loading item...</div><ItemDetailSkeleton/></main>;
}
