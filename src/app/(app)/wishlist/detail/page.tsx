import type { Metadata } from "next";

import { DetailRoute } from "@/components/common/detail-route";

export const metadata: Metadata = { title: "Wish" };

export default function GoalDetailPage() {
  return <DetailRoute view="goal" />;
}
