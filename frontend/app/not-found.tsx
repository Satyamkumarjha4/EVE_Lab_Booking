import Link from "next/link";

import { Logo } from "@/components/common/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div>
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-muted-foreground">The link may be broken, or the page may have moved.</p>
      </div>
      <div className="flex gap-2">
        <Link href="/" className={buttonVariants()}>Go home</Link>
        <Link href="/tests" className={buttonVariants({ variant: "outline" })}>Find a test</Link>
      </div>
    </div>
  );
}
