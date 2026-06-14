"use client";

import { Download, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch, packets } from "@/lib/api";
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
        <button onClick={() => exportCsv("stock-ledger.csv", rows)} className="btn-soft">
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
          { key: "quantity_packets", label: "Packets", render: (row) => packets(row.quantity_packets) },
          { key: "reference_type", label: "Reference" },
          { key: "notes", label: "Notes" }
        ]}
      />
    </AdminShell>
  );
}
