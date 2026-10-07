import type { Metadata } from "next";

import { DetailRoute } from "@/components/common/detail-route";

export const metadata: Metadata = { title: "Loan" };

export default function EmiDetailPage() {
  return <DetailRoute view="emi" />;
}
