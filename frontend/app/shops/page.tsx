"use client";

import { ExternalLink, LocateFixed, MapPin, Pencil, Plus, RefreshCcw, Save, Search, Store, Users, Warehouse } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/AdminShell";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import { apiFetch, money } from "@/lib/api";
import type { AnyRow } from "@/lib/types";
import { WEEKDAYS, shortDay, todayWeekday } from "@/lib/weekdays";

type ShopForm = {
  name: string;
  owner_name: string;
  phone: string;
  alternate_phone: string;
  address: string;
  area_route: string;
  gps_latitude: string;
  gps_longitude: string;
  assigned_warehouse_id: string;
  assigned_order_booker_id: string;
  route_days: string[];
  credit_limit: string;
  opening_balance: string;
  notes: string;
  is_active: boolean;
};

const blankForm: ShopForm = {
  name: "",
  owner_name: "",
  phone: "",
  alternate_phone: "",
  address: "",
  area_route: "",
  gps_latitude: "",
  gps_longitude: "",
  assigned_warehouse_id: "",
  assigned_order_booker_id: "",
  route_days: [],
  credit_limit: "",
  opening_balance: "0",
  notes: "",
  is_active: true
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-green-50 text-green-700" },
  PENDING_APPROVAL: { label: "Pending approval", className: "bg-orange-50 text-orange-700" },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-700" }
};

function statusBadge(shop: AnyRow) {
  const status = String(shop.status || (shop.is_active ? "ACTIVE" : "")).toUpperCase();
  if (STATUS_BADGE[status]) return STATUS_BADGE[status];
  return shop.is_active ? STATUS_BADGE.ACTIVE : { label: "Inactive", className: "bg-slate-100 text-slate-600" };
}

function valueOrNull(value: string) {
  return value.trim() === "" ? null : value.trim();
}

function numberOrNull(value: string) {
  return value.trim() === "" ? null : Number(value);
}

export default function ShopsPage() {
  const [shops, setShops] = useState<AnyRow[]>([]);
  const [warehouses, setWarehouses] = useState<AnyRow[]>([]);
  const [users, setUsers] = useState<AnyRow[]>([]);
  const [form, setForm] = useState<ShopForm>(blankForm);
  const [editingShop, setEditingShop] = useState<AnyRow | null>(null);
  const [search, setSearch] = useState("");
  const [routeDayFilter, setRouteDayFilter] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("error");
  const [loading, setLoading] = useState(false);

  const showError = (text: string) => {
    setMessageTone("error");
    setMessage(text);
  };
  const showSuccess = (text: string) => {
    setMessageTone("success");
    setMessage(text);
  };

  const orderBookers = users.filter((user) => user.role === "ORDER_BOOKER");
  const filteredShops = useMemo(() => {
    const term = search.toLowerCase().trim();
    return shops.filter((shop) => {
      const matchesTerm = !term || `${shop.name} ${shop.owner_name || ""} ${shop.phone || ""} ${shop.area_route || ""} ${shop.address || ""}`.toLowerCase().includes(term);
      const matchesDay = !routeDayFilter || (Array.isArray(shop.route_days) && shop.route_days.includes(routeDayFilter));
      return matchesTerm && matchesDay;
    });
  }, [search, routeDayFilter, shops]);

  const stats = useMemo(() => {
    const active = shops.filter((shop) => (shop.status ? shop.status === "ACTIVE" : shop.is_active)).length;
    const pending = shops.filter((shop) => shop.status === "PENDING_APPROVAL").length;
    const balance = shops.reduce((sum, shop) => sum + Number(shop.current_balance || 0), 0);
    return { active, pending, balance };
  }, [shops]);

  const load = async () => {
    setLoading(true);
    try {
      const [shopData, warehouseData, userData] = await Promise.all([apiFetch<AnyRow[]>("/shops"), apiFetch<AnyRow[]>("/warehouses"), apiFetch<AnyRow[]>("/users")]);
      setShops(shopData);
      setWarehouses(warehouseData);
      setUsers(userData);
      setForm((current) => ({
        ...current,
        assigned_warehouse_id: current.assigned_warehouse_id || String(warehouseData[0]?.id || ""),
        assigned_order_booker_id: current.assigned_order_booker_id || String(userData.find((user) => user.role === "ORDER_BOOKER")?.id || "")
      }));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not load shops");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setEditingShop(null);
    setForm({
      ...blankForm,
      route_days: [],
      assigned_warehouse_id: String(warehouses[0]?.id || ""),
      assigned_order_booker_id: String(orderBookers[0]?.id || "")
    });
    setMessage("");
  };

  const startEdit = (shop: AnyRow) => {
    setEditingShop(shop);
    setForm({
      name: shop.name || "",
      owner_name: shop.owner_name || "",
      phone: shop.phone || "",
      alternate_phone: shop.alternate_phone || "",
      address: shop.address || "",
      area_route: shop.area_route || "",
      gps_latitude: shop.gps_latitude == null ? "" : String(shop.gps_latitude),
      gps_longitude: shop.gps_longitude == null ? "" : String(shop.gps_longitude),
      assigned_warehouse_id: shop.assigned_warehouse_id == null ? "" : String(shop.assigned_warehouse_id),
      assigned_order_booker_id: shop.assigned_order_booker_id == null ? "" : String(shop.assigned_order_booker_id),
      route_days: Array.isArray(shop.route_days) ? shop.route_days : [],
      credit_limit: shop.credit_limit == null ? "" : String(shop.credit_limit),
      opening_balance: shop.opening_balance == null ? "0" : String(shop.opening_balance),
      notes: shop.notes || "",
      is_active: Boolean(shop.is_active)
    });
    setMessage("");
  };

  const captureGps = () => {
    setMessage("");
    if (!navigator.geolocation) {
      setMessage("GPS is not available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          gps_latitude: String(position.coords.latitude),
          gps_longitude: String(position.coords.longitude)
        }));
        setMessage("GPS captured. Save the shop to keep it.");
      },
      () => setMessage("Could not capture GPS"),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      owner_name: valueOrNull(form.owner_name),
      phone: valueOrNull(form.phone),
      alternate_phone: valueOrNull(form.alternate_phone),
      address: valueOrNull(form.address),
      area_route: valueOrNull(form.area_route),
      gps_latitude: numberOrNull(form.gps_latitude),
      gps_longitude: numberOrNull(form.gps_longitude),
      assigned_warehouse_id: numberOrNull(form.assigned_warehouse_id),
      assigned_order_booker_id: numberOrNull(form.assigned_order_booker_id),
      route_days: form.route_days,
      credit_limit: numberOrNull(form.credit_limit),
      notes: valueOrNull(form.notes),
      is_active: form.is_active
    };
    if (!editingShop) {
      payload.opening_balance = Number(form.opening_balance || 0);
    }

    try {
      const wasEditing = Boolean(editingShop);
      if (editingShop) {
        await apiFetch(`/shops/${editingShop.id}`, { method: "PUT", body: payload });
      } else {
        await apiFetch("/shops", { method: "POST", body: payload });
      }
      await load();
      if (!wasEditing) startCreate();
      showSuccess(wasEditing ? "Shop saved — changes are live." : "Shop added — it now appears in the list below.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Save failed");
    }
  };

  const selectedMapUrl = form.gps_latitude && form.gps_longitude ? `https://www.google.com/maps?q=${form.gps_latitude},${form.gps_longitude}` : "";

  return (
    <AdminShell title="Shops">
      <section className="mb-5 overflow-hidden rounded-lg border border-white/80 bg-slate-950 shadow-premium">
        <div className="grid gap-5 p-5 text-white lg:grid-cols-[minmax(0,1fr)_520px] lg:p-6">
          <div>
            <div className="text-xs font-semibold uppercase text-orange-200">Shop route book</div>
            <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">Add shops, assign routes, capture GPS, and keep balances visible.</h1>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={startCreate} className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-lift hover:bg-orange-700">
                <Plus size={18} /> Add Shop
              </button>
              <button onClick={load} className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15">
                <RefreshCcw size={18} /> Refresh
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-white/10 bg-white/10 p-4">
              <Store size={18} className="text-orange-200" />
              <div className="mt-3 text-2xl font-bold">{stats.active}</div>
              <div className="mt-1 text-xs text-slate-300">Active shops</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 p-4">
              <Store size={18} className="text-amber-200" />
              <div className="mt-3 text-2xl font-bold">{stats.pending}</div>
              <div className="mt-1 text-xs text-slate-300">Pending approval</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 p-4">
              <Users size={18} className="text-sky-200" />
              <div className="mt-3 text-2xl font-bold">{money(stats.balance)}</div>
              <div className="mt-1 text-xs text-slate-300">Outstanding</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="space-y-4">
          <div className="surface-band flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <label className="flex flex-1 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 shadow-sm">
              <Search size={18} className="text-slate-500" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by shop, owner, route, phone, or address" />
            </label>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-3 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Route day</span>
              <select className="bg-transparent text-sm outline-none" value={routeDayFilter} onChange={(event) => setRouteDayFilter(event.target.value)}>
                <option value="">All days</option>
                {WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                    {day === todayWeekday() ? " (today)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {filteredShops.map((shop) => {
              const hasGps = Boolean(shop.gps_latitude && shop.gps_longitude);
              return (
                <article key={shop.id} className="premium-panel p-4 transition hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-lg font-bold text-slate-950">{shop.name}</h2>
                        {(() => {
                          const badge = statusBadge(shop);
                          return <span className={`rounded px-2 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>;
                        })()}
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">{shop.owner_name || "No owner"} · {shop.area_route || "No route"}</p>
                      {Array.isArray(shop.route_days) && shop.route_days.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {shop.route_days.map((day: string) => (
                            <span key={day} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${day === todayWeekday() ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>
                              {shortDay(day)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-[10px] font-semibold uppercase text-slate-400">No route days</div>
                      )}
                    </div>
                    <button onClick={() => startEdit(shop)} className="inline-flex shrink-0 items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-lift hover:bg-slate-800">
                      <Pencil size={15} /> Edit
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Balance</div>
                      <div className="mt-1 font-bold text-slate-950">{money(shop.current_balance)}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Credit limit</div>
                      <div className="mt-1 font-bold text-slate-950">{shop.credit_limit ? money(shop.credit_limit) : "Not set"}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-2 font-semibold ${hasGps ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
                      <MapPin size={15} /> {hasGps ? "GPS saved" : "GPS missing"}
                    </span>
                    {shop.phone && <span className="rounded-md bg-slate-100 px-2.5 py-2 font-semibold text-slate-700">{shop.phone}</span>}
                    {hasGps && (
                      <a href={`https://www.google.com/maps?q=${shop.gps_latitude},${shop.gps_longitude}`} target="_blank" className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-2 font-semibold text-slate-700 shadow-sm">
                        Open Map <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}

            {filteredShops.length === 0 && (
              <div className="premium-panel col-span-full p-10 text-center text-slate-500">
                {loading ? "Loading shops..." : "No shops found."}
              </div>
            )}
          </div>
        </section>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <form onSubmit={submit} className="premium-panel p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">{editingShop ? "Edit shop" : "Add shop"}</div>
                <h2 className="mt-1 text-xl font-bold text-slate-950">{editingShop ? editingShop.name : "New shop"}</h2>
              </div>
              <button type="button" onClick={startCreate} className="rounded-md border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50" aria-label="Add shop">
                <Plus size={18} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="sm:col-span-2 xl:col-span-1">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Shop name</span>
                <input className="field" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Owner</span>
                <input className="field" value={form.owner_name} onChange={(event) => setForm((current) => ({ ...current, owner_name: event.target.value }))} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Route</span>
                <input className="field" value={form.area_route} onChange={(event) => setForm((current) => ({ ...current, area_route: event.target.value }))} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Phone</span>
                <input className="field" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Alternate phone</span>
                <input className="field" value={form.alternate_phone} onChange={(event) => setForm((current) => ({ ...current, alternate_phone: event.target.value }))} />
              </label>
              <label className="sm:col-span-2 xl:col-span-1">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Address</span>
                <textarea className="field min-h-20" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Warehouse</span>
                <select className="field" value={form.assigned_warehouse_id} onChange={(event) => setForm((current) => ({ ...current, assigned_warehouse_id: event.target.value }))}>
                  <option value="">Select warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Order booker</span>
                <select className="field" value={form.assigned_order_booker_id} onChange={(event) => setForm((current) => ({ ...current, assigned_order_booker_id: event.target.value }))}>
                  <option value="">Select order booker</option>
                  {orderBookers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sm:col-span-2 xl:col-span-1">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Route days</span>
                <WeekdayPicker value={form.route_days} today={todayWeekday()} onChange={(next) => setForm((current) => ({ ...current, route_days: next }))} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Credit limit</span>
                <input className="field" type="number" min="0" value={form.credit_limit} onChange={(event) => setForm((current) => ({ ...current, credit_limit: event.target.value }))} />
              </label>
              {!editingShop && (
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Opening balance</span>
                  <input className="field" type="number" min="0" value={form.opening_balance} onChange={(event) => setForm((current) => ({ ...current, opening_balance: event.target.value }))} />
                </label>
              )}
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">GPS latitude</span>
                <input className="field" type="number" step="any" value={form.gps_latitude} onChange={(event) => setForm((current) => ({ ...current, gps_latitude: event.target.value }))} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">GPS longitude</span>
                <input className="field" type="number" step="any" value={form.gps_longitude} onChange={(event) => setForm((current) => ({ ...current, gps_longitude: event.target.value }))} />
              </label>
              <label className="sm:col-span-2 xl:col-span-1">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Notes</span>
                <textarea className="field min-h-20" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={captureGps} className="btn-soft">
                <LocateFixed size={17} /> Capture GPS
              </button>
              {selectedMapUrl ? (
                <a href={selectedMapUrl} target="_blank" className="btn-soft">
                  <ExternalLink size={17} /> Open Map
                </a>
              ) : (
                <div className="flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-400">
                  No GPS
                </div>
              )}
            </div>

            <label className="mt-4 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Warehouse size={16} /> Active shop
              </span>
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-orange-600" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
            </label>

            {message && (
              <div
                className={`mt-3 rounded-md border px-3 py-2 text-sm ${
                  messageTone === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {message}
              </div>
            )}

            <button className="btn-primary mt-4 w-full py-3">
              <Save size={18} /> {editingShop ? "Save Shop Changes" : "Add Shop"}
            </button>
          </form>
        </aside>
      </div>
    </AdminShell>
  );
}
