import type { Metadata } from "next";

import { IncomeView } from "@/components/income/income-view";

export const metadata: Metadata = { title: "Income" };

export default function IncomePage() {
  return <IncomeView />;
}
