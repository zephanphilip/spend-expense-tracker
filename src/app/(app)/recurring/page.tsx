import type { Metadata } from "next";

import { RecurringView } from "@/components/recurring/recurring-view";

export const metadata: Metadata = { title: "Recurring payments" };

export default function RecurringPage() {
  return <RecurringView />;
}
