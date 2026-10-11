import type { Metadata } from "next";

import { DetailRoute } from "@/components/common/detail-route";

export const metadata: Metadata = { title: "Activity" };

export default function FitnessActivityPage() {
  return <DetailRoute view="fitnessActivity" />;
}
