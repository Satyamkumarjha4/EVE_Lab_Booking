import Link from "next/link";

import { Logo } from "@/components/common/logo";

const COLUMNS = [
  {
    title: "Patients",
    links: [
      { href: "/tests", label: "Find a test" },
      { href: "/centres", label: "Diagnostic centres" },
      { href: "/account/bookings", label: "My bookings" },
    ],
  },
  {
    title: "Business",
    links: [
      { href: "/business/login", label: "Lab & centre sign in" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="no-print mt-auto border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[2fr_1fr_1fr] sm:px-6">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Compare centre prices, pick a slot and book diagnostic tests in minutes.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="text-sm font-semibold">{column.title}</p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          Demo project. Payments are simulated; no real card or UPI transactions take place.
        </p>
      </div>
    </footer>
  );
}
