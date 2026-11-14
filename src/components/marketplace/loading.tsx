import { LoaderCircle } from "lucide-react";

export function LoadingIndicator({ label = "Loading..." }: { label?: string }) {
  return <span className="loading-indicator" role="status"><LoaderCircle size={18} className="loading-spinner" aria-hidden="true"/><span>{label}</span></span>;
}

export function ItemDetailSkeleton() {
  return <div className="detail-skeleton" role="status" aria-label="Loading item details" aria-busy="true">
    <span className="sr-only">Loading item details...</span>
    <div className="detail-grid" aria-hidden="true">
      <div><div className="skeleton-block skeleton-detail-photo"/><div className="skeleton-block skeleton-description"/></div>
      <div className="skeleton-detail-copy"><div className="skeleton-block skeleton-line short"/><div className="skeleton-block skeleton-line title"/><div className="skeleton-block skeleton-line price"/><div className="skeleton-block skeleton-line"/><div className="skeleton-block skeleton-message"/></div>
    </div>
  </div>;
}
