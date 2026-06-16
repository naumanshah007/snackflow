export type CsvColumn = {
  key: string;
  header: string;
  value?: (row: Record<string, unknown>) => unknown;
};

function escapeCell(value: unknown) {
  const cell = value == null ? "" : String(value);
  return `"${cell.replaceAll('"', '""')}"`;
}

// Export rows to CSV. Pass `columns` for an explicit, carton-friendly column
// order with readable headers; otherwise the object keys are used. A UTF-8 BOM
// is prepended so Excel opens the file with correct encoding.
export function exportCsv(filename: string, rows: Record<string, unknown>[], columns?: CsvColumn[]) {
  if (!rows.length) return;
  const cols: CsvColumn[] = columns?.length ? columns : Object.keys(rows[0]).map((key) => ({ key, header: key }));
  const headerLine = cols.map((col) => escapeCell(col.header)).join(",");
  const body = rows.map((row) => cols.map((col) => escapeCell(col.value ? col.value(row) : row[col.key])).join(",")).join("\n");
  const csv = `${headerLine}\n${body}`;
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
