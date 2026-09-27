import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "@/components/common/logo";
import { cn } from "@/lib/utils";

/** Split-screen auth layout: a brand panel with selling points beside the form. */
export function AuthShell({
  tone,
  heading,
  points,
  title,
  subtitle,
  children,
  footer,
}: {
  tone: "patient" | "business";
  heading: string;
  points: string[];
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside
        className={cn(
          "relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex",
          tone === "patient" ? "bg-teal-800" : "bg-slate-900"
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 size-[28rem] rounded-full bg-white/5"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[24rem] rounded-full bg-white/5"
        />
        <Logo className="relative [&_span]:text-white [&>span:first-child]:bg-white/15" />
        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-semibold tracking-tight">{heading}</h2>
          <ul className="space-y-3">
            {points.map((point) => (
              <li key={point} className="flex gap-3 text-white/85">
                <Check className="mt-0.5 size-5 shrink-0 text-teal-300" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">
          Payments on this site are simulated. No real card or UPI details are processed.
        </p>
      </aside>

      <main className="flex flex-col px-6 py-8 sm:px-10">
        <Logo className="lg:hidden" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="mb-8 space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          {footer && <div className="mt-8 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
