"use client";

import { CheckCircle2, Plus, RefreshCcw, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch, money, packets } from "@/lib/api";
import type { AnyRow } from "@/lib/types";

type SaleLine = {
  sku_id: string;
  quantity_packets: string;
  sale_rate: string;
  hint?: string;
};

const blankLine: SaleLine = { sku_id: "", quantity_packets: "1", sale_rate: "" };

export default function SalesPage() {
  const [shops, setShops] = useState<AnyRow[]>([]);
  const [skus, setSkus] = useState<AnyRow[]>([]);
  const [sales, setSales] = useState<AnyRow[]>([]);
  const [shopId, setShopId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [payment, setPayment] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [confirmNow, setConfirmNow] = useState(true);
  const [lines, setLines] = useState<SaleLine[]>([{ ...blankLine }]);
  const [message, setMessage] = useState("");

  const skuMap = useMemo(() => new Map(skus.map((sku) => [String(sku.id), sku])), [skus]);
  const selectedShop = shops.find((shop) => String(shop.id) === shopId);

  const load = async () => {
    const [shopData, skuData, saleData] = await Promise.all([apiFetch<AnyRow[]>("/shops"), apiFetch<AnyRow[]>("/skus"), apiFetch<AnyRow[]>("/sales")]);
    setShops(shopData);
    setSkus(skuData);
    setSales(saleData);
    if (!shopId && shopData[0]) {
      setShopId(String(shopData[0].id));
      setWarehouseId(String(shopData[0].assigned_warehouse_id || ""));
    }
  };

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedShop?.assigned_warehouse_id) setWarehouseId(String(selectedShop.assigned_warehouse_id));
  }, [selectedShop?.assigned_warehouse_id]);

  const updateLine = async (index: number, patch: Partial<SaleLine>) => {
    const nextLines = lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line));
    setLines(nextLines);
    if (patch.sku_id && shopId) {
      try {
        const context = await apiFetch<AnyRow>(`/rates/shop/${shopId}/sku/${patch.sku_id}`);
        const rate = context.fixed_sale_rate ?? context.last_sale_rate ?? context.default_sale_rate;
        setLines((current) =>
          current.map((line, lineIndex) =>
            lineIndex === index
              ? {
                  ...line,
                  sale_rate: String(rate || skuMap.get(patch.sku_id || "")?.default_sale_rate || ""),
                  hint: `Default ${money(context.default_sale_rate)}${context.fixed_sale_rate ? `, fixed ${money(context.fixed_sale_rate)}` : ""}${context.last_sale_rate ? `, last ${money(context.last_sale_rate)}` : ""}`
                }
              : line
          )
        );
      } catch {
        const sku = skuMap.get(patch.sku_id);
        if (sku) setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, sale_rate: String(sku.default_sale_rate || "") } : line)));
      }
    }
  };

  const totals = lines.reduce(
    (sum, line) => {
      const qty = Number(line.quantity_packets || 0);
      const rate = Number(line.sale_rate || 0);
      sum.gross += qty * rate;
      return sum;
    },
    { gross: 0 }
  );
  const net = Math.max(totals.gross - Number(discount || 0), 0);
  const pending = Math.max(net - Number(payment || 0), 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      const sale = await apiFetch<AnyRow>("/sales", {
        method: "POST",
        body: {
          shop_id: Number(shopId),
          warehouse_id: warehouseId ? Number(warehouseId) : null,
          discount: Number(discount || 0),
          payment_received: Number(payment || 0),
          notes: notes || null,
          items: lines.map((line) => ({
            sku_id: Number(line.sku_id),
            quantity_packets: Number(line.quantity_packets),
            sale_rate: Number(line.sale_rate)
          }))
        }
      });
      if (confirmNow) {
        await apiFetch(`/sales/${sale.id}/confirm`, { method: "POST" });
      }
      setMessage(confirmNow ? "Sale delivered, stock deducted, shop ledger updated" : "Sale booked without stock deduction");
      setLines([{ ...blankLine }]);
      setPayment("0");
      setDiscount("0");
      setNotes("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sale failed");
    }
  };

  const action = async (saleId: number, type: "confirm" | "reverse") => {
    try {
      if (type === "confirm") {
        await apiFetch(`/sales/${saleId}/confirm`, { method: "POST" });
      } else {
        const reason = window.prompt("Reversal reason", "Wrong entry");
        if (!reason) return;
        await apiFetch(`/sales/${saleId}/reverse`, { method: "POST", body: { reason } });
      }
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    }
  };

  return (
    <AdminShell title="Sales">
      <div className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
        <form onSubmit={submit} className="premium-panel p-4">
          <div className="eyebrow">Sales workflow</div>
          <h1 className="mt-1 font-semibold text-slate-950">New order</h1>
          <p className="mb-4 text-sm text-slate-500">Confirmed orders deduct stock and post shop ledger entries.</p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Shop</span>
            <select className="field" value={shopId} onChange={(event) => setShopId(event.target.value)} required>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name} - {money(shop.current_balance)}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="rounded-md border border-slate-200 bg-slate-50/80 p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Item {index + 1}</span>
                  <button type="button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="rounded-md p-1 text-slate-500 hover:bg-white" aria-label="Remove item">
                    <Trash2 size={16} />
                  </button>
                </div>
                <select className="field" value={line.sku_id} onChange={(event) => updateLine(index, { sku_id: event.target.value })} required>
                  <option value="">Select SKU</option>
                  {skus.map((sku) => (
                    <option key={sku.id} value={sku.id}>
                      {sku.display_name}
                    </option>
                  ))}
                </select>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input className="field" type="number" min="1" value={line.quantity_packets} onChange={(event) => updateLine(index, { quantity_packets: event.target.value })} />
                  <input className="field" type="number" min="0" step="0.01" value={line.sale_rate} onChange={(event) => updateLine(index, { sale_rate: event.target.value })} />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {line.hint || "Choose SKU to load default, fixed, or last sale rate"} · Line total {money(Number(line.quantity_packets || 0) * Number(line.sale_rate || 0))}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setLines((current) => [...current, { ...blankLine }])} className="btn-soft mt-3">
            <Plus size={16} /> Add item
          </button>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Discount</span>
              <input className="field" type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Payment</span>
              <input className="field" type="number" min="0" value={payment} onChange={(event) => setPayment(event.target.value)} />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Notes</span>
            <textarea className="field min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <label className="mt-3 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
            <input type="checkbox" checked={confirmNow} onChange={(event) => setConfirmNow(event.target.checked)} />
            Mark delivered now
          </label>
          <div className="mt-4 rounded-md bg-slate-950 p-3 text-sm text-white">
            Gross {money(totals.gross)} · Net {money(net)} · Pending {money(pending)}
          </div>
          {message && <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</div>}
          <button className="btn-primary mt-4 w-full">
            <Save size={18} /> Save order
          </button>
        </form>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-950">Recent sales</h2>
            <button onClick={load} className="btn-soft">
              <RefreshCcw size={16} /> Refresh
            </button>
          </div>
          <DataTable
            rows={sales}
            columns={[
              { key: "sale_date", label: "Date", render: (row) => new Date(row.sale_date).toLocaleString() },
              { key: "shop_name", label: "Shop" },
              { key: "status", label: "Status" },
              { key: "net_amount", label: "Net", render: (row) => money(row.net_amount) },
              { key: "payment_received", label: "Cash", render: (row) => money(row.payment_received) },
              { key: "pending_amount", label: "Pending", render: (row) => money(row.pending_amount) },
              { key: "items", label: "Packets", render: (row) => packets((row.items || []).reduce((sum: number, item: AnyRow) => sum + item.quantity_packets, 0)) },
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <div className="flex gap-2">
                    {row.status !== "DELIVERED" && row.status !== "REVERSED" && (
                      <button onClick={() => action(row.id, "confirm")} className="rounded-md bg-green-600 p-2 text-white" title="Confirm delivery">
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    {row.status === "DELIVERED" && (
                      <button onClick={() => action(row.id, "reverse")} className="rounded-md bg-slate-900 p-2 text-white" title="Reverse sale">
                        <RotateCcw size={16} />
                      </button>
                    )}
                  </div>
                )
              }
            ]}
          />
        </section>
      </div>
    </AdminShell>
  );
}
