"use client";

import { BarChart3, Boxes, CalendarRange, Download, PackageCheck, Printer, RefreshCcw, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { apiFetch, money } from "@/lib/api";
import { exportCsv, type CsvColumn } from "@/lib/csv";
import type { AnyRow } from "@/lib/types";

function ReportCardHeader({ icon: Icon, title, onExport }: { icon: LucideIcon; title: string; onExport?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-100 to-emerald-100 text-orange-700">
          <Icon size={18} />
        </span>
        <h2 className="font-semibold text-slate-950">{title}</h2>
      </div>
      {onExport && (
        <button onClick={onExport} className="btn-soft no-print px-3 py-2" title="Export CSV">
          <Download size={15} /> CSV
        </button>
      )}
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [dashboard, setDashboard] = useState<AnyRow | null>(null);
  const [profit, setProfit] = useState<AnyRow | null>(null);
  const [dailySales, setDailySales] = useState<AnyRow[]>([]);
  const [itemSales, setItemSales] = useState<AnyRow[]>([]);
  const [balances, setBalances] = useState<AnyRow[]>([]);
  const [lowStock, setLowStock] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");

  const params = () => {
    const search = new URLSearchParams();
    if (dateFrom) search.set("date_from", dateFrom);
    if (dateTo) search.set("date_to", dateTo);
    return search.toString();
  };

  const load = async () => {
    setMessage("");
    try {
      const query = params();
      const [dashboardData, profitData, dailyData, itemData, balanceData, lowData] = await Promise.all([
        apiFetch<AnyRow>(`/reports/dashboard?${query}`),
        apiFetch<AnyRow>(`/reports/profit?${query}`),
        apiFetch<AnyRow[]>(`/reports/daily-sales?${query}`),
        apiFetch<AnyRow[]>(`/reports/item-sales?${query}`),
        apiFetch<AnyRow[]>("/reports/shop-balances"),
        apiFetch<AnyRow[]>("/reports/low-stock")
      ]);
      setDashboard(dashboardData);
      setProfit(profitData);
      setDailySales(dailyData);
      setItemSales(itemData);
      setBalances(balanceData);
      setLowStock(lowData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load reports");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminShell title="Reports">
      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-white/80 bg-white/75 p-4 shadow-lift backdrop-blur">
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">From</span>
          <input type="date" className="field" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">To</span>
          <input type="date" className="field" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <button onClick={load} className="btn-dark">
          <RefreshCcw size={16} /> Apply
        </button>
        <button onClick={() => window.print()} className="btn-soft">
          <Printer size={16} /> Print
        </button>
      </div>
      {message && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Sales" value={money(dashboard?.total_sales)} tone="orange" />
        <StatCard label="Cash" value={money(dashboard?.cash_received)} tone="green" />
        <StatCard label="Gross Profit" value={money(profit?.gross_profit)} tone="navy" />
        <StatCard label="Expenses" value={money(profit?.expenses)} />
        <StatCard label="Net Profit" value={money(profit?.net_profit)} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="premium-panel p-4">
          <ReportCardHeader icon={CalendarRange} title="Daily Sales Report" onExport={() => exportCsv("daily-sales.csv", dailySales)} />
          <DataTable
            rows={dailySales}
            empty={<EmptyState icon={CalendarRange} title="No sales found for this date range" hint="Adjust the date filter or confirm deliveries." />}
            columns={[
              { key: "date", label: "Date" },
              { key: "status", label: "Status" },
              { key: "sales", label: "Sales", render: (row) => money(row.sales) },
              { key: "cash", label: "Cash", render: (row) => money(row.cash) },
              { key: "pending", label: "Pending", render: (row) => money(row.pending) },
              { key: "profit", label: "Profit", render: (row) => money(row.profit) }
            ]}
          />
        </section>

        <section className="premium-panel p-4">
          <ReportCardHeader
            icon={Boxes}
            title="Item Sold Report"
            onExport={() =>
              exportCsv("item-sales.csv", itemSales, [
                { key: "sku_name", header: "SKU" },
                { key: "cartons", header: "Cartons" },
                { key: "loose_packets", header: "Loose Packets" },
                { key: "packets", header: "Total Packets" },
                { key: "amount", header: "Amount" },
                { key: "profit", header: "Profit" }
              ] satisfies CsvColumn[])
            }
          />
          <DataTable
            rows={itemSales}
            empty={<EmptyState icon={Boxes} title="No items sold in this range" hint="Carton sales will be summarised here." />}
            columns={[
              { key: "sku_name", label: "SKU" },
              { key: "carton_label", label: "Sold (cartons)" },
              { key: "packets", label: "Packets" },
              { key: "amount", label: "Amount", render: (row) => money(row.amount) },
              { key: "profit", label: "Profit", render: (row) => money(row.profit) }
            ]}
          />
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="premium-panel p-4">
          <ReportCardHeader icon={Store} title="Shop Pending Bills" onExport={() => exportCsv("shop-balances.csv", balances)} />
          <DataTable
            rows={balances}
            empty={<EmptyState icon={Store} title="No pending balances" hint="Every assigned shop is settled up." />}
            columns={[
              { key: "shop_name", label: "Shop" },
              { key: "area_route", label: "Route" },
              { key: "balance", label: "Balance", render: (row) => money(row.balance) }
            ]}
          />
        </section>

        <section className="premium-panel p-4">
          <ReportCardHeader icon={BarChart3} title="Low Stock Report" onExport={() => exportCsv("low-stock.csv", lowStock)} />
          <DataTable
            rows={lowStock}
            empty={<EmptyState icon={PackageCheck} title="Stock looks healthy" hint="No SKUs below their low-stock threshold." />}
            columns={[
              { key: "warehouse_name", label: "Warehouse" },
              { key: "sku_name", label: "SKU" },
              { key: "available_packets", label: "Packets" },
              { key: "low_stock_threshold", label: "Threshold" }
            ]}
          />
        </section>
      </div>
    </AdminShell>
  );
}
