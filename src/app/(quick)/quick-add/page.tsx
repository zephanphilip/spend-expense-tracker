import type { Metadata } from "next";
import { Suspense } from "react";

import { QuickAddScreen } from "@/components/quick-add/quick-add-screen";

export const metadata: Metadata = { title: "Quick Add" };

export default function QuickAddPage() {
  // useSearchParams (deep-link params) needs a Suspense boundary in a static export.
  return (
    <Suspense>
      <QuickAddScreen />
    </Suspense>
  );
}
