"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { LoadingIndicator } from "@/components/marketplace/loading";

export function LoadingImage({ src, alt, className, loading }: { src: string; alt: string; className?: string; loading?: "lazy" | "eager" }) {
  return <ImageContent key={src} src={src} alt={alt} className={className} loading={loading}/>;
}

function ImageContent({ src, alt, className, loading }: { src: string; alt: string; className?: string; loading?: "lazy" | "eager" }) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  return <div className={`loading-image ${state}`} aria-busy={state === "loading"}>
    {state === "loading" && <div className="image-loading-overlay"><LoadingIndicator label="Loading photo..."/></div>}
    {state === "error" ? <div className="no-image"><ImageOff size={30}/><span>Photo unavailable</span></div> :
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={src} alt={alt} className={className} loading={loading} onLoad={() => setState("loaded")} onError={() => setState("error")} />}
  </div>;
}
