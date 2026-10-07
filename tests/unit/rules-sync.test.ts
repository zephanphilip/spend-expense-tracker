import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CATEGORY_COLOR_KEYS } from "@/lib/constants/colors";
import { CURRENCY_CODES } from "@/lib/constants/currencies";
import { CATEGORY_ICON_KEYS } from "@/lib/constants/icons";
import { PAYMENT_METHODS } from "@/lib/constants/payment-methods";
import { DEFAULT_CATEGORIES } from "@/lib/constants/categories";

const rules = readFileSync(join(process.cwd(), "firestore.rules"), "utf8");

/** Extracts the string list following `<field> in [` in the rules file. */
function listAfter(field: string): string[] {
  const match = new RegExp(`${field.replace(".", "\\.")} in \\[([^\\]]*)\\]`).exec(rules);
  if (!match) throw new Error(`No allow-list for ${field} in firestore.rules`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe("firestore.rules stays in sync with app constants", () => {
  it("payment methods", () => {
    expect(listAfter("data.paymentMethod").sort()).toEqual([...PAYMENT_METHODS].sort());
  });
  it("category icons", () => {
    expect(listAfter("data.icon").sort()).toEqual([...CATEGORY_ICON_KEYS].sort());
  });
  it("category colors", () => {
    expect(listAfter("data.color").sort()).toEqual([...CATEGORY_COLOR_KEYS].sort());
  });
  it("currencies", () => {
    expect(listAfter("data.currency").sort()).toEqual([...CURRENCY_CODES].sort());
  });
  it("default categories use valid icons/colors and unique ids", () => {
    const ids = DEFAULT_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of DEFAULT_CATEGORIES) {
      expect(CATEGORY_ICON_KEYS).toContain(c.icon);
      expect(CATEGORY_COLOR_KEYS).toContain(c.color);
    }
  });
});
