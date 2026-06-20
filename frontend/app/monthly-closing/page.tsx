"use client";

import { AlertTriangle, Archive, CalendarCheck, Download, FileArchive, RefreshCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { API_URL, apiFetch, getToken, money, packets } from "@/lib/api";
import type { AnyRow } from "@/lib/types";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadBackup(month: string) {
  const token = getToken();
  const response = await fetch(`${API_URL}/monthly-closing/generate-backup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ month })
  });
  if (!response.ok) {
    let message = "Backup generation failed";
    try {
      const payload = await response.json();
      message = payload.detail || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `monthly-closing-${month}.zip`;
  downloadBlob(await response.blob(), filename);
}

export default function MonthlyClosingPage() {
  const [month, setMonth] = useState(currentMonth());
  const [preview, setPreview] = useState<AnyRow | null>(null);
  const [closings, setClosings] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  const latestForMonth = useMemo(() => closings.find((closing) => closing.month_start?.startsWith(month)), [closings, month]);
  const canClose = Boolean(latestForMonth?.has_backup && !latestForMonth?.closed_at);

  const showMessage = (text: string, tone: "success" | "error" = "success") => {
    setMessage(text);
    setMessageTone(tone);
  };

  const loadClosings = async () => {
    const data = await apiFetch<AnyRow[]>("/monthly-closing");
    setClosings(data);
  };

  const loadPreview = async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await apiFetch<AnyRow>(`/monthly-closing/preview?month=${month}`);
      setPreview(data);
      await loadClosings();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not load preview", "error");
    } finally {
      setLoading(false);
    }
  };

  const generateBackup = async () => {
    setLoading(true);
    setMessage("");
    try {
      await downloadBackup(month);
      await loadPreview();
      showMessage("Backup ZIP generated and downloaded. Save it immediately to laptop/Google Drive before closing the month.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Backup generation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const closeSelectedMonth = async () => {
    setLoading(true);
    setMessage("");
    try {
      await apiFetch("/monthly-closing/close", { method: "POST", body: { month } });
      await loadPreview();
      showMessage("Month closed. Opening shop balances and inventory balances were carried forward.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Monthly close failed", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminShell title="Monthly Closing">
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">This action should only be done after downloading backup. It cannot be undone unless backup is restored.</div>
            <p className="mt-1">Download and save the ZIP immediately to laptop/Google Drive. Serverless hosting does not keep backup files as permanent storage.</p>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-white/80 bg-white/75 p-4 shadow-lift backdrop-blur">
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Month to close</span>
          <input type="month" className="field" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <button onClick={loadPreview} disabled={loading} className="btn-soft">
          <RefreshCcw size={16} /> Preview
        </button>
        <button onClick={generateBackup} disabled={loading || !preview} className="btn-dark">
          <Download size={16} /> Generate Backup
        </button>
        <button onClick={closeSelectedMonth} disabled={loading || !canClose} className="btn-primary">
          <Save size={16} /> Close Month
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-md px-4 py-3 text-sm ${messageTone === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          {message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Sales" value={money(preview?.total_sales)} tone="orange" />
        <StatCard label="Payments" value={money(preview?.payments_received)} tone="green" />
        <StatCard label="Expenses" value={money(preview?.expenses)} />
        <StatCard label="Gross Profit" value={money(preview?.gross_profit)} tone="navy" />
        <StatCard label="Net Profit" value={money(preview?.net_profit)} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="premium-panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarCheck size={18} className="text-orange-700" />
            <h2 className="font-semibold text-slate-950">Preview</h2>
          </div>
          <DataTable
            rows={preview?.warehouse_closing_stock || []}
            empty="No warehouse stock found"
            columns={[
              { key: "warehouse_name", label: "Warehouse" },
              { key: "sku_count", label: "SKUs" },
              { key: "closing_packets", label: "Closing Packets", render: (row) => packets(row.closing_packets) },
              { key: "stock_value", label: "Stock Value", render: (row) => money(row.stock_value) }
            ]}
          />
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">Outstanding shop balance</div>
              <div className="mt-1 text-lg font-bold text-slate-950">{money(preview?.total_outstanding_shop_balance)}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">Transactions in archive window</div>
              <div className="mt-1 text-lg font-bold text-slate-950">{packets(preview?.transaction_count_total)}</div>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="premium-panel p-4">
            <div className="mb-3 flex items-center gap-2">
              <FileArchive size={18} className="text-orange-700" />
              <h2 className="font-semibold text-slate-950">Closing status</h2>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between gap-3"><span>Backup</span><span className="font-semibold text-slate-950">{latestForMonth?.has_backup ? "Generated" : "Pending"}</span></div>
              <div className="flex justify-between gap-3"><span>Closed</span><span className="font-semibold text-slate-950">{latestForMonth?.closed_at ? "Yes" : "No"}</span></div>
              <div className="flex justify-between gap-3"><span>Archive</span><span className="font-semibold text-slate-950">{latestForMonth?.archive_status || "Disabled"}</span></div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white/80 p-4 shadow-lift">
            <div className="mb-2 flex items-center gap-2 text-slate-950">
              <Archive size={18} />
              <h2 className="font-semibold">Archive old detailed transactions</h2>
            </div>
            <p className="text-sm leading-6 text-slate-500">Disabled in Phase 1. Use backup ZIP and monthly closing records first; destructive cleanup needs a separate production policy.</p>
            <button disabled className="mt-3 inline-flex items-center gap-2 rounded-md bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-500">
              <Archive size={15} /> Phase 2 disabled
            </button>
          </section>
        </aside>
      </div>

      <section className="premium-panel mt-5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <FileArchive size={18} className="text-orange-700" />
          <h2 className="font-semibold text-slate-950">Closing history</h2>
        </div>
        <DataTable
          rows={closings}
          empty="No monthly closings yet"
          columns={[
            { key: "month_start", label: "Month", render: (row) => String(row.month_start || "").slice(0, 7) },
            { key: "status", label: "Status" },
            { key: "backup_filename", label: "Backup" },
            { key: "closed_at", label: "Closed At", render: (row) => (row.closed_at ? new Date(row.closed_at).toLocaleString() : "Pending") },
            { key: "archive_status", label: "Archive" }
          ]}
        />
      </section>
    </AdminShell>
  );
}
