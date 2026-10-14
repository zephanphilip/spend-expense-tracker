import type { Metadata } from "next";

import { ActivityAnalyticsView } from "@/components/activities/activity-analytics-view";

export const metadata: Metadata = { title: "Activity analytics" };

export default function ActivityAnalyticsPage() {
  return <ActivityAnalyticsView />;
}
