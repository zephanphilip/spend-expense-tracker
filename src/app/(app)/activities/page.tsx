import type { Metadata } from "next";

import { ActivitiesView } from "@/components/activities/activities-view";

export const metadata: Metadata = { title: "Activities" };

export default function ActivitiesPage() {
  return <ActivitiesView />;
}
