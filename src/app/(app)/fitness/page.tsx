import type { Metadata } from "next";

import { FitnessView } from "@/components/fitness/fitness-view";

export const metadata: Metadata = { title: "Fitness" };

export default function FitnessPage() {
  return <FitnessView />;
}
