"use client";

import { PageHeader } from "@/components/common/page-header";

import { BackupPanel } from "./backup-panel";
import { ExportPanel } from "./export-panel";
import { ImportPanel } from "./import-panel";

export function DataView() {
  return (
    <div className="space-y-5">
      <PageHeader title="Data" description="Import, export and back up" back={{ href: "/plan", label: "Plan" }} />
      <ImportPanel />
      <ExportPanel />
      <BackupPanel />
    </div>
  );
}
