import type { Metadata } from "next";

import { FitnessAnalyticsView } from "@/components/fitness/fitness-analytics-view";

export const metadata: Metadata = { title: "Fitness analytics" };

export default function FitnessAnalyticsPage() {
  return <FitnessAnalyticsView />;
}
