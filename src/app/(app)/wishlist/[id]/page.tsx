import type { Metadata } from "next";

import { GoalDetailView } from "@/components/wishlist/goal-detail-view";

export const metadata: Metadata = { title: "Wish" };

export default async function GoalDetailPage({ params }: PageProps<"/wishlist/[id]">) {
  const { id } = await params;
  return <GoalDetailView goalId={id} />;
}
