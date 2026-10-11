import type { Metadata } from "next";

import { PlanView } from "@/components/plan/plan-view";

export const metadata: Metadata = { title: "More" };

export default function PlanPage() {
  return <PlanView />;
}
