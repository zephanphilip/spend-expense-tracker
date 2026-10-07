/**
 * Per-device expense-entry memory shared by every way of adding an expense (the Add sheet,
 * Quick Add, deep links). Lives in localStorage: losing it only loses the ordering hints.
 */
import {
  DEFAULT_PAYMENT_METHOD,
  isPaymentMethod,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/constants/payment-methods";
import type { Account, AccountType } from "@/types";

const LAST_METHOD_KEY = "ledger:last-payment-method";
const METHOD_ACCOUNT_KEY = "ledger:method-accounts";
const USAGE_KEY = "ledger:expense-usage";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode); defaults still work.
  }
}

// ── Payment method & account ────────────────────────────────────────────────────────────

/** Account types that fit each payment method, best match first. */
const METHOD_ACCOUNT_TYPES: Record<PaymentMethod, AccountType[]> = {
  credit: ["credit_card"],
  debit: ["bank"],
  upi: ["bank", "wallet"],
  cash: ["cash"],
};

export function readLastPaymentMethod(): PaymentMethod {
  try {
    const value = localStorage.getItem(LAST_METHOD_KEY);
    return isPaymentMethod(value) ? value : DEFAULT_PAYMENT_METHOD;
  } catch {
    return DEFAULT_PAYMENT_METHOD;
  }
}

function readMethodAccounts(): Partial<Record<PaymentMethod, string>> {
  const value = read<unknown>(METHOD_ACCOUNT_KEY, {});
  return value && typeof value === "object" ? (value as Partial<Record<PaymentMethod, string>>) : {};
}

/** Last account used with this method, else the first active account of a fitting type. */
export function defaultAccountFor(method: PaymentMethod, accounts: readonly Account[]): string {
  const remembered = readMethodAccounts()[method];
  if (remembered && accounts.some((a) => a.id === remembered && a.active)) return remembered;
  for (const type of METHOD_ACCOUNT_TYPES[method]) {
    const match = accounts.find((a) => a.active && a.type === type);
    if (match) return match.id;
  }
  return "";
}

// ── Usage (frequency + recency) ─────────────────────────────────────────────────────────

interface UsageEntry {
  count: number;
  /** Epoch ms of the last use. */
  last: number;
}

export interface ExpenseUsage {
  categories: Record<string, UsageEntry>;
  methods: Record<string, UsageEntry>;
}

const EMPTY_USAGE: ExpenseUsage = { categories: {}, methods: {} };

export function readExpenseUsage(): ExpenseUsage {
  const value = read<Partial<ExpenseUsage> | null>(USAGE_KEY, null);
  if (!value || typeof value !== "object") return EMPTY_USAGE;
  return {
    categories: value.categories && typeof value.categories === "object" ? value.categories : {},
    methods: value.methods && typeof value.methods === "object" ? value.methods : {},
  };
}

function bump(entries: Record<string, UsageEntry>, id: string, now: number) {
  const prev = entries[id];
  return { ...entries, [id]: { count: (prev?.count ?? 0) + 1, last: now } };
}

/** Pure: usage after one more expense. */
export function nextUsage(
  usage: ExpenseUsage,
  { categoryId, paymentMethod }: { categoryId: string; paymentMethod: PaymentMethod },
  now: number,
): ExpenseUsage {
  return {
    categories: bump(usage.categories, categoryId, now),
    methods: bump(usage.methods, paymentMethod, now),
  };
}

/**
 * Call after every new expense, whichever screen created it. Also remembers the method (and
 * its account) as the default for next time.
 */
export function rememberExpenseChoices(input: {
  categoryId: string;
  paymentMethod: PaymentMethod;
  accountId?: string | null;
}) {
  write(USAGE_KEY, nextUsage(readExpenseUsage(), input, Date.now()));
  write(LAST_METHOD_KEY, input.paymentMethod);
  if (input.accountId) write(METHOD_ACCOUNT_KEY, { ...readMethodAccounts(), [input.paymentMethod]: input.accountId });
}

const DAY_MS = 86_400_000;

/**
 * Frequency with a recency boost: a habit from months ago gradually yields to what's used
 * now (half-life ≈ 30 days), and anything used today gets a nudge to the top.
 */
function score(entry: UsageEntry | undefined, now: number): number {
  if (!entry) return 0;
  const ageDays = Math.max(0, (now - entry.last) / DAY_MS);
  return entry.count * Math.pow(0.5, ageDays / 30) + (ageDays < 1 ? 1 : 0);
}

/** Highest score first; never-used items keep their original order after the used ones. */
export function rankByUsage<T>(items: readonly T[], idOf: (item: T) => string, entries: Record<string, UsageEntry>, now: number): T[] {
  return items
    .map((item, index) => ({ item, index, score: score(entries[idOf(item)], now) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.item);
}

/** Ids used most recently first (at most `limit`). */
export function recentIds(entries: Record<string, UsageEntry>, limit: number): string[] {
  return Object.entries(entries)
    .sort(([, a], [, b]) => b.last - a.last)
    .slice(0, limit)
    .map(([id]) => id);
}

/** Payment methods, most used (recency-weighted) first. */
export function rankPaymentMethods(usage: ExpenseUsage, now: number): PaymentMethod[] {
  const ranked = rankByUsage(PAYMENT_METHODS, (m) => m, usage.methods, now);
  // With no history yet, lead with the remembered default.
  if (Object.keys(usage.methods).length === 0) {
    const last = readLastPaymentMethod();
    return [last, ...ranked.filter((m) => m !== last)];
  }
  return ranked;
}
