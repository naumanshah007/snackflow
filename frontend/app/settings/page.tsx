"use client";

import { AlertTriangle, Eye, EyeOff, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch } from "@/lib/api";
import type { AnyRow } from "@/lib/types";

const RESET_SCOPES = [
  { value: "transactions", label: "Transactions only (Recommended)", hint: "Clears sales, stock, payments, ledgers, expenses & monthly closings. Keeps products, SKUs, shops, warehouses & users. Shop balances reset to opening." },
  { value: "transactions_and_shops", label: "Transactions + shops", hint: "Also removes all shops and shop rate rules. Keeps products, SKUs, warehouses & users." },
  { value: "all", label: "Everything except logins", hint: "Full fresh start: also removes products, SKUs and warehouses. Keeps only user accounts so you can log in." }
];

export default function SettingsPage() {
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [me, setMe] = useState<AnyRow | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [resetScope, setResetScope] = useState("transactions");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetTone, setResetTone] = useState<"success" | "error">("success");
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    setLogs(await apiFetch<AnyRow[]>("/audit-logs?limit=200"));
  };

  useEffect(() => {
    load().catch(() => undefined);
    apiFetch<AnyRow>("/auth/me").then(setMe).catch(() => undefined);
  }, []);

  const runReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setResetMessage("");
    if (resetConfirm !== "RESET") {
      setResetTone("error");
      setResetMessage('Type RESET (in capitals) to confirm.');
      return;
    }
    setResetting(true);
    try {
      const result = await apiFetch<AnyRow>("/reset-data", { method: "POST", body: { scope: resetScope, confirm: "RESET" } });
      setResetTone("success");
      setResetMessage(result?.message || "Data reset complete.");
      setResetConfirm("");
      await load();
    } catch (error) {
      setResetTone("error");
      setResetMessage(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (newPassword.length < 6) {
      setMessageTone("error");
      setMessage("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessageTone("error");
      setMessage("New password and confirm password do not match.");
      return;
    }
    try {
      await apiFetch("/auth/change-password", { method: "POST", body: { current_password: currentPassword, new_password: newPassword } });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessageTone("success");
      setMessage("Password changed successfully. Please use the new password next time.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Password change failed");
    }
  };

  return (
    <AdminShell title="Settings">
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5">
        <form onSubmit={changePassword} className="premium-panel p-4">
          <h1 className="font-semibold text-slate-950">Account security</h1>
          <p className="mb-4 text-sm text-slate-500">Save your new password safely. If forgotten, owner recovery must be done by system maintainer.</p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Current password</span>
            <span className="flex rounded-md border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-orange-200">
              <input type={showCurrentPassword ? "text" : "password"} className="min-w-0 flex-1 rounded-l-md px-3 py-2 outline-none" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
              <button type="button" onClick={() => setShowCurrentPassword((value) => !value)} className="px-3 text-slate-500" aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}>
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">New password</span>
            <span className="flex rounded-md border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-orange-200">
              <input type={showNewPassword ? "text" : "password"} className="min-w-0 flex-1 rounded-l-md px-3 py-2 outline-none" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={6} />
              <button type="button" onClick={() => setShowNewPassword((value) => !value)} className="px-3 text-slate-500" aria-label={showNewPassword ? "Hide new password" : "Show new password"}>
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Confirm new password</span>
            <span className="flex rounded-md border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-orange-200">
              <input type={showConfirmPassword ? "text" : "password"} className="min-w-0 flex-1 rounded-l-md px-3 py-2 outline-none" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} />
              <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="px-3 text-slate-500" aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <p className="mt-3 text-xs text-slate-500">Your old password remains valid until this form saves successfully.</p>
          {message && <div className={`mt-3 rounded-md border px-3 py-2 text-sm ${messageTone === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>{message}</div>}
          <button className="btn-dark mt-4 w-full">
            <Save size={18} /> Save password
          </button>
        </form>

        {me?.role === "OWNER" && (
          <form onSubmit={runReset} className="premium-panel border-red-200 p-4">
            <h2 className="flex items-center gap-2 font-semibold text-red-700">
              <AlertTriangle size={18} /> Start fresh (clear data)
            </h2>
            <p className="mb-3 text-sm text-slate-500">Remove the demo/test data so you can start with real records. This cannot be undone.</p>
            <div className="space-y-2">
              {RESET_SCOPES.map((scope) => (
                <label key={scope.value} className={`block cursor-pointer rounded-md border p-3 ${resetScope === scope.value ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
                  <span className="flex items-center gap-2">
                    <input type="radio" name="reset-scope" value={scope.value} checked={resetScope === scope.value} onChange={() => setResetScope(scope.value)} />
                    <span className="text-sm font-semibold text-slate-800">{scope.label}</span>
                  </span>
                  <span className="mt-1 block pl-6 text-xs text-slate-500">{scope.hint}</span>
                </label>
              ))}
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Type RESET to confirm</span>
              <input className="field" value={resetConfirm} onChange={(event) => setResetConfirm(event.target.value)} placeholder="RESET" />
            </label>
            {resetMessage && (
              <div className={`mt-3 rounded-md border px-3 py-2 text-sm ${resetTone === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>{resetMessage}</div>
            )}
            <button disabled={resetting || resetConfirm !== "RESET"} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2.5 font-semibold text-white shadow-lift hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 size={18} /> {resetting ? "Clearing..." : "Clear data now"}
            </button>
          </form>
        )}
        </div>

        <section>
          <h2 className="mb-3 font-semibold text-slate-950">Audit logs</h2>
          <DataTable
            rows={logs}
            columns={[
              { key: "created_at", label: "Time", render: (row) => new Date(row.created_at).toLocaleString() },
              { key: "action", label: "Action" },
              { key: "entity_type", label: "Entity" },
              { key: "entity_id", label: "ID" },
              { key: "user_id", label: "User" }
            ]}
          />
        </section>
      </div>
    </AdminShell>
  );
}
