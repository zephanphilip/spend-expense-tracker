/** RFC 4180 CSV parsing/writing with delimiter detection and spreadsheet-formula safety. */

export type Cell = string | number | null | undefined;

const DELIMITERS = [",", ";", "\t"] as const;

/** Picks the delimiter that splits the header line into the most columns (outside quotes). */
export function detectDelimiter(text: string): string {
  const firstLine = text.replace(/^﻿/, "").split(/\r\n|\n|\r/, 1)[0] ?? "";
  let best: string = ",";
  let bestCount = 0;
  for (const d of DELIMITERS) {
    let count = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Parses CSV text into rows of cells. Handles quoted fields, escaped quotes (""),
 * embedded delimiters/newlines, CRLF/LF/CR line endings and a UTF-8 BOM.
 * Blank lines are dropped.
 */
export function parseCsv(input: string, delimiter = detectDelimiter(input)): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * Cells that start with =, +, -, @ (or tab/CR) can be executed as formulas by spreadsheet
 * apps ("CSV injection"). Text cells get a leading apostrophe; real numbers are left alone.
 */
export function safeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const looksNumeric = /^-?\d+(\.\d+)?$/.test(value);
  return !looksNumeric && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function quote(value: string, delimiter: string): string {
  return /["\r\n]/.test(value) || value.includes(delimiter) || /^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialises rows; CRLF line endings and a BOM so Excel opens UTF-8 (₹) correctly. */
export function toCsv(rows: readonly (readonly Cell[])[], { delimiter = ",", bom = true } = {}): string {
  const body = rows.map((r) => r.map((c) => quote(safeCell(c), delimiter)).join(delimiter)).join("\r\n");
  return `${bom ? "﻿" : ""}${body}\r\n`;
}
