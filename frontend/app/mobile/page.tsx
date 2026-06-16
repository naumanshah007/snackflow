"use client";

import { Banknote, ClipboardList, LocateFixed, LogOut, MapPin, Plus, Save, Search, ShoppingCart, Store, Trash2, UserPlus } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { apiFetch, clearToken, getToken, login, money } from "@/lib/api";
import { cartonLabel, perCarton, toPackets } from "@/lib/cartons";
import type { AnyRow } from "@/lib/types";

type Tab = "shops" | "order" | "payment" | "visit" | "newshop";
type MobileLine = { sku_id: string; cartons: string; loose_packets: string; sale_rate_per_carton: string; hint?: string };

const blankLine: MobileLine = { sku_id: "", cartons: "1", loose_packets: "0", sale_rate_per_carton: "" };
const blankShop = { name: "", owner_name: "", phone: "", area_route: "", address: "" };

export default function MobilePage() {
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("booker1");
  const [password, setPassword] = useState("booker123");
  const [tab, setTab] = useState<Tab>("shops");
  const [shops, setShops] = useState<AnyRow[]>([]);
  const [skus, setSkus] = useState<AnyRow[]>([]);
  const [inventory, setInventory] = useState<AnyRow[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<MobileLine[]>([{ ...blankLine }]);
  const [payment, setPayment] = useState("0");
  const [paymentOnly, setPaymentOnly] = useState("");
  const [summary, setSummary] = useState<AnyRow | null>(null);
  const [newShop, setNewShop] = useState({ ...blankShop });
  const [visitStatus, setVisitStatus] = useState("SHOP_CLOSED");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

  const skuMap = useMemo(() => new Map(skus.map((sku) => [String(sku.id), sku])), [skus]);
  const stockMap = useMemo(() => new Map(inventory.map((row) => [String(row.sku_id), row])), [inventory]);
  const selectedShop = shops.find((shop) => String(shop.id) === selectedShopId);
  const filteredShops = shops.filter((shop) => `${shop.name} ${shop.area_route || ""} ${shop.phone || ""}`.toLowerCase().includes(search.toLowerCase()));

  const load = async () => {
    const [shopData, skuData, invData] = await Promise.all([apiFetch<AnyRow[]>("/shops"), apiFetch<AnyRow[]>("/skus"), apiFetch<AnyRow[]>("/inventory")]);
    setShops(shopData);
    setSkus(skuData);
    setInventory(invData);
    if (!selectedShopId && shopData[0]) setSelectedShopId(String(shopData[0].id));
  };

  useEffect(() => {
    if (getToken()) {
      setAuthed(true);
      load().catch((error) => setMessage(error.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSummary = async (shopId: string) => {
    if (!shopId) return;
    try {
      setSummary(await apiFetch<AnyRow>(`/shops/${shopId}/collection-summary`));
    } catch {
      setSummary(null);
    }
  };

  useEffect(() => {
    if (tab === "payment" && selectedShopId) loadSummary(selectedShopId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedShopId]);

  const doLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      await login(username, password);
      setAuthed(true);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed");
    }
  };

  const logout = () => {
    clearToken();
    setAuthed(false);
  };

  const captureGps = async (saveToShop = true) => {
    setMessage("");
    if (!navigator.geolocation) {
      setMessage("GPS is not available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setGps({ lat, lng });
        if (saveToShop && selectedShop) {
          await apiFetch(`/shops/${selectedShop.id}`, { method: "PUT", body: { gps_latitude: lat, gps_longitude: lng } });
          setMessage("GPS saved");
          await load();
        } else {
          setMessage("GPS captured");
        }
      },
      () => setMessage("Could not capture GPS"),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const updateLine = async (index: number, patch: Partial<MobileLine>) => {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
    if (patch.sku_id && selectedShopId) {
      const sku = skuMap.get(patch.sku_id);
      const pack = sku?.pack_quantity || 24;
      try {
        const context = await apiFetch<AnyRow>(`/rates/shop/${selectedShopId}/sku/${patch.sku_id}`);
        const ratePerPacket = context.fixed_sale_rate ?? context.last_sale_rate ?? context.default_sale_rate;
        const ratePerCarton = perCarton(ratePerPacket || sku?.default_sale_rate || 0, pack);
        const label = context.fixed_sale_rate ? "Fixed" : context.last_sale_rate ? "Last" : "Default";
        setLines((current) =>
          current.map((line, lineIndex) =>
            lineIndex === index ? { ...line, sale_rate_per_carton: String(ratePerCarton || ""), hint: `${label} ${money(ratePerCarton)}/carton` } : line
          )
        );
      } catch {
        if (sku) setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, sale_rate_per_carton: String(perCarton(sku.default_sale_rate, pack) || "") } : line)));
      }
    }
  };

  const orderTotal = lines.reduce((sum, line) => {
    const sku = skuMap.get(line.sku_id);
    const pack = sku?.pack_quantity || 24;
    const packets = toPackets(line.cartons, line.loose_packets, pack);
    return sum + packets * ((Number(line.sale_rate_per_carton) || 0) / pack);
  }, 0);

  const saveOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedShop) return;
    setMessage("");
    try {
      const sale = await apiFetch<AnyRow>("/sales", {
        method: "POST",
        body: {
          shop_id: selectedShop.id,
          warehouse_id: selectedShop.assigned_warehouse_id,
          payment_received: Number(payment || 0),
          items: lines.map((line) => ({
            sku_id: Number(line.sku_id),
            cartons: Number(line.cartons || 0),
            loose_packets: Number(line.loose_packets || 0),
            sale_rate_per_carton: Number(line.sale_rate_per_carton)
          })),
          notes: notes || null
        }
      });
      await apiFetch(`/sales/${sale.id}/confirm`, { method: "POST" });
      await apiFetch("/shop-visits", {
        method: "POST",
        body: { shop_id: selectedShop.id, status: "ORDER_TAKEN", gps_latitude: gps?.lat ?? null, gps_longitude: gps?.lng ?? null, notes }
      });
      setMessage("Order delivered");
      setLines([{ ...blankLine }]);
      setPayment("0");
      setNotes("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Order failed");
    }
  };

  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedShop) return;
    setMessage("");
    try {
      await apiFetch("/payments", { method: "POST", body: { shop_id: selectedShop.id, amount: Number(paymentOnly), method: "cash", notes } });
      await apiFetch("/shop-visits", { method: "POST", body: { shop_id: selectedShop.id, status: "PAYMENT_ONLY", gps_latitude: gps?.lat ?? null, gps_longitude: gps?.lng ?? null, notes } });
      const updated = await apiFetch<AnyRow>(`/shops/${selectedShop.id}/collection-summary`);
      setSummary(updated);
      setMessage(`Payment collected: ${money(paymentOnly)}. New pending balance: ${money(updated.remaining_balance)}.`);
      setPaymentOnly("");
      setNotes("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment failed");
    }
  };

  const saveNewShop = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      await apiFetch("/shops", {
        method: "POST",
        body: {
          name: newShop.name,
          owner_name: newShop.owner_name || null,
          phone: newShop.phone || null,
          area_route: newShop.area_route || null,
          address: newShop.address || null,
          gps_latitude: gps?.lat ?? null,
          gps_longitude: gps?.lng ?? null
        }
      });
      setMessage("New shop submitted. It is pending admin approval before it becomes active.");
      setNewShop({ ...blankShop });
      await load();
      setTab("shops");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add shop");
    }
  };

  const saveVisit = async () => {
    if (!selectedShop) return;
    setMessage("");
    try {
      await apiFetch("/shop-visits", {
        method: "POST",
        body: { shop_id: selectedShop.id, status: visitStatus, gps_latitude: gps?.lat ?? null, gps_longitude: gps?.lng ?? null, notes }
      });
      setMessage("Visit saved");
      setNotes("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Visit failed");
    }
  };

  if (!authed) {
    return (
      <main className="app-bg flex min-h-screen items-center px-4 py-8">
        <form onSubmit={doLogin} className="mx-auto w-full max-w-sm rounded-lg border border-white/80 bg-white/95 p-5 shadow-premium backdrop-blur">
          <Image src="/logo.png" alt="Zaib Brothers" width={360} height={120} className="mb-6 h-auto w-52 object-contain" priority />
          <div className="mb-5 rounded-lg bg-slate-950 p-4 text-white">
            <div className="text-xs font-semibold uppercase text-orange-200">SnackFlow · Order booker</div>
            <div className="mt-2 text-2xl font-bold">Cartons, payments, and GPS visits.</div>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Username</span>
            <input className="field-lg" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
            <input type="password" className="field-lg" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {message && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>}
          <button className="btn-primary mt-5 w-full py-3">Sign in</button>
        </form>
      </main>
    );
  }

  return (
    <main className="app-bg min-h-screen pb-28">
      <header className="sticky top-0 z-20 border-b border-white/80 bg-white/90 px-4 py-3 shadow-lift backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <Image src="/logo.png" alt="Zaib Brothers" width={300} height={100} className="h-auto w-44 object-contain" priority />
          <button onClick={logout} className="rounded-md bg-slate-950 p-2.5 text-white shadow-lift" aria-label="Logout">
            <LogOut size={18} />
          </button>
        </div>
        {selectedShop && tab !== "newshop" && (
          <div className="relative mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 to-slate-800 p-4 text-white shadow-lift">
            <div className="blob -right-6 -top-8 h-28 w-28 bg-orange-500/30" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-orange-200">Selected shop</div>
                <div className="mt-1 text-lg font-bold leading-tight">{selectedShop.name}</div>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5 text-xs text-slate-300">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-amber-300" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                  </span>
                  Pending
                </div>
                <div className="text-lg font-bold text-amber-200">{money(selectedShop.current_balance)}</div>
              </div>
            </div>
            <div className="relative mt-3 flex items-center justify-between gap-2 text-xs text-slate-300">
              <span className="truncate">{selectedShop.area_route || selectedShop.phone || "No route assigned"}</span>
              <span className="flex items-center gap-2">
                {selectedShop.status === "PENDING_APPROVAL" && <span className="rounded-full bg-orange-500/20 px-2 py-1 text-orange-100">Pending approval</span>}
                {selectedShop.gps_latitude && selectedShop.gps_longitude ? <span className="rounded-full bg-green-500/15 px-2 py-1 text-green-100">GPS saved</span> : <span className="rounded-full bg-orange-500/15 px-2 py-1 text-orange-100">GPS needed</span>}
              </span>
            </div>
          </div>
        )}
        {message && <div className="mt-3 rounded-md border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-orange-800">{message}</div>}
      </header>

      <section key={tab} className="mx-auto max-w-3xl px-4 py-4" style={{ animation: "rise-in 0.28s ease both" }}>
        {tab === "shops" && (
          <div className="space-y-3">
            <button onClick={() => setTab("newshop")} className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lift">
              <UserPlus size={18} /> Add new shop
            </button>
            <label className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/95 px-3 py-3 shadow-premium backdrop-blur">
              <Search size={18} className="text-slate-500" />
              <input className="w-full bg-transparent text-base outline-none placeholder:text-slate-400" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shops" />
            </label>
            {filteredShops.map((shop) => (
              <div key={shop.id} className={`w-full rounded-2xl border p-4 shadow-premium transition ${String(shop.id) === selectedShopId ? "border-orange-300 bg-orange-50/95" : "border-white/80 bg-white/95"}`}>
                <button onClick={() => setSelectedShopId(String(shop.id))} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold text-slate-950">{shop.name}</div>
                        {shop.status === "PENDING_APPROVAL" && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">Pending</span>}
                        {shop.gps_latitude && shop.gps_longitude && <MapPin size={13} className="text-emerald-600" />}
                      </div>
                      <div className="mt-1 truncate text-sm text-slate-500">{shop.owner_name || shop.phone || shop.area_route}</div>
                    </div>
                    <div className="shrink-0 rounded-xl bg-slate-950 px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
                        {Number(shop.current_balance) > 0 && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-amber-300" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                          </span>
                        )}
                        Pending
                      </div>
                      <div className="text-sm font-bold text-amber-200">{money(shop.current_balance)}</div>
                    </div>
                  </div>
                </button>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => { setSelectedShopId(String(shop.id)); setTab("order"); }} className="rounded-xl bg-orange-600 px-3 py-3 text-sm font-semibold text-white shadow-lift transition active:scale-95">
                    Order
                  </button>
                  <button type="button" onClick={() => { setSelectedShopId(String(shop.id)); setTab("payment"); }} className="rounded-xl bg-green-600 px-3 py-3 text-sm font-semibold text-white shadow-lift transition active:scale-95">
                    Collect
                  </button>
                  {shop.gps_latitude && shop.gps_longitude ? (
                    <a href={`https://www.google.com/maps?q=${shop.gps_latitude},${shop.gps_longitude}`} target="_blank" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm">
                      Map
                    </a>
                  ) : (
                    <button type="button" onClick={() => { setSelectedShopId(String(shop.id)); captureGps(); }} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition active:scale-95">
                      GPS
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "order" && (
          <form onSubmit={saveOrder} className="space-y-3">
            {lines.map((line, index) => {
              const stock = stockMap.get(line.sku_id);
              return (
                <div key={index} className="rounded-lg border border-white/80 bg-white/95 p-3 shadow-premium backdrop-blur">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="rounded bg-slate-100 px-2 py-1 text-sm font-semibold text-slate-800">Item {index + 1}</span>
                    <button type="button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="rounded-md border border-slate-200 bg-white p-2 text-slate-500 shadow-sm">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <select className="field-lg" value={line.sku_id} onChange={(event) => updateLine(index, { sku_id: event.target.value })} required>
                    <option value="">Select product</option>
                    {skus.map((sku) => (
                      <option key={sku.id} value={sku.id}>
                        {sku.display_name}
                      </option>
                    ))}
                  </select>
                  {line.sku_id && <div className="mt-1 text-xs font-medium text-slate-600">Available: {stock ? stock.carton_label : "0 pkts"}</div>}
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label>
                      <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Cartons</span>
                      <input className="field-lg" type="number" min="0" value={line.cartons} onChange={(event) => updateLine(index, { cartons: event.target.value })} />
                    </label>
                    <label>
                      <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">+ Pkts</span>
                      <input className="field-lg" type="number" min="0" value={line.loose_packets} onChange={(event) => updateLine(index, { loose_packets: event.target.value })} />
                    </label>
                    <label>
                      <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Rate/ctn</span>
                      <input className="field-lg" type="number" min="0" step="0.01" value={line.sale_rate_per_carton} onChange={(event) => updateLine(index, { sale_rate_per_carton: event.target.value })} />
                    </label>
                  </div>
                  <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">{line.hint || "Rate per carton loads after product selection"}</div>
                </div>
              );
            })}
            <button type="button" onClick={() => setLines((current) => [...current, { ...blankLine }])} className="btn-soft w-full py-3">
              <Plus size={18} /> Add item
            </button>
            <input className="field-lg" type="number" min="0" value={payment} onChange={(event) => setPayment(event.target.value)} placeholder="Payment received" />
            <textarea className="field-lg min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" />
            <div className="rounded-lg bg-slate-950 p-4 text-white shadow-premium">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-300">Order total</div>
                  <div className="mt-1 text-3xl font-bold">{money(orderTotal)}</div>
                </div>
                <div className="text-right text-sm text-slate-300">
                  <div>Payment</div>
                  <div className="mt-1 font-semibold text-green-200">{money(payment)}</div>
                </div>
              </div>
            </div>
            <button className="btn-primary w-full py-4 text-base">
              <Save size={20} /> Save delivered order
            </button>
          </form>
        )}

        {tab === "payment" && (
          <div className="space-y-3">
            {summary && (
              <div className="rounded-lg border border-white/80 bg-white/95 p-4 shadow-premium backdrop-blur">
                <div className="eyebrow">Collection</div>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Previous balance" value={money(summary.previous_balance)} />
                  <Stat label="Today's bill" value={money(summary.today_bill)} />
                  <Stat label="Total payable" value={money(summary.total_payable)} />
                  <Stat label="Collected today" value={money(summary.collected_today)} />
                  <Stat label="Remaining balance" value={money(summary.remaining_balance)} highlight />
                  <Stat label="Last payment" value={summary.last_payment_date ? new Date(summary.last_payment_date).toLocaleDateString() : "—"} />
                </div>
              </div>
            )}
            <form onSubmit={savePayment} className="space-y-3 rounded-lg border border-white/80 bg-white/95 p-4 shadow-premium backdrop-blur">
              <div className="eyebrow">Payment collection</div>
              <input className="field-lg text-lg" type="number" min="1" value={paymentOnly} onChange={(event) => setPaymentOnly(event.target.value)} placeholder="Amount collected" required />
              <textarea className="field-lg min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" />
              <div className="text-xs text-slate-500">Collection date &amp; time are recorded automatically as now.</div>
              <button className="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-4 font-semibold text-white shadow-lift">
                <Banknote size={20} /> Save payment
              </button>
            </form>
          </div>
        )}

        {tab === "newshop" && (
          <form onSubmit={saveNewShop} className="space-y-3 rounded-lg border border-white/80 bg-white/95 p-4 shadow-premium backdrop-blur">
            <div className="eyebrow">New shop · pending approval</div>
            <input className="field-lg" value={newShop.name} onChange={(event) => setNewShop((current) => ({ ...current, name: event.target.value }))} placeholder="Shop name" required />
            <input className="field-lg" value={newShop.owner_name} onChange={(event) => setNewShop((current) => ({ ...current, owner_name: event.target.value }))} placeholder="Owner / shopkeeper name" />
            <input className="field-lg" value={newShop.phone} onChange={(event) => setNewShop((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" />
            <input className="field-lg" value={newShop.area_route} onChange={(event) => setNewShop((current) => ({ ...current, area_route: event.target.value }))} placeholder="Area / route" />
            <textarea className="field-lg min-h-20" value={newShop.address} onChange={(event) => setNewShop((current) => ({ ...current, address: event.target.value }))} placeholder="Address" />
            <button type="button" onClick={() => captureGps(false)} className="btn-soft w-full py-3">
              <LocateFixed size={18} /> {gps ? `GPS ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : "Capture GPS"}
            </button>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">Warehouse and order booker are assigned automatically from your account. Admin will approve before it goes active.</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTab("shops")} className="btn-soft py-3">Cancel</button>
              <button className="btn-primary py-3">
                <Save size={18} /> Submit shop
              </button>
            </div>
          </form>
        )}

        {tab === "visit" && (
          <div className="space-y-3 rounded-lg border border-white/80 bg-white/95 p-4 shadow-premium backdrop-blur">
            <div className="eyebrow">Visit outcome</div>
            <select className="field-lg" value={visitStatus} onChange={(event) => setVisitStatus(event.target.value)}>
              <option value="SHOP_CLOSED">Shop closed</option>
              <option value="NO_ORDER">No order</option>
              <option value="OWNER_NOT_AVAILABLE">Owner not available</option>
              <option value="DELIVERY_DONE">Delivery done</option>
            </select>
            <textarea className="field-lg min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" />
            <button onClick={() => captureGps()} className="btn-soft w-full py-3">
              <LocateFixed size={20} /> Capture GPS
            </button>
            <button onClick={saveVisit} className="btn-dark w-full py-4">
              <ClipboardList size={20} /> Save visit
            </button>
          </div>
        )}
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-3xl grid-cols-4 gap-1 border-t border-white/80 bg-white/90 p-2 shadow-premium backdrop-blur-xl">
        {([
          ["shops", Store, "Shops"],
          ["order", ShoppingCart, "Order"],
          ["payment", Banknote, "Collect"],
          ["visit", MapPin, "Visit"]
        ] as const).map(([value, Icon, label]) => {
          const TypedIcon = Icon as typeof Store;
          return (
            <button key={String(value)} onClick={() => setTab(value as Tab)} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-semibold transition-all duration-200 ${tab === value ? "scale-[1.03] bg-slate-950 text-white shadow-lift" : "text-slate-500 hover:bg-slate-100"}`}>
              <TypedIcon size={20} />
              {label as string}
            </button>
          );
        })}
      </nav>
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${highlight ? "border-green-200 bg-green-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="text-[11px] uppercase text-slate-500">{label}</div>
      <div className={`mt-0.5 font-bold ${highlight ? "text-green-700" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}
