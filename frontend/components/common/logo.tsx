import Link from "next/link";

import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  suffix,
  className,
}: {
  href?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-semibold", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
          <path
            d="M3 12h4l2-5 4 10 2-5h6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="tracking-tight">
        EVE{!suffix && <span className="font-normal text-muted-foreground"> Diagnostics</span>}
      </span>
      {suffix && (
        <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
          {suffix}
        </span>
      )}
    </Link>
  );
}
