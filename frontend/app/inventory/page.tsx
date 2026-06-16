"use client";

import { Boxes, Download, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { apiFetch, money, packets } from "@/lib/api";
import { cartonLabel } from "@/lib/cartons";
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
      <div className="mb-4 flex items-center gap-2">
        <span className="chip border-orange-200 bg-orange-50 text-orange-700">
          <Boxes size={14} /> Carton-first · available cartons + loose packets
        </span>
      </div>
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
        <button
          onClick={() =>
            exportCsv("inventory.csv", rows, [
              { key: "sku_name", header: "SKU" },
              { key: "warehouse_name", header: "Warehouse" },
              { key: "pack_quantity", header: "Pack Quantity" },
              { key: "cartons", header: "Cartons" },
              { key: "loose_packets", header: "Loose Packets" },
              { key: "available_packets", header: "Total Packets" },
              { key: "average_cost_per_carton", header: "Cost per Carton" },
              { key: "average_cost_per_packet", header: "Cost per Packet" },
              { key: "stock_value", header: "Stock Value" }
            ])
          }
          className="btn-soft"
        >
          <Download size={16} /> CSV
        </button>
      </div>
      <DataTable
        rows={rows}
        empty={<EmptyState icon={Boxes} title="No stock to show" hint="Receive cartons or clear the filters to see balances." />}
        columns={[
          { key: "warehouse_name", label: "Warehouse" },
          { key: "sku_name", label: "SKU" },
          {
            key: "carton_label",
            label: "Stock (cartons)",
            render: (row) => (
              <div>
                <div className="font-semibold text-slate-900">{row.carton_label || cartonLabel(row.available_packets, row.pack_quantity)}</div>
                <div className="text-xs text-slate-500">{packets(row.available_packets)} packets · {row.pack_quantity}/carton</div>
              </div>
            )
          },
          { key: "average_cost_per_carton", label: "Cost / Carton", render: (row) => money(row.average_cost_per_carton) },
          { key: "average_cost_per_packet", label: "Cost / Packet", render: (row) => money(row.average_cost_per_packet) },
          { key: "stock_value", label: "Value", render: (row) => money(row.stock_value) },
          { key: "low_stock", label: "Status", render: (row) => (row.low_stock ? <span className="rounded bg-red-50 px-2 py-1 text-red-700">Low</span> : "OK") }
        ]}
      />
    </AdminShell>
  );
}
