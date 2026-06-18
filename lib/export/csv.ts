/**
 * Render an array of records to a CSV blob string. Each record is an object
 * with the columns you want in the output — order is preserved from the first
 * record's keys. Values that contain commas, quotes or newlines are quoted.
 */
const FORMULA_PREFIX = /^[\t\r]*[=+\-@]/;

export function neutralizeCsvFormula(value: string): string {
  const trimmedStart = value.trimStart();
  if (FORMULA_PREFIX.test(value) || /^[=+\-@]/.test(trimmedStart)) {
    return `'${value}`;
  }
  return value;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = neutralizeCsvFormula(String(value));
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return columns ? columns.map(csvEscape).join(",") + "\n" : "";
  const cols = columns ?? Object.keys(rows[0]);
  const header = cols.map(csvEscape).join(",");
  const body = rows.map(r => cols.map(c => csvEscape(r[c])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

/** Build a Response that browsers will offer as a file download. */
export function csvResponse(rows: Array<Record<string, unknown>>, filename: string, columns?: string[]): Response {
  const body = toCSV(rows, columns);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
