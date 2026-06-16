"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Boxes, ClipboardList, Warehouse } from "lucide-react";
import { useEffect, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { apiFetch, money, packets } from "@/lib/api";
import { cartonLabel } from "@/lib/cartons";
import type { AnyRow } from "@/lib/types";

export default function DistributionControlPage() {
  const [inventory, setInventory] = useState<AnyRow[]>([]);
  const [dashboard, setDashboard] = useState<AnyRow | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiFetch<AnyRow[]>("/inventory?limit=1000"), apiFetch<AnyRow>("/reports/dashboard")])
      .then(([inv, dash]) => {
        setInventory(inv);
        setDashboard(dash);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load distribution data"));
  }, []);

  const totalPackets = inventory.reduce((sum, row) => sum + Number(row.available_packets || 0), 0);
  const totalValue = inventory.reduce((sum, row) => sum + Number(row.stock_value || 0), 0);
  const lowCount = inventory.filter((row) => row.low_stock).length;

  const links = [
    { href: "/inventory", label: "Stock", desc: "Current carton balances by warehouse", icon: Boxes },
    { href: "/stock/receive", label: "Stock Receive", desc: "Receive cartons with date and cost", icon: ClipboardList },
    { href: "/stock/ledger", label: "Stock Ledger", desc: "Every movement in and out", icon: BarChart3 }
  ];

  return (
    <AdminShell title="Distribution Control">
      {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="SKUs in stock" value={inventory.length} tone="navy" caption="Across warehouses" />
        <StatCard label="Total stock" value={packets(totalPackets)} tone="orange" caption="Packets on hand" />
        <StatCard label="Stock value" value={money(totalValue)} tone="green" caption="At average cost" />
        <StatCard label="Low stock" value={lowCount} caption="Need attention" />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="premium-panel flex items-center justify-between gap-3 p-4 transition hover:-translate-y-0.5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-orange-100 text-orange-700">
                  <Icon size={20} />
                </span>
                <div>
                  <div className="font-semibold text-slate-950">{link.label}</div>
                  <div className="text-xs text-slate-500">{link.desc}</div>
                </div>
              </div>
              <ArrowRight size={18} className="text-slate-400" />
            </Link>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <h2 className="mb-3 font-semibold text-slate-950">Stock by SKU (cartons)</h2>
          <DataTable
            rows={inventory}
            empty="No stock yet"
            columns={[
              { key: "warehouse_name", label: "Warehouse" },
              { key: "sku_name", label: "SKU" },
              { key: "carton_label", label: "Stock", render: (row) => row.carton_label || cartonLabel(row.available_packets, row.pack_quantity) },
              { key: "stock_value", label: "Value", render: (row) => money(row.stock_value) },
              { key: "low_stock", label: "Status", render: (row) => (row.low_stock ? <span className="rounded bg-red-50 px-2 py-1 text-red-700">Low</span> : "OK") }
            ]}
          />
        </section>
        <section>
          <h2 className="mb-3 font-semibold text-slate-950">Warehouse stock value</h2>
          <DataTable
            rows={dashboard?.warehouse_stock_value || []}
            empty="No warehouses"
            columns={[
              { key: "warehouse_name", label: "Warehouse", render: (row) => (
                <span className="inline-flex items-center gap-2"><Warehouse size={15} className="text-slate-400" /> {row.warehouse_name}</span>
              ) },
              { key: "stock_value", label: "Value", render: (row) => money(row.stock_value) }
            ]}
          />
        </section>
      </div>
    </AdminShell>
  );
}
