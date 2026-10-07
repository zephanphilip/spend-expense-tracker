import { format as formatDate } from "date-fns";

import { INCOME_SOURCES } from "@/lib/constants/income";
import { monthKey } from "@/lib/months";
import { NOTE_MAX_LENGTH } from "@/lib/validation/expense";
import type { Category, IncomeSource, PaymentMethod } from "@/types";

import { type DateFormat, normalizeText, parseAmountValue, parseDateValue, parsePaymentMethod } from "./values";

export const IMPORT_LIMITS = { maxBytes: 2 * 1024 * 1024, maxRows: 5000 } as const;

export const IMPORT_TYPES = ["expenses", "incomes"] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

export type ImportField = "date" | "amount" | "category" | "note" | "paymentMethod" | "source";

export const IMPORT_FIELDS: Record<ImportType, { field: ImportField; label: string; required: boolean }[]> = {
  expenses: [
    { field: "date", label: "Date", required: true },
    { field: "amount", label: "Amount", required: true },
    { field: "category", label: "Category", required: false },
    { field: "note", label: "Note / description", required: false },
    { field: "paymentMethod", label: "Payment method", required: false },
  ],
  incomes: [
    { field: "date", label: "Date received", required: true },
    { field: "amount", label: "Amount", required: true },
    { field: "source", label: "Type (salary, freelance…)", required: false },
    { field: "note", label: "Note / description", required: false },
  ],
};

const SYNONYMS: Record<ImportField, string[]> = {
  date: ["date", "transaction date", "txn date", "value date", "posted", "day", "when", "occurred", "received", "date received"],
  amount: ["amount", "amt", "value", "debit", "withdrawal", "spent", "price", "total", "inr", "amount (inr)"],
  category: ["category", "categories", "type of expense", "tag", "label"],
  note: ["note", "notes", "description", "narration", "details", "remarks", "memo", "merchant", "particulars", "name"],
  paymentMethod: ["payment method", "method", "mode", "payment mode", "paid with", "instrument"],
  source: ["source", "income type", "type", "kind"],
};

/** Column index per field, guessed from header names (exact match first, then contains). */
export type ColumnMapping = Partial<Record<ImportField, number>>;

export function autoMapColumns(headers: readonly string[], type: ImportType): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalized = headers.map(normalizeText);
  const used = new Set<number>();
  for (const { field } of IMPORT_FIELDS[type]) {
    const words = SYNONYMS[field];
    let idx = normalized.findIndex((h, i) => !used.has(i) && words.includes(h));
    if (idx === -1) idx = normalized.findIndex((h, i) => !used.has(i) && words.some((w) => h.includes(w)));
    if (idx !== -1) {
      mapping[field] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

export interface ImportOptions {
  type: ImportType;
  dateFormat: DateFormat;
  /** Used when a row has no (recognisable) payment method. */
  defaultPaymentMethod: PaymentMethod;
  /** Category for rows whose category is blank or unknown. */
  fallbackCategoryId: string;
  /** Unknown category names get created as custom categories instead of the fallback. */
  createMissingCategories: boolean;
  /** Negative amounts (e.g. bank credits/refunds in an expense export) are skipped, not flipped. */
  skipNegative: boolean;
}

export type RowStatus = "valid" | "invalid" | "duplicate";

export interface ParsedRow {
  /** 1-based line number in the file (header = 1). */
  line: number;
  status: RowStatus;
  errors: string[];
  warnings: string[];
  date: Date | null;
  amount: number;
  note: string;
  categoryId: string | null;
  /** Category name to create when createMissingCategories is on. */
  newCategoryName: string | null;
  paymentMethod: PaymentMethod;
  source: IncomeSource;
  fingerprint: string;
}

/** Same day + same amount + same note (case/space-insensitive) ⇒ duplicate. */
export function fingerprint(date: Date, amount: number, note: string): string {
  return `${formatDate(date, "yyyy-MM-dd")}|${amount}|${normalizeText(note)}`;
}

function matchCategory(name: string, categories: readonly Category[]): Category | null {
  const n = normalizeText(name);
  return categories.find((c) => normalizeText(c.name) === n || c.id === n) ?? null;
}

function parseSource(raw: string): IncomeSource | null {
  const v = normalizeText(raw);
  if (!v) return null;
  if (v.includes("salary") || v.includes("payroll") || v.includes("wage")) return "salary";
  if (v.includes("freelance") || v.includes("consult") || v.includes("invoice")) return "freelance";
  if (v.includes("bonus") || v.includes("incentive")) return "bonus";
  return (INCOME_SOURCES as readonly string[]).includes(v) ? (v as IncomeSource) : "other";
}

/**
 * Validates every data row and marks duplicates — both within the file and against
 * `existingFingerprints` (expenses/incomes already saved in the file's date range).
 * Nothing is written; this powers the preview.
 */
export function parseImportRows(
  rows: readonly string[][],
  mapping: ColumnMapping,
  options: ImportOptions,
  { categories, existingFingerprints }: { categories: readonly Category[]; existingFingerprints: ReadonlySet<string> },
): ParsedRow[] {
  const seen = new Set<string>();
  const cell = (r: readonly string[], f: ImportField) => (mapping[f] === undefined ? "" : (r[mapping[f]!] ?? "").trim());

  return rows.map((r, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const rawDate = cell(r, "date");
    const date = parseDateValue(rawDate, options.dateFormat);
    if (!rawDate) errors.push("Missing date");
    else if (!date) errors.push(`Unrecognised date “${rawDate}”`);

    const rawAmount = cell(r, "amount");
    const parsed = parseAmountValue(rawAmount);
    let amount = 0;
    if (!rawAmount) errors.push("Missing amount");
    else if (!parsed) errors.push(`Unrecognised amount “${rawAmount}”`);
    else if (parsed.minor === 0) errors.push("Amount is zero");
    else if (parsed.negative && options.skipNegative) errors.push("Negative amount (refund/credit) skipped");
    else amount = parsed.minor;

    let note = cell(r, "note");
    if (note.length > NOTE_MAX_LENGTH) {
      note = note.slice(0, NOTE_MAX_LENGTH);
      warnings.push(`Note shortened to ${NOTE_MAX_LENGTH} characters`);
    }

    let categoryId: string | null = null;
    let newCategoryName: string | null = null;
    let paymentMethod = options.defaultPaymentMethod;
    let source: IncomeSource = "other";
    if (options.type === "expenses") {
      const rawCategory = cell(r, "category");
      const match = rawCategory ? matchCategory(rawCategory, categories) : null;
      if (match) categoryId = match.id;
      else if (rawCategory && options.createMissingCategories) newCategoryName = rawCategory.slice(0, 32);
      else {
        categoryId = options.fallbackCategoryId;
        if (rawCategory) warnings.push(`Unknown category “${rawCategory}” → fallback`);
      }
      const rawMethod = cell(r, "paymentMethod");
      const method = rawMethod ? parsePaymentMethod(rawMethod) : null;
      if (method) paymentMethod = method;
      else if (rawMethod) warnings.push(`Unknown payment method “${rawMethod}” → ${options.defaultPaymentMethod.toUpperCase()}`);
    } else {
      source = parseSource(cell(r, "source")) ?? "other";
    }

    const fp = date && amount ? fingerprint(date, amount, note) : `invalid-${i}`;
    let status: RowStatus = errors.length ? "invalid" : "valid";
    if (status === "valid") {
      if (existingFingerprints.has(fp)) {
        status = "duplicate";
        warnings.push("Already in your records");
      } else if (seen.has(fp)) {
        status = "duplicate";
        warnings.push("Repeated earlier in this file");
      }
      seen.add(fp);
    }

    return { line: i + 2, status, errors, warnings, date, amount, note, categoryId, newCategoryName, paymentMethod, source, fingerprint: fp };
  });
}

export interface ImportSummary {
  total: number;
  valid: number;
  duplicates: number;
  invalid: number;
}

export function summarizeRows(rows: readonly ParsedRow[]): ImportSummary {
  return {
    total: rows.length,
    valid: rows.filter((r) => r.status === "valid").length,
    duplicates: rows.filter((r) => r.status === "duplicate").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
  };
}

/** Date span of valid rows (to query existing records for duplicate checks). */
export function dateSpan(rows: readonly { date: Date | null }[]): { from: Date; to: Date } | null {
  const dates = rows.map((r) => r.date).filter((d): d is Date => d !== null);
  if (!dates.length) return null;
  return { from: new Date(Math.min(...dates.map(Number))), to: new Date(Math.max(...dates.map(Number))) };
}

export const forMonthOf = (d: Date) => monthKey(d);
