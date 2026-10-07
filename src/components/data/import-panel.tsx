"use client";

import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Copy, FileUp, Loader2, RotateCcw, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Money } from "@/components/common/money";
import { SectionCard } from "@/components/common/section-card";
import { Segmented } from "@/components/common/segmented";
import { SwitchField } from "@/components/common/switch-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PAYMENT_METHOD_META, PAYMENT_METHODS } from "@/lib/constants/payment-methods";
import { parseCsv } from "@/lib/csv/csv";
import {
  autoMapColumns,
  type ColumnMapping,
  dateSpan,
  IMPORT_FIELDS,
  IMPORT_LIMITS,
  type ImportOptions,
  type ImportType,
  type ParsedRow,
  parseImportRows,
  summarizeRows,
} from "@/lib/csv/import";
import { type DateFormat, detectDateFormat } from "@/lib/csv/values";
import { type ImportLog, existingFingerprints, runImport, subscribeImports, undoImport } from "@/lib/services/data.service";
import { getErrorMessage } from "@/lib/services/errors";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";
import { useCategories } from "@/providers/categories-provider";

type Step = "upload" | "map" | "preview" | "done";
interface FileData {
  name: string;
  headers: string[];
  rows: string[][];
}

const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "dmy", label: "Day / Month / Year (07/10/2026)" },
  { value: "mdy", label: "Month / Day / Year (10/07/2026)" },
  { value: "ymd", label: "Year-Month-Day (2026-10-07)" },
];

const selectClass = "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-base md:text-sm dark:bg-input/30";

export function ImportPanel() {
  const { user } = useSession();
  const { categories } = useCategories();
  const [step, setStep] = useState<Step>("upload");
  const [type, setType] = useState<ImportType>("expenses");
  const [file, setFile] = useState<FileData | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [options, setOptions] = useState<Omit<ImportOptions, "type">>({
    dateFormat: "dmy",
    defaultPaymentMethod: "upi",
    fallbackCategoryId: "other",
    createMissingCategories: false,
    skipNegative: true,
  });
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [filter, setFilter] = useState<"all" | "valid" | "duplicate" | "invalid">("all");
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ importId: string; imported: number; skipped: number; duplicates: number; invalid: number } | null>(null);

  function reset() {
    setStep("upload");
    setFile(null);
    setRows(null);
    setResult(null);
    setFileError(null);
    setIncludeDuplicates(false);
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    event.target.value = "";
    setFileError(null);
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name) && f.type !== "text/csv") return setFileError("Choose a .csv file.");
    if (f.size > IMPORT_LIMITS.maxBytes) return setFileError("File is larger than 2 MB. Split it into smaller files.");
    const text = await f.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) return setFileError("The file needs a header row and at least one data row.");
    const [headers, ...data] = parsed;
    if (data.length > IMPORT_LIMITS.maxRows) return setFileError(`Too many rows (${data.length}). The limit is ${IMPORT_LIMITS.maxRows} per import.`);
    const map = autoMapColumns(headers, type);
    setFile({ name: f.name, headers: headers.map((h, i) => h.trim() || `Column ${i + 1}`), rows: data });
    setMapping(map);
    if (map.date !== undefined) setOptions((o) => ({ ...o, dateFormat: detectDateFormat(data.slice(0, 50).map((r) => r[map.date!] ?? "")) }));
    setStep("map");
  }

  const missingRequired = IMPORT_FIELDS[type].filter((f) => f.required && mapping[f.field] === undefined);

  async function buildPreview() {
    if (!file) return;
    setChecking(true);
    try {
      const opts: ImportOptions = { ...options, type };
      // First pass without existing data to find the date span, then fetch only that span.
      const draft = parseImportRows(file.rows, mapping, opts, { categories, existingFingerprints: new Set() });
      const span = dateSpan(draft.filter((r) => r.status !== "invalid"));
      const existing = span ? await existingFingerprints(user.uid, type, span) : new Set<string>();
      setRows(parseImportRows(file.rows, mapping, opts, { categories, existingFingerprints: existing }));
      setFilter("all");
      setStep("preview");
    } catch (error) {
      toast.error("Couldn't check for duplicates", { description: getErrorMessage(error) });
    } finally {
      setChecking(false);
    }
  }

  const summary = rows ? summarizeRows(rows) : null;
  const toImport = useMemo(() => (rows ?? []).filter((r) => r.status === "valid" || (includeDuplicates && r.status === "duplicate")), [rows, includeDuplicates]);

  async function confirmImport() {
    if (!file || !rows || !summary) return;
    setImporting({ done: 0, total: toImport.length });
    try {
      const skippedDuplicates = includeDuplicates ? 0 : summary.duplicates;
      const res = await runImport(
        user.uid,
        {
          type,
          fileName: file.name,
          rows: toImport,
          counts: { total: summary.total, duplicates: summary.duplicates, invalid: summary.invalid, skipped: skippedDuplicates + summary.invalid },
        },
        (done) => setImporting({ done, total: toImport.length }),
      );
      setResult({ ...res, skipped: skippedDuplicates + summary.invalid, duplicates: summary.duplicates, invalid: summary.invalid });
      setStep("done");
      toast.success(`${res.imported} ${type === "expenses" ? "expenses" : "income entries"} imported`);
    } catch (error) {
      toast.error("Import stopped", { description: `${getErrorMessage(error)} Rows already written can be undone from Recent imports.` });
    } finally {
      setImporting(null);
    }
  }

  const visible = (rows ?? []).filter((r) => filter === "all" || r.status === filter);

  return (
    <SectionCard id="import" title="Import" action={step !== "upload" ? <Button variant="ghost" size="sm" onClick={reset}>Start over</Button> : undefined}>
      <ol className="mb-4 flex gap-1 text-[11px] font-medium text-muted-foreground" aria-label="Import steps">
        {(["upload", "map", "preview", "done"] as Step[]).map((s, i) => (
          <li key={s} aria-current={step === s ? "step" : undefined} className={cn("flex-1 rounded-full border px-2 py-1 text-center", step === s && "border-primary bg-primary/10 text-foreground")}>
            {i + 1}. {s === "upload" ? "File" : s === "map" ? "Columns" : s === "preview" ? "Review" : "Done"}
          </li>
        ))}
      </ol>

      {step === "upload" ? (
        <div className="space-y-4">
          <Segmented<ImportType>
            name="import-type"
            label="What are you importing?"
            value={type}
            onChange={setType}
            options={[
              { value: "expenses", label: "Expenses" },
              { value: "incomes", label: "Income" },
            ]}
          />
          <label
            htmlFor="import-file"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center outline-none hover:bg-muted/40 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
          >
            <FileUp className="size-8 text-muted-foreground" aria-hidden />
            <span className="font-medium">Choose a CSV file</span>
            <span className="text-xs text-muted-foreground">Bank statement or another app&apos;s export · up to 2 MB, {IMPORT_LIMITS.maxRows} rows</span>
            <input id="import-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
          </label>
          {fileError ? (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" aria-hidden />
              {fileError}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Nothing is saved until you review and confirm. Imported entries aren&apos;t linked to accounts, because your current balances already include past transactions.
          </p>
        </div>
      ) : null}

      {step === "map" && file ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{file.name}</span> · {file.rows.length} rows. Match your columns:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {IMPORT_FIELDS[type].map(({ field, label, required }) => {
              const idx = mapping[field];
              return (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={`map-${field}`}>
                    {label} {required ? <span className="text-destructive">*</span> : <span className="font-normal text-muted-foreground">(optional)</span>}
                  </Label>
                  <select
                    id={`map-${field}`}
                    className={selectClass}
                    value={idx ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  >
                    <option value="">— Not in file —</option>
                    {file.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                  {idx !== undefined ? (
                    <p className="truncate text-xs text-muted-foreground">e.g. {file.rows.slice(0, 3).map((r) => r[idx] || "—").join(" · ")}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="map-date-format">Date format</Label>
              <select id="map-date-format" className={selectClass} value={options.dateFormat} onChange={(e) => setOptions((o) => ({ ...o, dateFormat: e.target.value as DateFormat }))}>
                {DATE_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            {type === "expenses" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="map-method">Payment method when missing</Label>
                  <select id="map-method" className={selectClass} value={options.defaultPaymentMethod} onChange={(e) => setOptions((o) => ({ ...o, defaultPaymentMethod: e.target.value as ImportOptions["defaultPaymentMethod"] }))}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_META[m].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="map-fallback">Category when blank or unknown</Label>
                  <select id="map-fallback" className={selectClass} value={options.fallbackCategoryId} onChange={(e) => setOptions((o) => ({ ...o, fallbackCategoryId: e.target.value }))}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
          </div>
          {type === "expenses" ? (
            <SwitchField
              id="map-create-categories"
              label="Create categories that don't exist yet"
              description="Otherwise unknown categories use the fallback above."
              checked={options.createMissingCategories}
              onCheckedChange={(v) => setOptions((o) => ({ ...o, createMissingCategories: v }))}
            />
          ) : null}
          <SwitchField
            id="map-skip-negative"
            label="Skip negative amounts"
            description="Bank exports often list refunds or credits as negative numbers. Turn off to import them as positive values."
            checked={options.skipNegative}
            onCheckedChange={(v) => setOptions((o) => ({ ...o, skipNegative: v }))}
          />
          {missingRequired.length ? (
            <p role="alert" className="text-sm text-destructive">Map {missingRequired.map((f) => f.label).join(" and ")} to continue.</p>
          ) : null}
          <Button className="h-12 w-full rounded-xl text-base" disabled={missingRequired.length > 0 || checking} onClick={buildPreview}>
            {checking ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Review rows
          </Button>
        </div>
      ) : null}

      {step === "preview" && rows && summary ? (
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Show rows" className="grid grid-cols-4 gap-2 text-center">
            {(
              [
                ["all", "All", summary.total, ""],
                ["valid", "Ready", summary.valid, "text-emerald-600 dark:text-emerald-400"],
                ["duplicate", "Duplicates", summary.duplicates, "text-amber-600 dark:text-amber-400"],
                ["invalid", "Invalid", summary.invalid, "text-destructive"],
              ] as const
            ).map(([key, label, count, tone]) => (
              <label key={key} className={cn("cursor-pointer rounded-2xl border p-2 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50", filter === key && "border-primary bg-primary/5")}>
                <input type="radio" name="import-filter" className="sr-only" checked={filter === key} onChange={() => setFilter(key)} />
                <span className={cn("block text-lg font-semibold tabular-nums", tone)}>{count}</span>
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </label>
            ))}
          </div>

          <div className="max-h-96 overflow-auto rounded-2xl border">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Import preview</caption>
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th scope="col" className="px-2 py-2 font-medium">Line</th>
                  <th scope="col" className="px-2 py-2 font-medium">Date</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Amount</th>
                  <th scope="col" className="px-2 py-2 font-medium">Details</th>
                  <th scope="col" className="px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.slice(0, 200).map((r) => (
                  <tr key={r.line} className={cn(r.status === "invalid" && "bg-destructive/5", r.status === "duplicate" && "bg-amber-500/5")}>
                    <td className="px-2 py-2 text-muted-foreground tabular-nums">{r.line}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{r.date ? format(r.date, "d MMM yy") : "—"}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">{r.amount ? <Money amount={r.amount} /> : "—"}</td>
                    <td className="max-w-40 truncate px-2 py-2">
                      {r.note || "—"}
                      {type === "expenses" ? (
                        <span className="block truncate text-muted-foreground">
                          {r.categoryId ? categories.find((c) => c.id === r.categoryId)?.name ?? r.categoryId : `New: ${r.newCategoryName}`} · {PAYMENT_METHOD_META[r.paymentMethod].label}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <span className={cn("inline-flex items-center gap-1 font-medium", r.status === "valid" ? "text-emerald-600 dark:text-emerald-400" : r.status === "duplicate" ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>
                        {r.status === "valid" ? <CheckCircle2 className="size-3.5" aria-hidden /> : r.status === "duplicate" ? <Copy className="size-3.5" aria-hidden /> : <AlertCircle className="size-3.5" aria-hidden />}
                        {r.status === "valid" ? "Ready" : r.status === "duplicate" ? "Duplicate" : "Invalid"}
                      </span>
                      {[...r.errors, ...r.warnings].map((m) => (
                        <span key={m} className="block text-[11px] text-muted-foreground">{m}</span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length > 200 ? <p className="p-2 text-center text-xs text-muted-foreground">Showing 200 of {visible.length} rows</p> : null}
          </div>

          {summary.duplicates > 0 ? (
            <SwitchField
              id="import-duplicates"
              label={`Also import ${summary.duplicates} duplicate${summary.duplicates === 1 ? "" : "s"}`}
              description="Duplicates match an existing entry (or an earlier row) on date, amount and note. They're skipped by default."
              checked={includeDuplicates}
              onCheckedChange={setIncludeDuplicates}
            />
          ) : null}
          {importing ? (
            <div role="status" className="space-y-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(importing.done / Math.max(importing.total, 1)) * 100}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                Importing {importing.done} of {importing.total}…
              </p>
            </div>
          ) : null}
          <Button className="h-12 w-full rounded-xl text-base" disabled={toImport.length === 0 || importing !== null} onClick={confirmImport}>
            {importing ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
            Import {toImport.length} {toImport.length === 1 ? "row" : "rows"}
          </Button>
        </div>
      ) : null}

      {step === "done" && result ? (
        <div className="space-y-4" role="status">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-5" aria-hidden />
            <p className="font-semibold">Import complete</p>
          </div>
          <dl className="grid grid-cols-4 gap-2 text-center">
            {(
              [
                ["Imported", result.imported],
                ["Skipped", result.skipped],
                ["Duplicate", result.duplicates],
                ["Invalid", result.invalid],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-muted/60 p-2">
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                <dt className="text-[11px] text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
          <Button variant="outline" className="h-11 w-full rounded-xl" onClick={reset}>
            Import another file
          </Button>
        </div>
      ) : null}

      <RecentImports />
    </SectionCard>
  );
}

function RecentImports() {
  const { user } = useSession();
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [undoing, setUndoing] = useState<ImportLog | null>(null);
  useEffect(() => subscribeImports(user.uid, setLogs, () => setLogs([])), [user.uid]);
  if (!logs.length) return null;
  return (
    <div className="mt-6 space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Recent imports</h3>
      <ul className="divide-y rounded-2xl border">
        {logs.map((l) => (
          <li key={l.id} className="flex items-center gap-3 p-3 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{l.fileName}</span>
              <span className="block text-xs text-muted-foreground">
                {format(l.createdAt, "d MMM, h:mm a")} · {l.imported} {l.type === "expenses" ? "expenses" : "income"}
                {l.status === "undone" ? " · undone" : l.status === "importing" ? " · incomplete" : ""}
              </span>
            </span>
            {l.status !== "undone" ? (
              <Button variant="ghost" size="sm" onClick={() => setUndoing(l)}>
                <RotateCcw aria-hidden />
                Undo
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={undoing !== null}
        onOpenChange={(o) => !o && setUndoing(null)}
        title="Undo this import?"
        description={undoing ? `All ${undoing.imported} entries created by “${undoing.fileName}” will be deleted. Entries you added yourself aren't affected.` : ""}
        confirmLabel="Undo import"
        icon={RotateCcw}
        onConfirm={async () => {
          if (!undoing) return;
          try {
            const removed = await undoImport(user.uid, undoing);
            setUndoing(null);
            toast.success(`Import undone · ${removed} entries removed`);
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
        }}
      />
    </div>
  );
}
