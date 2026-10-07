import type { Metadata } from "next";

import { EmisView } from "@/components/emis/emis-view";

export const metadata: Metadata = { title: "EMIs" };

export default function EmisPage() {
  return <EmisView />;
}
