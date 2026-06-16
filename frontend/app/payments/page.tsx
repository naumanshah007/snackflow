"use client";

import { Download, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch, money } from "@/lib/api";
import { exportCsv } from "@/lib/csv";
import type { AnyRow } from "@/lib/types";

export default function PaymentsPage() {
  const [shops, setShops] = useState<AnyRow[]>([]);
  const [payments, setPayments] = useState<AnyRow[]>([]);
  const [shopId, setShopId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  const shopMap = useMemo(() => new Map(shops.map((shop) => [String(shop.id), shop])), [shops]);

  const load = async () => {
    const [shopData, paymentData] = await Promise.all([apiFetch<AnyRow[]>("/shops"), apiFetch<AnyRow[]>("/payments")]);
    setShops(shopData);
    setPayments(paymentData);
    if (!shopId && shopData[0]) setShopId(String(shopData[0].id));
  };

  const exportPayments = () =>
    exportCsv("payments.csv", payments, [
      { key: "payment_date", header: "Date/Time", value: (row) => new Date(row.payment_date as string).toLocaleString() },
      { key: "shop", header: "Shop", value: (row) => shopMap.get(String(row.shop_id))?.name ?? row.shop_id },
      { key: "created_by_id", header: "Collected By (User)" },
      { key: "amount", header: "Amount Collected" },
      { key: "method", header: "Method" },
      { key: "remaining", header: "Shop Remaining Balance", value: (row) => shopMap.get(String(row.shop_id))?.current_balance ?? "" }
    ]);

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      await apiFetch("/payments", {
        method: "POST",
        body: {
          shop_id: Number(shopId),
          amount: Number(amount),
          method,
          reference_number: reference || null,
          notes: notes || null
        }
      });
      setAmount("");
      setReference("");
      setNotes("");
      setMessage("Payment posted and shop ledger balance reduced");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment failed");
    }
  };

  return (
    <AdminShell title="Payments">
      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <form onSubmit={submit} className="premium-panel p-4">
          <div className="eyebrow">Recovery</div>
          <h1 className="mt-1 font-semibold text-slate-950">Collect payment</h1>
          <p className="mb-4 text-sm text-slate-500">Payments create negative shop ledger entries.</p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Shop</span>
            <select className="field" value={shopId} onChange={(event) => setShopId(event.target.value)} required>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name} ({money(shop.current_balance)})
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Amount</span>
            <input className="field" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Method</span>
              <select className="field" value={method} onChange={(event) => setMethod(event.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="wallet">Wallet</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Reference</span>
              <input className="field" value={reference} onChange={(event) => setReference(event.target.value)} />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Notes</span>
            <textarea className="field min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          {message && <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</div>}
          <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2.5 font-semibold text-white shadow-lift hover:bg-green-700">
            <Save size={18} /> Save payment
          </button>
        </form>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-950">Recent payments</h2>
            <button onClick={exportPayments} className="btn-soft">
              <Download size={16} /> CSV
            </button>
          </div>
          <DataTable
            rows={payments}
            columns={[
              { key: "payment_date", label: "Date/Time", render: (row) => new Date(row.payment_date).toLocaleString() },
              { key: "shop_id", label: "Shop", render: (row) => shopMap.get(String(row.shop_id))?.name ?? row.shop_id },
              { key: "amount", label: "Amount", render: (row) => money(row.amount) },
              { key: "method", label: "Method" },
              { key: "reference_number", label: "Reference" }
            ]}
          />
        </section>
      </div>
    </AdminShell>
  );
}
