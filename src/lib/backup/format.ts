import { z } from "zod";

import { ACCOUNT_TYPES, INVESTMENT_KINDS, RECURRENCE_UNITS } from "@/lib/constants/accounts";
import { CATEGORY_COLOR_KEYS } from "@/lib/constants/colors";
import { CURRENCY_CODES } from "@/lib/constants/currencies";
import { CATEGORY_ICON_KEYS } from "@/lib/constants/icons";
import { INCOME_SOURCES } from "@/lib/constants/income";
import { PAYMENT_METHODS } from "@/lib/constants/payment-methods";
import { fingerprint } from "@/lib/csv/import";

export const BACKUP_APP = "ledger";
export const BACKUP_VERSION = 1;
export const BACKUP_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Collections in restore order: parents before children so references resolve, ledger
 * records after the accounts/loans/goals/holdings they point to. `monthlyStats` is derived
 * and rebuilt after a restore; import/restore logs aren't backed up.
 */
export const BACKUP_COLLECTIONS = [
  "categories",
  "accounts",
  "emis",
  "goals",
  "investments",
  "recurringPayments",
  "recurringIncomes",
  "budgets",
  "netWorth",
  "expenses",
  "incomes",
  "transfers",
  "investmentTransactions",
  "emiPayments",
  "goalContributions",
] as const;
export type BackupCollection = (typeof BACKUP_COLLECTIONS)[number];

/** Sub-collections are stored flat with their parent id. */
export const SUBCOLLECTIONS: Partial<Record<BackupCollection, { parent: "emis" | "goals"; name: string }>> = {
  emiPayments: { parent: "emis", name: "payments" },
  goalContributions: { parent: "goals", name: "contributions" },
};

export const COLLECTION_LABELS: Record<BackupCollection, string> = {
  categories: "Custom categories",
  accounts: "Accounts & cards",
  emis: "EMIs",
  goals: "Wishlist",
  investments: "Investments",
  recurringPayments: "Recurring payments",
  recurringIncomes: "Recurring income",
  budgets: "Budgets",
  netWorth: "Net-worth snapshots",
  expenses: "Expenses",
  incomes: "Income",
  transfers: "Transfers & card payments",
  investmentTransactions: "Investment history",
  emiPayments: "EMI payments",
  goalContributions: "Wishlist contributions",
};

// ---------------------------------------------------------------- JSON encoding

/** Firestore Timestamps/Dates ⇄ {"$date": ISO}; everything else is plain JSON. */
export function encodeValue(value: unknown): unknown {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return { $date: (value as { toDate: () => Date }).toDate().toISOString() };
  }
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeValue(v)]));
  return value;
}

export function decodeValue(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).length === 1 && typeof obj.$date === "string") {
      const d = new Date(obj.$date);
      if (Number.isNaN(d.getTime())) throw new Error(`Invalid date ${obj.$date}`);
      return d;
    }
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, decodeValue(v)]));
  }
  if (Array.isArray(value)) return value.map(decodeValue);
  return value;
}

// ---------------------------------------------------------------- schemas (mirror firestore.rules)

const id = z.string().min(1).max(128).regex(/^[^/]+$/, "Invalid id");
const optId = id.nullable();
const minor = z.number().int().positive().max(1_000_000_000_000);
const signed = z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000);
const date = z.date();
const note = z.string().max(280);
const name = (max: number) => z.string().trim().min(1).max(max);
const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const day = z.number().int().min(1).max(31);

/** `.strict()` rejects unknown fields — a backup can't smuggle extra data in. */
export const DOC_SCHEMAS = {
  categories: z.object({ name: name(32), icon: z.enum(CATEGORY_ICON_KEYS), color: z.enum(CATEGORY_COLOR_KEYS), archived: z.boolean() }).strict(),
  accounts: z
    .object({
      name: name(40),
      type: z.enum(ACCOUNT_TYPES),
      institution: z.string().max(60).nullable(),
      openingBalance: signed,
      balance: signed,
      active: z.boolean(),
      creditLimit: minor.nullable(),
      statementDay: day.nullable(),
      dueDay: day.nullable(),
      statementBalance: z.number().int().min(0).nullable(),
      minimumDue: z.number().int().min(0).nullable(),
    })
    .strict(),
  emis: z
    .object({
      name: name(40),
      lender: z.string().max(60).nullable(),
      principal: minor,
      annualRateBps: z.number().int().min(0).max(10000),
      monthlyAmount: minor,
      tenureMonths: z.number().int().min(1).max(480),
      startDate: date,
      paidCount: z.number().int().min(0),
      outstanding: z.number().int().min(0),
      status: z.enum(["active", "closed"]),
    })
    .strict(),
  goals: z
    .object({
      name: name(40),
      icon: z.string().max(32),
      color: z.string().max(32),
      targetAmount: minor,
      savedAmount: z.number().int().min(0),
      targetDate: date.nullable(),
      status: z.enum(["active", "archived"]),
    })
    .strict(),
  investments: z
    .object({
      name: name(40),
      kind: z.enum(INVESTMENT_KINDS),
      institution: z.string().max(60).nullable(),
      investedAmount: z.number().int().min(0),
      currentValue: z.number().int().min(0),
      realizedGain: signed,
      purchaseDate: date,
      lastValuedAt: date,
      status: z.enum(["active", "closed"]),
    })
    .strict(),
  recurringPayments: z
    .object({
      name: name(40),
      amount: minor,
      categoryId: id,
      paymentMethod: z.enum(PAYMENT_METHODS),
      accountId: optId,
      unit: z.enum(RECURRENCE_UNITS),
      interval: z.number().int().min(1).max(365),
      startDate: date,
      cycle: z.number().int().min(0),
      nextDate: date,
      endDate: date.nullable(),
      active: z.boolean(),
      autoPay: z.boolean().optional(),
    })
    .strict(),
  recurringIncomes: z
    .object({
      name: name(40),
      source: z.enum(INCOME_SOURCES),
      amount: minor,
      dayOfMonth: day,
      startMonth: monthKey,
      active: z.boolean(),
      accountId: optId.optional(),
      autoRecord: z.boolean().optional(),
    })
    .strict(),
  budgets: z.object({ month: monthKey, overall: minor.nullable(), categories: z.record(id, minor) }).strict(),
  netWorth: z.object({ month: monthKey, assets: z.number().int(), liabilities: z.number().int().min(0), netWorth: z.number().int() }).strict(),
  expenses: z
    .object({
      type: z.literal("EXPENSE").optional(),
      amount: minor,
      categoryId: id,
      paymentMethod: z.enum(PAYMENT_METHODS),
      note,
      occurredAt: date,
      accountId: optId.optional(),
      recurringId: optId.optional(),
      occurrence: z.number().int().min(0).nullable().optional(),
    })
    .strict(),
  incomes: z
    .object({
      type: z.literal("INCOME").optional(),
      amount: minor,
      source: z.enum(INCOME_SOURCES),
      note,
      receivedAt: date,
      forMonth: monthKey,
      expectedAt: date.nullable(),
      recurringId: optId,
      accountId: optId.optional(),
    })
    .strict(),
  transfers: z
    .object({
      type: z.enum(["TRANSFER", "DEBT_PAYMENT"]),
      amount: minor,
      fromAccountId: id,
      toAccountId: optId,
      emiId: optId,
      emiInstallment: z.number().int().min(1).nullable(),
      note,
      occurredAt: date,
    })
    .strict(),
  investmentTransactions: z
    .object({
      investmentId: id,
      type: z.literal("INVESTMENT"),
      kind: z.enum(["BUY", "SELL", "VALUATION"]),
      amount: z.number().int().min(0).max(1_000_000_000_000),
      costBasis: z.number().int().min(0).nullable(),
      accountId: optId,
      note,
      occurredAt: date,
    })
    .strict(),
  emiPayments: z
    .object({
      installment: z.number().int().min(1),
      amount: minor,
      principalPart: z.number().int().min(0),
      interestPart: z.number().int().min(0),
      dueDate: date,
      paidAt: date,
      expenseId: optId,
      accountId: optId.optional(),
    })
    .strict()
    .refine((p) => p.principalPart + p.interestPart === p.amount, "principal + interest must equal amount"),
  goalContributions: z
    .object({ amount: z.number().int().refine((v) => v !== 0, "must not be zero"), note, contributedAt: date })
    .strict(),
} satisfies Record<BackupCollection, z.ZodType>;

/** Server-managed or session-specific fields dropped on export and ignored on restore. */
export const STRIPPED_FIELDS = ["createdAt", "updatedAt", "lastOpId", "importId", "restoreId"] as const;

export interface BackupDoc {
  id: string;
  /** Parent document id for sub-collections. */
  parentId?: string;
  data: Record<string, unknown>;
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  createdAt: string;
  profile: { displayName: string | null; currency: string };
  collections: Partial<Record<BackupCollection, BackupDoc[]>>;
}

export function stripFields(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  for (const f of STRIPPED_FIELDS) delete out[f];
  return out;
}

// ---------------------------------------------------------------- validation & planning

export interface ValidationIssue {
  collection: BackupCollection | "file";
  id?: string;
  message: string;
}

export interface ValidatedBackup {
  createdAt: Date;
  profile: { displayName: string | null; currency: string | null };
  docs: Record<BackupCollection, BackupDoc[]>;
  issues: ValidationIssue[];
}

/** Parses and validates a backup file. Invalid documents are reported and excluded. */
export function validateBackup(text: string): ValidatedBackup {
  const issues: ValidationIssue[] = [];
  const empty = Object.fromEntries(BACKUP_COLLECTIONS.map((c) => [c, []])) as unknown as Record<BackupCollection, BackupDoc[]>;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { createdAt: new Date(NaN), profile: { displayName: null, currency: null }, docs: empty, issues: [{ collection: "file", message: "Not valid JSON." }] };
  }
  const header = z
    .object({ app: z.literal(BACKUP_APP), version: z.number().int(), createdAt: z.string(), profile: z.object({}).passthrough(), collections: z.record(z.string(), z.array(z.unknown())) })
    .safeParse(raw);
  if (!header.success) {
    return { createdAt: new Date(NaN), profile: { displayName: null, currency: null }, docs: empty, issues: [{ collection: "file", message: "This isn't a Spend backup file." }] };
  }
  if (header.data.version > BACKUP_VERSION) {
    issues.push({ collection: "file", message: `Backup version ${header.data.version} is newer than this app supports (${BACKUP_VERSION}). Update the app first.` });
    return { createdAt: new Date(header.data.createdAt), profile: { displayName: null, currency: null }, docs: empty, issues };
  }
  for (const key of Object.keys(header.data.collections)) {
    if (!(BACKUP_COLLECTIONS as readonly string[]).includes(key)) issues.push({ collection: "file", message: `Unknown collection “${key}” ignored.` });
  }

  const docs = { ...empty };
  for (const collection of BACKUP_COLLECTIONS) {
    const list = header.data.collections[collection] ?? [];
    const seen = new Set<string>();
    for (const entry of list) {
      const shape = z.object({ id, parentId: id.optional(), data: z.record(z.string(), z.unknown()) }).safeParse(entry);
      if (!shape.success) {
        issues.push({ collection, message: "Malformed entry skipped." });
        continue;
      }
      const key = `${shape.data.parentId ?? ""}/${shape.data.id}`;
      if (seen.has(key)) {
        issues.push({ collection, id: shape.data.id, message: "Duplicate id inside the backup; kept the first." });
        continue;
      }
      seen.add(key);
      if (SUBCOLLECTIONS[collection] && !shape.data.parentId) {
        issues.push({ collection, id: shape.data.id, message: "Missing parent id." });
        continue;
      }
      let data: Record<string, unknown>;
      try {
        data = stripFields(decodeValue(shape.data.data) as Record<string, unknown>);
      } catch (e) {
        issues.push({ collection, id: shape.data.id, message: (e as Error).message });
        continue;
      }
      const parsed = DOC_SCHEMAS[collection].safeParse(data);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        issues.push({ collection, id: shape.data.id, message: `${first.path.join(".") || "document"}: ${first.message}` });
        continue;
      }
      if (collection === "budgets" && (parsed.data as { month: string }).month !== shape.data.id) {
        issues.push({ collection, id: shape.data.id, message: "Budget id must equal its month." });
        continue;
      }
      docs[collection].push({ id: shape.data.id, parentId: shape.data.parentId, data: parsed.data as Record<string, unknown> });
    }
  }

  const profile = z.object({ displayName: z.string().max(50).nullable().optional(), currency: z.enum(CURRENCY_CODES).optional() }).safeParse(header.data.profile);
  return {
    createdAt: new Date(header.data.createdAt),
    profile: { displayName: profile.success ? profile.data.displayName ?? null : null, currency: profile.success ? profile.data.currency ?? null : null },
    docs,
    issues,
  };
}

/** Content fingerprint for transactional docs (catches the same expense saved under another id). */
export function contentKey(collection: BackupCollection, data: Record<string, unknown>): string | null {
  if (collection === "expenses") return fingerprint(data.occurredAt as Date, data.amount as number, String(data.note ?? ""));
  if (collection === "incomes") return fingerprint(data.receivedAt as Date, data.amount as number, String(data.note ?? ""));
  return null;
}

export interface RestorePlanEntry {
  collection: BackupCollection;
  toCreate: BackupDoc[];
  /** Same id already exists — never overwritten. */
  existing: number;
  /** Different id, same content (date + amount + note) as something you have. */
  duplicates: number;
}

/**
 * Decides what a restore would write. Anything whose id already exists, or whose content
 * duplicates an existing record, is skipped — a restore never overwrites or doubles data.
 */
export function planRestore(
  backup: ValidatedBackup,
  existing: { ids: Record<BackupCollection, ReadonlySet<string>>; contentKeys: Partial<Record<BackupCollection, ReadonlySet<string>>> },
): RestorePlanEntry[] {
  return BACKUP_COLLECTIONS.map((collection) => {
    const ids = existing.ids[collection];
    const keys = existing.contentKeys[collection];
    let existingCount = 0;
    let duplicates = 0;
    const toCreate: BackupDoc[] = [];
    for (const d of backup.docs[collection]) {
      const docKey = d.parentId ? `${d.parentId}/${d.id}` : d.id;
      if (ids.has(docKey)) {
        existingCount++;
        continue;
      }
      const ck = contentKey(collection, d.data);
      if (ck && keys?.has(ck)) {
        duplicates++;
        continue;
      }
      toCreate.push(d);
    }
    return { collection, toCreate, existing: existingCount, duplicates };
  });
}
