"use client";

import { format } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { exportActivityData } from "@/lib/services/activity.service";
import { getErrorMessage } from "@/lib/services/errors";
import { useSession } from "@/providers/auth-provider";

import { downloadText } from "./download";

/** Read-only JSON copy of the Activity tracker (not part of the money backup). */
export function ActivityExportPanel() {
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<{ activities: number; logs: number } | null>(null);

  async function download() {
    setBusy(true);
    try {
      const data = await exportActivityData(user.uid);
      downloadText(`spend-activities-${format(new Date(), "yyyy-MM-dd")}.json`, JSON.stringify(data, null, 2), "application/json");
      setCounts(data.counts);
      toast.success("Activity data downloaded", { description: `${data.counts.activities} activities · ${data.counts.logs} records` });
    } catch (e) {
      toast.error("Export failed", { description: getErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard id="activity-export" title="Activity data">
      <p className="text-sm text-muted-foreground">
        Every activity and completion record exactly as stored — ids, dates, times, durations, amounts, notes, schedules and reminder settings — as JSON.
      </p>
      <Button onClick={download} disabled={busy} variant="outline" className="mt-4 h-11 rounded-xl">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
        Download activity data
      </Button>
      {counts ? (
        <p role="status" className="mt-3 text-sm">
          Exported <span className="font-medium tabular-nums">{counts.activities}</span> activities and{" "}
          <span className="font-medium tabular-nums">{counts.logs}</span> records.
        </p>
      ) : null}
    </SectionCard>
  );
}
