"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch, money } from "@/lib/api";
import type { AnyRow } from "@/lib/types";

type ReceiptLine = {
  sku_id: string;
  quantity_received: string;
  quantity_unit: "carton" | "packet" | "bundle";
  pack_quantity: string;
  cost_per_packet: string;
};

const blankLine: ReceiptLine = {
  sku_id: "",
  quantity_received: "1",
  quantity_unit: "carton",
  pack_quantity: "24",
  cost_per_packet: "0"
};

export default function StockReceivePage() {
  const [warehouses, setWarehouses] = useState<AnyRow[]>([]);
  const [skus, setSkus] = useState<AnyRow[]>([]);
  const [receipts, setReceipts] = useState<AnyRow[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReceiptLine[]>([{ ...blankLine }]);
  const [message, setMessage] = useState("");

  const skuMap = useMemo(() => new Map(skus.map((sku) => [String(sku.id), sku])), [skus]);

  const load = async () => {
    const [warehouseData, skuData, receiptData] = await Promise.all([
      apiFetch<AnyRow[]>("/warehouses"),
      apiFetch<AnyRow[]>("/skus"),
      apiFetch<AnyRow[]>("/stock-receipts")
    ]);
    setWarehouses(warehouseData);
    setSkus(skuData);
    setReceipts(receiptData);
    if (!warehouseId && warehouseData[0]) setWarehouseId(String(warehouseData[0].id));
  };

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateLine = (index: number, patch: Partial<ReceiptLine>) => {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, ...patch };
        if (patch.sku_id) {
          const sku = skuMap.get(patch.sku_id);
          if (sku) {
            next.pack_quantity = String(sku.pack_quantity || 24);
            next.cost_per_packet = String(sku.cost_price || 0);
          }
        }
        return next;
      })
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      await apiFetch("/stock-receipts", {
        method: "POST",
        body: {
          warehouse_id: Number(warehouseId),
          supplier_name: supplier || null,
          reference_number: reference || null,
          notes: notes || null,
          items: lines.map((line) => ({
            sku_id: Number(line.sku_id),
            quantity_received: Number(line.quantity_received),
            quantity_unit: line.quantity_unit,
            pack_quantity: Number(line.pack_quantity),
            cost_per_packet: Number(line.cost_per_packet)
          }))
        }
      });
      setMessage("Stock received and inventory ledger updated");
      setLines([{ ...blankLine }]);
      setSupplier("");
      setReference("");
      setNotes("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Receipt failed");
    }
  };

  return (
    <AdminShell title="Stock Receive">
      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={submit} className="premium-panel p-4">
          <div className="eyebrow">Warehouse intake</div>
          <h1 className="mt-1 text-lg font-semibold text-slate-950">Receive stock</h1>
          <p className="mb-4 text-sm text-slate-500">Cartons and bundles are converted into packet balance automatically.</p>
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Warehouse</span>
            <select className="field" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Supplier</span>
              <input className="field" value={supplier} onChange={(event) => setSupplier(event.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Reference</span>
              <input className="field" value={reference} onChange={(event) => setReference(event.target.value)} />
            </label>
          </div>
          <div className="mt-4 space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="rounded-md border border-slate-200 bg-slate-50/80 p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Line {index + 1}</span>
                  <button type="button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="rounded-md p-1 text-slate-500 hover:bg-white" aria-label="Remove line">
                    <Trash2 size={16} />
                  </button>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">SKU</span>
                  <select className="field" value={line.sku_id} onChange={(event) => updateLine(index, { sku_id: event.target.value })} required>
                    <option value="">Select SKU</option>
                    {skus.map((sku) => (
                      <option key={sku.id} value={sku.id}>
                        {sku.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input className="field" type="number" min="1" value={line.quantity_received} onChange={(event) => updateLine(index, { quantity_received: event.target.value })} />
                  <select className="field" value={line.quantity_unit} onChange={(event) => updateLine(index, { quantity_unit: event.target.value as ReceiptLine["quantity_unit"] })}>
                    <option value="carton">Carton</option>
                    <option value="bundle">Bundle</option>
                    <option value="packet">Packet</option>
                  </select>
                  <input className="field" type="number" min="1" value={line.pack_quantity} onChange={(event) => updateLine(index, { pack_quantity: event.target.value })} />
                  <input className="field" type="number" step="0.01" min="0" value={line.cost_per_packet} onChange={(event) => updateLine(index, { cost_per_packet: event.target.value })} />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Estimated cost: {money(Number(line.quantity_received || 0) * (line.quantity_unit === "packet" ? 1 : Number(line.pack_quantity || 1)) * Number(line.cost_per_packet || 0))}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setLines((current) => [...current, { ...blankLine }])} className="btn-soft mt-3">
            <Plus size={16} /> Add line
          </button>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Notes</span>
            <textarea className="field min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          {message && <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</div>}
          <button className="btn-primary mt-4 w-full">
            <Save size={18} /> Save receipt
          </button>
        </form>

        <section>
          <h2 className="mb-3 font-semibold text-slate-950">Recent receipts</h2>
          <DataTable
            rows={receipts}
            columns={[
              { key: "date_received", label: "Date" },
              { key: "warehouse_name", label: "Warehouse" },
              { key: "supplier_name", label: "Supplier" },
              { key: "reference_number", label: "Reference" },
              { key: "items", label: "Lines", render: (row) => row.items?.length || 0 }
            ]}
          />
        </section>
      </div>
    </AdminShell>
  );
}
