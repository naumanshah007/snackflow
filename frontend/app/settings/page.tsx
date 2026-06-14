"use client";

import { Save } from "lucide-react";
import { useEffect, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch } from "@/lib/api";
import type { AnyRow } from "@/lib/types";

export default function SettingsPage() {
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLogs(await apiFetch<AnyRow[]>("/audit-logs?limit=200"));
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      await apiFetch("/auth/change-password", { method: "POST", body: { current_password: currentPassword, new_password: newPassword } });
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password changed");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password change failed");
    }
  };

  return (
    <AdminShell title="Settings">
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <form onSubmit={changePassword} className="premium-panel p-4">
          <h1 className="font-semibold text-slate-950">Account security</h1>
          <p className="mb-4 text-sm text-slate-500">Change the current user password.</p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Current password</span>
            <input type="password" className="field" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">New password</span>
            <input type="password" className="field" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={6} />
          </label>
          {message && <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</div>}
          <button className="btn-dark mt-4 w-full">
            <Save size={18} /> Save password
          </button>
        </form>

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
