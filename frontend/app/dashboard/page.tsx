"use client";

import { AlertTriangle, Banknote, Boxes, CreditCard, Receipt, Route, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { apiFetch, money, packets } from "@/lib/api";

type Dashboard = {
  total_sales: number;
  cash_received: number;
  pending_added: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
  sale_count: number;
  low_stock_count: number;
  top_products: { name: string; packets: number; amount: number }[];
  low_stock: { warehouse_name: string; sku_name: string; available_packets: number; threshold: number }[];
  order_booker_performance: { name: string; sales: number; cash: number; profit: number }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Dashboard>("/reports/dashboard").then(setData).catch((err) => setError(err.message));
  }, []);

  return (
    <AdminShell title="Dashboard">
      {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <section className="mb-5 overflow-hidden rounded-lg border border-white/80 bg-slate-950 shadow-premium">
        <div className="grid gap-5 p-5 text-white lg:grid-cols-[minmax(0,1fr)_360px] lg:p-6">
          <div>
            <div className="eyebrow text-orange-200">Today command center</div>
            <h1 className="mt-2 max-w-3xl text-3xl font-bold sm:text-4xl">Stock, cash recovery, pending bills, and profit in one executive view.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Track warehouse pressure, route performance, and net profit while keeping every stock and shop-ledger movement traceable.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-white/10 p-4">
              <div className="text-xs text-slate-300">Net profit</div>
              <div className="mt-2 text-2xl font-bold">{money(data?.net_profit)}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 p-4">
              <div className="text-xs text-slate-300">Delivered sales</div>
              <div className="mt-2 text-2xl font-bold">{data?.sale_count ?? 0}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 p-4">
              <div className="text-xs text-slate-300">Packets moved</div>
              <div className="mt-2 text-2xl font-bold">{packets((data?.top_products || []).reduce((sum, row) => sum + row.packets, 0))}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 p-4">
              <div className="text-xs text-slate-300">Low stock</div>
              <div className="mt-2 text-2xl font-bold">{data?.low_stock_count ?? 0}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Sales" value={money(data?.total_sales)} tone="orange" icon={TrendingUp} caption="Delivered invoices" />
        <StatCard label="Cash" value={money(data?.cash_received)} tone="green" icon={Banknote} caption="Received against sales" />
        <StatCard label="Pending Added" value={money(data?.pending_added)} icon={CreditCard} caption="Credit movement" />
        <StatCard label="Gross Profit" value={money(data?.gross_profit)} tone="navy" icon={TrendingUp} caption="Before expenses" />
        <StatCard label="Expenses" value={money(data?.expenses)} icon={Receipt} caption="Today posted" />
        <StatCard label="Low Stock" value={data?.low_stock_count ?? 0} icon={AlertTriangle} caption="Needs attention" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="premium-panel p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="eyebrow">Product momentum</div>
              <h2 className="mt-1 font-semibold text-slate-950">Top Selling Products</h2>
              <p className="text-sm text-slate-500">Today by delivered sale amount</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-100 text-orange-700">
              <Boxes size={20} />
            </span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.top_products || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Bar dataKey="amount" fill="#F97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="premium-panel p-4">
          <div className="eyebrow">Route economics</div>
          <h2 className="mt-1 font-semibold text-slate-950">Profit Snapshot</h2>
          <div className="mt-4 border-y border-slate-200 py-5">
            <div className="text-sm text-slate-500">Gross profit minus expenses</div>
            <div className="mt-2 text-4xl font-bold text-slate-950">{money(data?.net_profit)}</div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-slate-500">Sales count</div>
              <div className="mt-1 text-xl font-semibold">{data?.sale_count ?? 0}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-slate-500">Packets sold</div>
              <div className="mt-1 text-xl font-semibold">{packets((data?.top_products || []).reduce((sum, row) => sum + row.packets, 0))}</div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-green-100 text-green-700">
              <Route size={18} />
            </span>
            <h2 className="font-semibold text-slate-950">Order Booker Performance</h2>
          </div>
          <DataTable
            rows={data?.order_booker_performance || []}
            columns={[
              { key: "name", label: "Booker" },
              { key: "sales", label: "Sales", render: (row) => money(row.sales) },
              { key: "cash", label: "Cash", render: (row) => money(row.cash) },
              { key: "profit", label: "Profit", render: (row) => money(row.profit) }
            ]}
          />
        </section>
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-100 text-orange-700">
              <AlertTriangle size={18} />
            </span>
            <h2 className="font-semibold text-slate-950">Low Stock Warnings</h2>
          </div>
          <DataTable
            rows={data?.low_stock || []}
            columns={[
              { key: "warehouse_name", label: "Warehouse" },
              { key: "sku_name", label: "SKU" },
              { key: "available_packets", label: "Packets" },
              { key: "threshold", label: "Threshold" }
            ]}
          />
        </section>
      </div>
    </AdminShell>
  );
}
