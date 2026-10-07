import type { Metadata } from "next";

import { DetailRoute } from "@/components/common/detail-route";

export const metadata: Metadata = { title: "Investment" };

export default function InvestmentDetailPage() {
  return <DetailRoute view="investment" />;
}
