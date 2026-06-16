"use client";

import type { ReactNode } from "react";

import type { AnyRow, ColumnConfig } from "@/lib/types";

export function DataTable({
  rows,
  columns,
  empty = "No records found"
}: {
  rows: AnyRow[];
  columns: ColumnConfig[];
  empty?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/80 bg-white/95 shadow-premium backdrop-blur">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200/80 text-sm">
          <thead className="bg-slate-950 text-left text-xs font-semibold uppercase text-slate-200">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-4 py-3.5 first:pl-5 last:pr-5">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-center text-sm text-slate-500" colSpan={columns.length}>
                  {typeof empty === "string" ? <div className="py-10">{empty}</div> : empty}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id ?? index} className="bg-white transition-colors hover:bg-orange-50/50">
                  {columns.map((column) => (
                    <td key={column.key} className="whitespace-nowrap px-4 py-3.5 text-slate-700 first:pl-5 last:pr-5">
                      {column.render ? column.render(row) : String(row[column.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
