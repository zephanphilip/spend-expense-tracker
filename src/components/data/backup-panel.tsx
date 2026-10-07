"use client";

import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download, Loader2, Upload } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { BACKUP_MAX_BYTES, COLLECTION_LABELS, planRestore, type RestorePlanEntry, type ValidatedBackup, validateBackup } from "@/lib/backup/format";
import { createBackup, existingForRestore, runRestore } from "@/lib/services/backup.service";
import { getErrorMessage } from "@/lib/services/errors";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";

import { downloadText } from "./download";

type Stage = { kind: "idle" } | { kind: "checking" } | { kind: "preview"; fileName: string; backup: ValidatedBackup; plan: RestorePlanEntry[]; existingAccountIds: Set<string> } | { kind: "restoring"; done: number; total: number } | { kind: "done"; written: number; skipped: number; invalid: number; orphaned: number };

export function BackupPanel() {
  const { user, profile } = useSession();
  const [backingUp, setBackingUp] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBackingUp(true);
    try {
      const backup = await createBackup(user.uid, profile);
      const total = Object.values(backup.collections).reduce((s, l) => s + (l?.length ?? 0), 0);
      downloadText(`ledger-backup-${format(new Date(), "yyyy-MM-dd")}.json`, JSON.stringify(backup, null, 2), "application/json");
      toast.success("Backup downloaded", { description: `${total} records. Keep it somewhere safe — it contains your financial history.` });
    } catch (e) {
      toast.error("Backup failed", { description: getErrorMessage(e) });
    } finally {
      setBackingUp(false);
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError(null);
    if (!file) return;
    if (file.size > BACKUP_MAX_BYTES) return setError("Backup is larger than 25 MB.");
    setStage({ kind: "checking" });
    try {
      const backup = validateBackup(await file.text());
      const fatal = backup.issues.find((i) => i.collection === "file" && !i.message.startsWith("Unknown collection"));
      if (fatal) {
        setStage({ kind: "idle" });
        return setError(fatal.message);
      }
      const existing = await existingForRestore(user.uid);
      setStage({ kind: "preview", fileName: file.name, backup, plan: planRestore(backup, existing), existingAccountIds: new Set(existing.ids.accounts) });
    } catch (e) {
      setStage({ kind: "idle" });
      setError(getErrorMessage(e, (e as Error).message));
    }
  }

  async function restore() {
    if (stage.kind !== "preview") return;
    const { backup, plan, fileName, existingAccountIds } = stage;
    const skipped = plan.reduce((s, p) => s + p.existing + p.duplicates, 0);
    const invalid = backup.issues.filter((i) => i.collection !== "file").length;
    setStage({ kind: "restoring", done: 0, total: plan.reduce((s, p) => s + p.toCreate.length, 0) });
    try {
      const result = await runRestore(user.uid, backup, plan, existingAccountIds, fileName, (done, total) => setStage({ kind: "restoring", done, total }));
      setStage({ kind: "done", written: result.written, skipped, invalid, orphaned: result.orphaned });
      toast.success(`Restored ${result.written} records`);
    } catch (e) {
      setStage({ kind: "idle" });
      toast.error("Restore stopped", { description: `${getErrorMessage(e)} Records already restored remain; restoring again skips them.` });
    }
  }

  return (
    <SectionCard id="backup" title="Backup & restore">
      <p className="-mt-2 mb-3 text-sm text-muted-foreground">
        A complete JSON copy of everything in Ledger. Restoring adds what&apos;s missing and never overwrites existing records.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11 rounded-xl" onClick={download} disabled={backingUp || stage.kind === "restoring"}>
          {backingUp ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
          Download backup
        </Button>
        <label
          htmlFor="restore-file"
          className={cn(
            "inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border bg-background text-sm font-medium hover:bg-muted has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
            (stage.kind === "checking" || stage.kind === "restoring") && "pointer-events-none opacity-50",
          )}
        >
          {stage.kind === "checking" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          Restore…
          <input id="restore-file" type="file" accept="application/json,.json" className="sr-only" onChange={onFile} />
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4" aria-hidden />
          {error}
        </p>
      ) : null}

      {stage.kind === "preview" ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            <span className="font-medium">{stage.fileName}</span>
            {Number.isNaN(stage.backup.createdAt.getTime()) ? null : <span className="text-muted-foreground"> · backed up {format(stage.backup.createdAt, "d MMM yyyy, h:mm a")}</span>}
          </p>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Restore preview</caption>
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th scope="col" className="px-2 py-2 font-medium">Data</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">New</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Already here</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Duplicates</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stage.plan
                  .filter((p) => p.toCreate.length + p.existing + p.duplicates > 0)
                  .map((p) => (
                    <tr key={p.collection}>
                      <td className="px-2 py-1.5">{COLLECTION_LABELS[p.collection]}</td>
                      <td className="px-2 py-1.5 text-right font-medium tabular-nums">{p.toCreate.length}</td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">{p.existing}</td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">{p.duplicates}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {stage.backup.issues.length ? (
            <details className="rounded-xl bg-amber-500/10 p-3 text-xs">
              <summary className="cursor-pointer font-medium text-amber-800 dark:text-amber-200">
                {stage.backup.issues.length} {stage.backup.issues.length === 1 ? "problem" : "problems"} found — those records will be skipped
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-muted-foreground">
                {stage.backup.issues.slice(0, 100).map((i, idx) => (
                  <li key={idx}>
                    {i.collection === "file" ? "File" : COLLECTION_LABELS[i.collection]}
                    {i.id ? ` · ${i.id}` : ""}: {i.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Account balances, loan and goal progress are restored exactly as they were in the backup. Existing records stay untouched.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={() => setStage({ kind: "idle" })}>
              Cancel
            </Button>
            <Button className="h-12 flex-1 rounded-xl text-base" onClick={restore} disabled={stage.plan.every((p) => p.toCreate.length === 0)}>
              <DatabaseBackup aria-hidden />
              Restore {stage.plan.reduce((s, p) => s + p.toCreate.length, 0)}
            </Button>
          </div>
        </div>
      ) : null}

      {stage.kind === "restoring" ? (
        <div role="status" className="mt-4 space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(stage.done / Math.max(stage.total, 1)) * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            Restoring {stage.done} of {stage.total}…
          </p>
        </div>
      ) : null}

      {stage.kind === "done" ? (
        <div role="status" className="mt-4 space-y-2">
          <p className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-5" aria-hidden />
            Restore complete
          </p>
          <dl className="grid grid-cols-4 gap-2 text-center">
            {(
              [
                ["Restored", stage.written],
                ["Skipped", stage.skipped],
                ["Invalid", stage.invalid],
                ["Orphaned", stage.orphaned],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-muted/60 p-2">
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                <dt className="text-[11px] text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </SectionCard>
  );
}
