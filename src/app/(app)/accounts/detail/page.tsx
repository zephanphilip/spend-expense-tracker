import type { Metadata } from "next";

import { DetailRoute } from "@/components/common/detail-route";

export const metadata: Metadata = { title: "Account" };

export default function AccountDetailPage() {
  return <DetailRoute view="account" />;
}
