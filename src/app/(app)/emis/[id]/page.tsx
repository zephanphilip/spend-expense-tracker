import type { Metadata } from "next";

import { EmiDetailView } from "@/components/emis/emi-detail-view";

export const metadata: Metadata = { title: "Loan" };

export default async function EmiDetailPage({ params }: PageProps<"/emis/[id]">) {
  const { id } = await params;
  return <EmiDetailView emiId={id} />;
}
