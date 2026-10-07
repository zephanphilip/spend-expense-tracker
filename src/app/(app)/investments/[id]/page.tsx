import type { Metadata } from "next";

import { InvestmentDetailView } from "@/components/investments/investment-detail-view";

export const metadata: Metadata = { title: "Investment" };

export default async function InvestmentDetailPage({ params }: PageProps<"/investments/[id]">) {
  const { id } = await params;
  return <InvestmentDetailView investmentId={id} />;
}
