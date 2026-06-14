"use client";

import { Download, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch, money, packets } from "@/lib/api";
import { exportCsv } from "@/lib/csv";
import type { AnyRow } from "@/lib/types";

export default function InventoryPage() {
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [warehouses, setWarehouses] = useState<AnyRow[]>([]);
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const load = async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (warehouseId) params.set("warehouse_id", warehouseId);
    if (lowOnly) params.set("low_stock_only", "true");
    setRows(await apiFetch<AnyRow[]>(`/inventory?${params.toString()}`));
  };

  useEffect(() => {
    apiFetch<AnyRow[]>("/warehouses").then(setWarehouses).catch(() => undefined);
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, lowOnly]);

  return (
    <AdminShell title="Inventory">
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-white/80 bg-white/75 p-4 shadow-lift backdrop-blur">
        <label className="min-w-64 flex-1">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Search SKU</span>
          <input className="field" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Warehouse</span>
          <select className="field min-w-48" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
            <option value="">All</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium shadow-sm">
          <input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} />
          Low stock only
        </label>
        <button onClick={load} className="btn-dark">
          <RefreshCcw size={16} /> Apply
        </button>
        <button onClick={() => exportCsv("inventory.csv", rows)} className="btn-soft">
          <Download size={16} /> CSV
        </button>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: "warehouse_name", label: "Warehouse" },
          { key: "sku_name", label: "SKU" },
          { key: "available_packets", label: "Packets", render: (row) => packets(row.available_packets) },
          { key: "cartons", label: "Cartons" },
          { key: "loose_packets", label: "Loose" },
          { key: "average_cost_per_packet", label: "Avg Cost", render: (row) => money(row.average_cost_per_packet) },
          { key: "stock_value", label: "Value", render: (row) => money(row.stock_value) },
          { key: "low_stock", label: "Status", render: (row) => (row.low_stock ? <span className="rounded bg-red-50 px-2 py-1 text-red-700">Low</span> : "OK") }
        ]}
      />
    </AdminShell>
  );
}
