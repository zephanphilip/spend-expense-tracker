import { describe, expect, it } from "vitest";

import {
  formatMoney,
  minorToInputString,
  parseAmountToMinor,
  sanitizeAmountInput,
} from "@/lib/money";

describe("parseAmountToMinor", () => {
  it.each([
    ["250", 25000],
    ["250.5", 25050],
    ["250.05", 25005],
    ["0.1", 10],
    [".5", 50],
    ["1,234.56", 123456],
    ["0.29", 29], // classic float trap: 0.29 * 100 = 28.999…
    ["1.005", null],
    ["", null],
    [".", null],
    ["abc", null],
    ["12.3.4", null],
    ["1234567890", null], // more than 9 integer digits
  ])("%s → %s", (input, expected) => {
    expect(parseAmountToMinor(input)).toBe(expected);
  });
});

describe("sanitizeAmountInput", () => {
  it.each([
    ["12a3", "123"],
    ["007", "7"],
    ["0", "0"],
    [".5", "0.5"],
    ["1.234", "1.23"],
    ["1..2", "1.2"],
    ["1.2.3", "1.23"],
    ["12,5", "12.5"],
    ["1234567890123", "123456789"],
  ])("%s → %s", (input, expected) => {
    expect(sanitizeAmountInput(input)).toBe(expected);
  });
});

describe("minorToInputString", () => {
  it("round-trips through the parser", () => {
    for (const minor of [1, 10, 99, 100, 12345, 25000, 99999999999]) {
      expect(parseAmountToMinor(minorToInputString(minor))).toBe(minor);
    }
  });
  it("drops zero fractions", () => {
    expect(minorToInputString(25000)).toBe("250");
    expect(minorToInputString(25050)).toBe("250.50");
  });
});

describe("formatMoney", () => {
  it("formats INR with Indian grouping and hides .00", () => {
    expect(formatMoney(12345600, "INR")).toBe("₹1,23,456");
    expect(formatMoney(12345650, "INR")).toBe("₹1,23,456.50");
  });
  it("formats USD", () => {
    expect(formatMoney(199, "USD")).toBe("$1.99");
  });
});
