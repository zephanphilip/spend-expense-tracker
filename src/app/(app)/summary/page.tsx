import type { Metadata } from "next";

import { SummaryView } from "@/components/summary/summary-view";

export const metadata: Metadata = { title: "Monthly summary" };

export default function SummaryPage() {
  return <SummaryView />;
}
