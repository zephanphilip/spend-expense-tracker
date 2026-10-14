import type { Metadata } from "next";

import { LegacyRedirect } from "@/components/common/legacy-redirect";
import { LEGACY_ACTIVITY_PATHS } from "@/lib/activities/routes";

export const metadata: Metadata = { title: "Activity analytics" };

/** Old /fitness URL — kept so bookmarks and notifications still work. */
export default function LegacyPage() {
  return <LegacyRedirect to={LEGACY_ACTIVITY_PATHS["/fitness/analytics"]} />;
}
