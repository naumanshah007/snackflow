"use client";

import { Clock3, Download, Plus, RefreshCcw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch } from "@/lib/api";
import { exportCsv, type CsvColumn } from "@/lib/csv";
import type { AnyRow, ColumnConfig, FieldConfig, Option } from "@/lib/types";

function coerceValue(field: FieldConfig, value: any) {
  if (field.type === "checkbox") return Boolean(value);
  if (value === "") return null;
  if (field.type === "number" || field.valueType === "number") return Number(value);
  return value;
}

export function ResourcePage({
  title,
  endpoint,
  fields,
  columns,
  historyEndpoint,
  exportFilename,
  exportColumns
}: {
  title: string;
  endpoint: string;
  fields: FieldConfig[];
  columns: ColumnConfig[];
  historyEndpoint?: (row: AnyRow) => string;
  exportFilename?: string;
  exportColumns?: CsvColumn[];
}) {
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [form, setForm] = useState<AnyRow>({});
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AnyRow[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});

  const initialForm = useMemo(() => {
    const next: AnyRow = {};
    fields.forEach((field) => {
      next[field.name] = field.type === "checkbox" ? true : "";
    });
    return next;
  }, [fields]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<AnyRow[]>(endpoint);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  useEffect(() => {
    loadRows().catch((error) => setMessage(error.message));
  }, [loadRows]);

  useEffect(() => {
    fields.forEach((field) => {
      if (!field.optionEndpoint) return;
      apiFetch<AnyRow[]>(field.optionEndpoint)
        .then((data) => {
          setOptions((current) => ({
            ...current,
            [field.name]: data.map((row) => ({
              value: row[field.optionValueKey || "id"],
              label: row[field.optionLabelKey || "display_name"] || row.name || row.username || `#${row.id}`
            }))
          }));
        })
        .catch(() => undefined);
    });
  }, [fields]);

  const loadHistory = async (row: AnyRow) => {
    if (!historyEndpoint) return;
    const data = await apiFetch<AnyRow[]>(historyEndpoint(row));
    setHistory(data);
  };

  const beginEdit = async (row: AnyRow) => {
    setEditing(row);
    const next: AnyRow = {};
    fields.forEach((field) => {
      next[field.name] = row[field.name] ?? (field.type === "checkbox" ? false : "");
    });
    setForm(next);
    setMessage("");
    await loadHistory(row);
  };

  const reset = () => {
    setEditing(null);
    setHistory([]);
    setForm(initialForm);
    setMessage("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    const payload: AnyRow = {};
    for (const field of fields) {
      if ((field.required || (!editing && field.requiredOnCreate)) && (form[field.name] === "" || form[field.name] == null)) {
        setMessage(`${field.label} is required`);
        return;
      }
      payload[field.name] = coerceValue(field, form[field.name]);
    }
    try {
      const path = editing ? `${endpoint}/${editing.id}` : endpoint;
      await apiFetch(path, { method: editing ? "PUT" : "POST", body: payload });
      setMessage(editing ? "Saved changes with audit history" : "Created");
      reset();
      await loadRows();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  };

  return (
    <AdminShell title={title}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-white/80 bg-white/75 p-4 shadow-lift backdrop-blur">
            <div>
              <div className="eyebrow">Master data</div>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">{title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">Edit operational records with audit history preserved for price, rate, and ledger-sensitive changes.</p>
            </div>
            <div className="flex gap-2">
              {exportColumns && (
                <button onClick={() => exportCsv(exportFilename || `${title.toLowerCase()}.csv`, rows, exportColumns)} className="btn-soft">
                  <Download size={16} /> CSV
                </button>
              )}
              <button onClick={loadRows} className="btn-soft">
                <RefreshCcw size={16} /> Refresh
              </button>
            </div>
          </div>
          <DataTable
            rows={rows}
            columns={[
              ...columns,
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <button onClick={() => beginEdit(row)} className="focus-ring rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                    Edit
                  </button>
                )
              }
            ]}
            empty={loading ? "Loading..." : "No records yet"}
          />
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
          <form onSubmit={submit} className="premium-panel p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">{editing ? "Editing" : "Create"}</div>
                <h2 className="mt-1 font-semibold text-slate-950">{editing ? "Edit record" : "New record"}</h2>
                <p className="text-xs text-slate-500">{editing ? `Record ID ${editing.id}` : "Required fields are validated before save"}</p>
              </div>
              <button type="button" onClick={reset} className="focus-ring rounded-md border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50" aria-label="New">
                <Plus size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {fields.map((field) => {
                const fieldOptions = field.options || options[field.name] || [];
                return (
                  <label key={field.name} className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{field.label}</span>
                    {field.type === "textarea" ? (
                      <textarea
                        className="field min-h-24"
                        value={form[field.name] ?? ""}
                        placeholder={field.placeholder}
                        onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      />
                    ) : field.type === "select" ? (
                      <select
                        className="field"
                        value={form[field.name] ?? ""}
                        onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      >
                        <option value="">Select</option>
                        {fieldOptions.map((option) => (
                          <option key={String(option.value)} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "checkbox" ? (
                      <span className="inline-flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-slate-300 text-orange-600"
                          checked={Boolean(form[field.name])}
                          onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.checked }))}
                        />
                        <span className="text-sm font-medium text-slate-700">Enabled</span>
                      </span>
                    ) : (
                      <input
                        type={field.type || "text"}
                        className="field"
                        value={form[field.name] ?? ""}
                        placeholder={field.placeholder}
                        onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      />
                    )}
                  </label>
                );
              })}
            </div>
            {message && <div className="mt-3 rounded-md border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-orange-800">{message}</div>}
            <button type="submit" className="btn-primary mt-4 w-full">
              <Save size={18} /> Save
            </button>
          </form>

          {historyEndpoint && (
            <section className="premium-panel p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white">
                  <Clock3 size={18} />
                </span>
                Change history
              </div>
              {history.length === 0 ? (
                <p className="text-sm text-slate-500">Select a record to see its audit trace.</p>
              ) : (
                <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
                  {history.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-slate-200 bg-slate-50/80 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded bg-orange-100 px-2 py-1 font-semibold text-orange-800">{entry.action}</span>
                        <span className="text-slate-500">{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-600">
                        {JSON.stringify({ old: entry.old_values, new: entry.new_values }, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </AdminShell>
  );
}
