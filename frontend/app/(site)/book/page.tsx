import type { Metadata } from "next";
import { Suspense } from "react";

import { RequireAuth } from "@/components/auth/require-auth";
import { BookView } from "@/components/booking/book-view";

export const metadata: Metadata = { title: "Book a test" };

export default function BookPage() {
  return (
    <RequireAuth roles={["CLIENT"]}>
      <Suspense>
        <BookView />
      </Suspense>
    </RequireAuth>
  );
}
