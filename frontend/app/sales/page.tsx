"use client";

import { AlertTriangle, CheckCircle2, Download, Plus, RefreshCcw, RotateCcw, Save, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch, money } from "@/lib/api";
import { cartonLabel, perCarton, toPackets } from "@/lib/cartons";
import { exportCsv } from "@/lib/csv";
import type { AnyRow } from "@/lib/types";

type SaleLine = {
  sku_id: string;
  cartons: string;
  loose_packets: string;
  sale_rate_per_carton: string;
  hint?: string;
};

const blankLine: SaleLine = { sku_id: "", cartons: "1", loose_packets: "0", sale_rate_per_carton: "" };

export default function SalesPage() {
  const [shops, setShops] = useState<AnyRow[]>([]);
  const [skus, setSkus] = useState<AnyRow[]>([]);
  const [sales, setSales] = useState<AnyRow[]>([]);
  const [inventory, setInventory] = useState<AnyRow[]>([]);
  const [shopId, setShopId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [payment, setPayment] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [confirmNow, setConfirmNow] = useState(true);
  const [lines, setLines] = useState<SaleLine[]>([{ ...blankLine }]);
  const [message, setMessage] = useState("");
  const [detailSale, setDetailSale] = useState<AnyRow | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [returnQty, setReturnQty] = useState<Record<number, { cartons: string; loose: string }>>({});

  const skuMap = useMemo(() => new Map(skus.map((sku) => [String(sku.id), sku])), [skus]);
  const selectedShop = shops.find((shop) => String(shop.id) === shopId);
  const stockMap = useMemo(() => new Map(inventory.map((row) => [String(row.sku_id), row])), [inventory]);

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

  useEffect(() => {
    if (!warehouseId) return;
    apiFetch<AnyRow[]>(`/inventory?warehouse_id=${warehouseId}`).then(setInventory).catch(() => setInventory([]));
  }, [warehouseId]);

  const updateLine = async (index: number, patch: Partial<SaleLine>) => {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
    if (patch.sku_id && shopId) {
      const sku = skuMap.get(patch.sku_id);
      const pack = sku?.pack_quantity || 24;
      try {
        const context = await apiFetch<AnyRow>(`/rates/shop/${shopId}/sku/${patch.sku_id}`);
        const ratePerPacket = context.fixed_sale_rate ?? context.last_sale_rate ?? context.default_sale_rate;
        const ratePerCarton = perCarton(ratePerPacket || sku?.default_sale_rate || 0, pack);
        const fixedC = context.fixed_sale_rate ? perCarton(context.fixed_sale_rate, pack) : null;
        const lastC = context.last_sale_rate ? perCarton(context.last_sale_rate, pack) : null;
        setLines((current) =>
          current.map((line, lineIndex) =>
            lineIndex === index
              ? {
                  ...line,
                  sale_rate_per_carton: String(ratePerCarton || ""),
                  hint: `Default ${money(perCarton(context.default_sale_rate, pack))}/carton${fixedC ? `, fixed ${money(fixedC)}` : ""}${lastC ? `, last ${money(lastC)}` : ""}`
                }
              : line
          )
        );
      } catch {
        if (sku) setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, sale_rate_per_carton: String(perCarton(sku.default_sale_rate, pack) || "") } : line)));
      }
    }
  };

  const lineTotal = (line: SaleLine) => {
    const sku = skuMap.get(line.sku_id);
    const pack = sku?.pack_quantity || 24;
    const packets = toPackets(line.cartons, line.loose_packets, pack);
    const ratePerPacket = (Number(line.sale_rate_per_carton) || 0) / pack;
    return packets * ratePerPacket;
  };

  const totals = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const net = Math.max(totals - Number(discount || 0), 0);
  const pending = Math.max(net - Number(payment || 0), 0);

  const exportSales = () => {
    const flat: Record<string, unknown>[] = [];
    sales.forEach((sale) => {
      (sale.items || []).forEach((item: AnyRow) => {
        flat.push({
          date: new Date(sale.sale_date).toLocaleString(),
          shop: sale.shop_name,
          order_booker: sale.order_booker_id,
          warehouse: sale.warehouse_name,
          sku: item.sku_name,
          cartons: item.cartons,
          loose: item.loose_packets,
          total_packets: item.quantity_packets,
          rate_carton: item.sale_rate_per_carton,
          rate_packet: item.sale_rate,
          line_total: item.line_total,
          payment: sale.payment_received,
          pending: sale.pending_amount,
          status: sale.status
        });
      });
    });
    exportCsv("sales.csv", flat, [
      { key: "date", header: "Date" },
      { key: "shop", header: "Shop" },
      { key: "order_booker", header: "Order Booker" },
      { key: "warehouse", header: "Warehouse" },
      { key: "sku", header: "SKU" },
      { key: "cartons", header: "Cartons Sold" },
      { key: "loose", header: "Loose Packets Sold" },
      { key: "total_packets", header: "Total Packets" },
      { key: "rate_carton", header: "Sale Rate per Carton" },
      { key: "rate_packet", header: "Sale Rate per Packet" },
      { key: "line_total", header: "Line Total" },
      { key: "payment", header: "Payment Received" },
      { key: "pending", header: "Pending Amount" },
      { key: "status", header: "Status" }
    ]);
  };

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
            cartons: Number(line.cartons || 0),
            loose_packets: Number(line.loose_packets || 0),
            sale_rate_per_carton: Number(line.sale_rate_per_carton)
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

  const confirmSale = async (saleId: number) => {
    try {
      await apiFetch(`/sales/${saleId}/confirm`, { method: "POST" });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    }
  };

  const openDetail = async (saleId: number) => {
    const sale = await apiFetch<AnyRow>(`/sales/${saleId}`);
    setDetailSale(sale);
    setReverseReason("");
    setReturnQty({});
  };

  const submitReversal = async () => {
    if (!detailSale) return;
    if (!reverseReason.trim()) {
      setMessage("Reversal reason is required");
      return;
    }
    try {
      await apiFetch(`/sales/${detailSale.id}/reverse`, { method: "POST", body: { reason: reverseReason.trim() } });
      setMessage(`Sale #${detailSale.id} reversed. Stock added back and shop balance adjusted.`);
      setDetailSale(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reversal failed");
    }
  };

  const submitReturn = async () => {
    if (!detailSale) return;
    const items = (detailSale.items || [])
      .map((item: AnyRow) => {
        const entry = returnQty[item.id];
        const packets = toPackets(entry?.cartons, entry?.loose, item.pack_quantity);
        return packets > 0 ? { sale_item_id: item.id, quantity_packets: packets } : null;
      })
      .filter(Boolean);
    if (!items.length) {
      setMessage("Enter at least one return quantity");
      return;
    }
    try {
      await apiFetch(`/sales/${detailSale.id}/return`, { method: "POST", body: { reason: reverseReason.trim() || "Partial return", items } });
      setMessage(`Partial return saved for sale #${detailSale.id}. Stock and shop balance updated.`);
      setDetailSale(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Return failed");
    }
  };

  return (
    <AdminShell title="Sales">
      <div className="grid gap-5 xl:grid-cols-[460px_minmax(0,1fr)]">
        <form onSubmit={submit} className="premium-panel p-4">
          <div className="eyebrow">Sales workflow · sold in cartons</div>
          <h1 className="mt-1 font-semibold text-slate-950">New order</h1>
          <p className="mb-4 text-sm text-slate-500">Confirmed orders deduct stock and post shop ledger entries. Sale date is recorded automatically.</p>
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
            {lines.map((line, index) => {
              const stock = stockMap.get(line.sku_id);
              return (
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
                  {line.sku_id && (
                    <div className="mt-1 text-xs font-medium text-slate-600">
                      Available: {stock ? stock.carton_label : "0 pkts"}
                    </div>
                  )}
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label>
                      <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Cartons</span>
                      <input className="field" type="number" min="0" value={line.cartons} onChange={(event) => updateLine(index, { cartons: event.target.value })} />
                    </label>
                    <label>
                      <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">+ Packets</span>
                      <input className="field" type="number" min="0" value={line.loose_packets} onChange={(event) => updateLine(index, { loose_packets: event.target.value })} />
                    </label>
                    <label>
                      <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Rate / carton</span>
                      <input className="field" type="number" min="0" step="0.01" value={line.sale_rate_per_carton} onChange={(event) => updateLine(index, { sale_rate_per_carton: event.target.value })} />
                    </label>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {line.hint || "Choose SKU to load default, fixed, or last sale rate"} · Line total {money(lineTotal(line))}
                  </div>
                </div>
              );
            })}
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
            Gross {money(totals)} · Net {money(net)} · Pending {money(pending)}
          </div>
          {message && <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</div>}
          <button className="btn-primary mt-4 w-full">
            <Save size={18} /> Save order
          </button>
        </form>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-950">Recent sales</h2>
            <div className="flex gap-2">
              <button onClick={exportSales} className="btn-soft">
                <Download size={16} /> CSV
              </button>
              <button onClick={load} className="btn-soft">
                <RefreshCcw size={16} /> Refresh
              </button>
            </div>
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
              {
                key: "items",
                label: "Qty (cartons)",
                render: (row) => (
                  <span>{cartonLabel((row.items || []).reduce((sum: number, item: AnyRow) => sum + item.quantity_packets, 0), (row.items || [])[0]?.pack_quantity || 24)}</span>
                )
              },
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <div className="flex gap-2">
                    {row.status !== "DELIVERED" && row.status !== "REVERSED" && row.status !== "CANCELLED" && (
                      <button onClick={() => confirmSale(row.id)} className="rounded-md bg-green-600 p-2 text-white" title="Confirm delivery">
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    <button onClick={() => openDetail(row.id)} className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white" title="View / reverse / return">
                      View
                    </button>
                  </div>
                )
              }
            ]}
          />
        </section>
      </div>

      {detailSale && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" onClick={() => setDetailSale(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-xl bg-white p-5 shadow-premium sm:rounded-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="eyebrow">Sale #{detailSale.id} · {detailSale.status}</div>
                <h3 className="text-lg font-bold text-slate-950">{detailSale.shop_name}</h3>
                <div className="text-sm text-slate-500">{new Date(detailSale.sale_date).toLocaleString()}</div>
              </div>
              <button onClick={() => setDetailSale(null)} className="rounded-md border border-slate-200 p-2 text-slate-600" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Sold</th>
                    <th className="px-3 py-2">Rate/carton</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Return (ctn / pkt)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(detailSale.items || []).map((item: AnyRow) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-slate-800">{item.sku_name}</td>
                      <td className="px-3 py-2">{item.carton_label || cartonLabel(item.quantity_packets, item.pack_quantity)}</td>
                      <td className="px-3 py-2">{money(item.sale_rate_per_carton)}</td>
                      <td className="px-3 py-2">{money(item.line_total)}</td>
                      <td className="px-3 py-2">
                        {(detailSale.status === "DELIVERED" || detailSale.status === "PARTIALLY_RETURNED") ? (
                          <div className="flex gap-1">
                            <input
                              className="field w-16 px-2 py-1"
                              type="number"
                              min="0"
                              placeholder="ctn"
                              value={returnQty[item.id]?.cartons ?? ""}
                              onChange={(event) => setReturnQty((current) => ({ ...current, [item.id]: { cartons: event.target.value, loose: current[item.id]?.loose ?? "" } }))}
                            />
                            <input
                              className="field w-16 px-2 py-1"
                              type="number"
                              min="0"
                              placeholder="pkt"
                              value={returnQty[item.id]?.loose ?? ""}
                              onChange={(event) => setReturnQty((current) => ({ ...current, [item.id]: { cartons: current[item.id]?.cartons ?? "", loose: event.target.value } }))}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detailSale.status === "REVERSED" && (
              <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Reversed{detailSale.reversed_at ? ` on ${new Date(detailSale.reversed_at).toLocaleString()}` : ""}. Reason: {detailSale.reversal_reason || "—"}
              </div>
            )}

            {(detailSale.status === "DELIVERED" || detailSale.status === "PARTIALLY_RETURNED") && (
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Reason (required for reversal)</span>
                  <textarea className="field min-h-16" value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} placeholder="e.g. Wrong entry, customer refused delivery" />
                </label>
                <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>Reversing adds all remaining stock back and adjusts the shop balance. The original sale stays in history.</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={submitReturn} className="btn-soft">
                    <Undo2 size={16} /> Partial return
                  </button>
                  <button onClick={submitReversal} className="btn-dark">
                    <RotateCcw size={16} /> Reverse whole sale
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
