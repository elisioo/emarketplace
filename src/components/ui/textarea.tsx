import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn("flex min-h-28 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink placeholder:text-[#a08baa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d5c0dc] disabled:cursor-not-allowed disabled:opacity-50", className)}
      ref={ref} {...props}
    />
  )
);
Textarea.displayName = "Textarea";
export { Textarea };
