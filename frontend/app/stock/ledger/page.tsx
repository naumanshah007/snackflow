"use client";

import { Download, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch, money, packets } from "@/lib/api";
import { cartonLabel } from "@/lib/cartons";
import { exportCsv } from "@/lib/csv";
import type { AnyRow } from "@/lib/types";

export default function StockLedgerPage() {
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    setRows(await apiFetch<AnyRow[]>(`/stock-ledger?${params.toString()}`));
  };

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminShell title="Stock Ledger">
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-white/80 bg-white/75 p-4 shadow-lift backdrop-blur">
        <label className="min-w-72 flex-1">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Search SKU</span>
          <input className="field" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <button onClick={load} className="btn-dark">
          <RefreshCcw size={16} /> Apply
        </button>
        <button
          onClick={() =>
            exportCsv("stock-ledger.csv", rows, [
              { key: "occurred_at", header: "Date", value: (row) => new Date(row.occurred_at as string).toLocaleString() },
              { key: "movement_type", header: "Type" },
              { key: "warehouse_name", header: "Warehouse" },
              { key: "sku_name", header: "SKU" },
              { key: "cartons", header: "Cartons" },
              { key: "loose_packets", header: "Loose Packets" },
              { key: "quantity_packets", header: "Total Packets" },
              { key: "cost_per_carton", header: "Cost per Carton" },
              { key: "reference_type", header: "Reference" },
              { key: "created_by_id", header: "Created By" }
            ])
          }
          className="btn-soft"
        >
          <Download size={16} /> CSV
        </button>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: "occurred_at", label: "Date", render: (row) => new Date(row.occurred_at).toLocaleString() },
          { key: "warehouse_name", label: "Warehouse" },
          { key: "sku_name", label: "SKU" },
          { key: "movement_type", label: "Type" },
          {
            key: "carton_label",
            label: "Quantity (cartons)",
            render: (row) => (
              <div>
                <div className="font-semibold text-slate-900">{row.carton_label || cartonLabel(row.quantity_packets, row.pack_quantity)}</div>
                <div className="text-xs text-slate-500">{packets(row.quantity_packets)} packets</div>
              </div>
            )
          },
          { key: "cost_per_carton", label: "Cost / Carton", render: (row) => money(row.cost_per_carton) },
          { key: "reference_type", label: "Reference" },
          { key: "notes", label: "Notes" }
        ]}
      />
    </AdminShell>
  );
}
