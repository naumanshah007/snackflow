"use client";

import { Plus, Save, Trash2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch } from "@/lib/api";
import { cartonLabel, toPackets } from "@/lib/cartons";
import type { AnyRow } from "@/lib/types";

type ReturnLine = {
  sku_id: string;
  quantity_received: string;
  loose_packets: string;
  quantity_unit: "carton" | "packet" | "bundle";
  pack_quantity: string;
};

const blankLine: ReturnLine = { sku_id: "", quantity_received: "1", loose_packets: "0", quantity_unit: "carton", pack_quantity: "24" };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function StockReturnsPage() {
  const [warehouses, setWarehouses] = useState<AnyRow[]>([]);
  const [skus, setSkus] = useState<AnyRow[]>([]);
  const [returns, setReturns] = useState<AnyRow[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [dateReturned, setDateReturned] = useState(todayIso());
  const [supplier, setSupplier] = useState("");
  const [reason, setReason] = useState("Expired stock returned to company");
  const [lines, setLines] = useState<ReturnLine[]>([{ ...blankLine }]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error">("success");

  const skuMap = useMemo(() => new Map(skus.map((sku) => [String(sku.id), sku])), [skus]);

  const load = async () => {
    const [warehouseData, skuData, returnData] = await Promise.all([
      apiFetch<AnyRow[]>("/warehouses"),
      apiFetch<AnyRow[]>("/skus"),
      apiFetch<AnyRow[]>("/stock-returns")
    ]);
    setWarehouses(warehouseData);
    setSkus(skuData);
    setReturns(returnData);
    if (!warehouseId && warehouseData[0]) setWarehouseId(String(warehouseData[0].id));
  };

  useEffect(() => {
    load().catch((error) => {
      setTone("error");
      setMessage(error.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateLine = (index: number, patch: Partial<ReturnLine>) => {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, ...patch };
        if (patch.sku_id) {
          const sku = skuMap.get(patch.sku_id);
          if (sku) next.pack_quantity = String(sku.pack_quantity || 24);
        }
        return next;
      })
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      const result = await apiFetch<AnyRow>("/stock-returns", {
        method: "POST",
        body: {
          warehouse_id: Number(warehouseId),
          date_returned: dateReturned,
          supplier_name: supplier || null,
          reason,
          items: lines.map((line) => ({
            sku_id: Number(line.sku_id),
            quantity_received: Number(line.quantity_received),
            quantity_unit: line.quantity_unit,
            loose_packets: line.quantity_unit === "packet" ? 0 : Number(line.loose_packets || 0),
            pack_quantity: Number(line.pack_quantity)
          }))
        }
      });
      setTone("success");
      setMessage(result?.message || "Returned stock recorded and removed from inventory.");
      setLines([{ ...blankLine }]);
      setSupplier("");
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Return failed");
    }
  };

  return (
    <AdminShell title="Return to Supplier">
      <div className="grid gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
        <form onSubmit={submit} className="premium-panel p-4">
          <div className="eyebrow">Expiry / damage</div>
          <h1 className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-950">
            <Undo2 size={18} /> Return stock to company
          </h1>
          <p className="mb-4 text-sm text-slate-500">Record expired or damaged cartons returned to the supplier. This removes them from warehouse inventory.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Return date</span>
              <input className="field" type="date" value={dateReturned} onChange={(event) => setDateReturned(event.target.value)} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Warehouse</span>
              <select className="field" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Supplier / company</span>
            <input className="field" value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="e.g. Zaib Brothers supplier" />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Reason</span>
            <input className="field" value={reason} onChange={(event) => setReason(event.target.value)} required />
          </label>
          <div className="mt-4 space-y-3">
            {lines.map((line, index) => {
              const pack = Number(line.pack_quantity || 1);
              const isCarton = line.quantity_unit !== "packet";
              const totalPackets = isCarton ? toPackets(line.quantity_received, line.loose_packets, pack) : Number(line.quantity_received || 0);
              return (
                <div key={index} className="rounded-md border border-slate-200 bg-slate-50/80 p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Line {index + 1}</span>
                    <button type="button" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="rounded-md p-1 text-slate-500 hover:bg-white" aria-label="Remove line">
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
                    <label>
                      <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">{isCarton ? "Cartons" : "Packets"}</span>
                      <input className="field" type="number" min="1" value={line.quantity_received} onChange={(event) => updateLine(index, { quantity_received: event.target.value })} />
                    </label>
                    <label>
                      <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Unit</span>
                      <select className="field" value={line.quantity_unit} onChange={(event) => updateLine(index, { quantity_unit: event.target.value as ReturnLine["quantity_unit"] })}>
                        <option value="carton">Carton</option>
                        <option value="bundle">Bundle</option>
                        <option value="packet">Packet</option>
                      </select>
                    </label>
                    {isCarton && (
                      <label>
                        <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Loose packets</span>
                        <input className="field" type="number" min="0" value={line.loose_packets} onChange={(event) => updateLine(index, { loose_packets: event.target.value })} />
                      </label>
                    )}
                    <label>
                      <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Packets / carton</span>
                      <input className="field" type="number" min="1" value={line.pack_quantity} onChange={(event) => updateLine(index, { pack_quantity: event.target.value })} />
                    </label>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Removing: {cartonLabel(totalPackets, line.pack_quantity)} ({totalPackets} packets)</div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => setLines((current) => [...current, { ...blankLine }])} className="btn-soft mt-3">
            <Plus size={16} /> Add line
          </button>
          {message && (
            <div className={`mt-3 rounded-md border px-3 py-2 text-sm ${tone === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>{message}</div>
          )}
          <button className="btn-primary mt-4 w-full">
            <Save size={18} /> Save return
          </button>
        </form>

        <section>
          <h2 className="mb-3 font-semibold text-slate-950">Recent returns to supplier</h2>
          <DataTable
            rows={returns}
            empty="No supplier returns yet"
            columns={[
              { key: "date", label: "Date", render: (row) => new Date(row.date).toLocaleDateString() },
              { key: "warehouse_name", label: "Warehouse" },
              { key: "sku_name", label: "SKU" },
              { key: "carton_label", label: "Returned (cartons)" },
              { key: "notes", label: "Reason" }
            ]}
          />
        </section>
      </div>
    </AdminShell>
  );
}
