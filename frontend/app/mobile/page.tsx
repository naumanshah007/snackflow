"use client";

import { Banknote, ClipboardList, LocateFixed, LogOut, MapPin, Plus, Save, Search, ShoppingCart, Store, Trash2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { apiFetch, clearToken, getToken, login, money } from "@/lib/api";
import type { AnyRow } from "@/lib/types";

type Tab = "shops" | "order" | "payment" | "visit";
type MobileLine = { sku_id: string; quantity_packets: string; sale_rate: string; hint?: string };

const blankLine: MobileLine = { sku_id: "", quantity_packets: "1", sale_rate: "" };

export default function MobilePage() {
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("booker1");
  const [password, setPassword] = useState("booker123");
  const [tab, setTab] = useState<Tab>("shops");
  const [shops, setShops] = useState<AnyRow[]>([]);
  const [skus, setSkus] = useState<AnyRow[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<MobileLine[]>([{ ...blankLine }]);
  const [payment, setPayment] = useState("0");
  const [paymentOnly, setPaymentOnly] = useState("");
  const [visitStatus, setVisitStatus] = useState("SHOP_CLOSED");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

  const skuMap = useMemo(() => new Map(skus.map((sku) => [String(sku.id), sku])), [skus]);
  const selectedShop = shops.find((shop) => String(shop.id) === selectedShopId);
  const filteredShops = shops.filter((shop) => `${shop.name} ${shop.area_route || ""} ${shop.phone || ""}`.toLowerCase().includes(search.toLowerCase()));

  const load = async () => {
    const [shopData, skuData] = await Promise.all([apiFetch<AnyRow[]>("/shops"), apiFetch<AnyRow[]>("/skus")]);
    setShops(shopData);
    setSkus(skuData);
    if (!selectedShopId && shopData[0]) setSelectedShopId(String(shopData[0].id));
  };

  useEffect(() => {
    if (getToken()) {
      setAuthed(true);
      load().catch((error) => setMessage(error.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const captureGps = async () => {
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
        if (selectedShop) {
          await apiFetch(`/shops/${selectedShop.id}`, {
            method: "PUT",
            body: { gps_latitude: lat, gps_longitude: lng }
          });
          setMessage("GPS saved");
          await load();
        }
      },
      () => setMessage("Could not capture GPS"),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const updateLine = async (index: number, patch: Partial<MobileLine>) => {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
    if (patch.sku_id && selectedShopId) {
      try {
        const context = await apiFetch<AnyRow>(`/rates/shop/${selectedShopId}/sku/${patch.sku_id}`);
        const rate = context.fixed_sale_rate ?? context.last_sale_rate ?? context.default_sale_rate;
        setLines((current) =>
          current.map((line, lineIndex) =>
            lineIndex === index
              ? {
                  ...line,
                  sale_rate: String(rate || skuMap.get(patch.sku_id || "")?.default_sale_rate || ""),
                  hint: `${context.fixed_sale_rate ? "Fixed" : context.last_sale_rate ? "Last" : "Default"} ${money(rate)}`
                }
              : line
          )
        );
      } catch {
        const sku = skuMap.get(patch.sku_id);
        if (sku) setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, sale_rate: String(sku.default_sale_rate || "") } : line)));
      }
    }
  };

  const orderTotal = lines.reduce((sum, line) => sum + Number(line.quantity_packets || 0) * Number(line.sale_rate || 0), 0);

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
            quantity_packets: Number(line.quantity_packets),
            sale_rate: Number(line.sale_rate)
          })),
          notes: notes || null
        }
      });
      await apiFetch(`/sales/${sale.id}/confirm`, { method: "POST" });
      await apiFetch("/shop-visits", {
        method: "POST",
        body: {
          shop_id: selectedShop.id,
          status: "ORDER_TAKEN",
          gps_latitude: gps?.lat ?? null,
          gps_longitude: gps?.lng ?? null,
          notes
        }
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
      setMessage("Payment saved");
      setPaymentOnly("");
      setNotes("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment failed");
    }
  };

  const saveVisit = async () => {
    if (!selectedShop) return;
    setMessage("");
    try {
      await apiFetch("/shop-visits", {
        method: "POST",
        body: {
          shop_id: selectedShop.id,
          status: visitStatus,
          gps_latitude: gps?.lat ?? null,
          gps_longitude: gps?.lng ?? null,
          notes
        }
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
            <div className="text-xs font-semibold uppercase text-orange-200">Mobile route mode</div>
            <div className="mt-2 text-2xl font-bold">Fast orders, payments, and GPS visits.</div>
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
        {selectedShop && (
          <div className="mt-3 rounded-lg bg-slate-950 p-4 text-white shadow-lift">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-orange-200">Selected shop</div>
                <div className="mt-1 text-lg font-bold leading-tight">{selectedShop.name}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-300">Balance</div>
                <div className="font-bold text-green-200">{money(selectedShop.current_balance)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-300">
              <span className="truncate">{selectedShop.area_route || selectedShop.phone || "No route assigned"}</span>
              {selectedShop.gps_latitude && selectedShop.gps_longitude ? <span className="rounded bg-green-500/15 px-2 py-1 text-green-100">GPS saved</span> : <span className="rounded bg-orange-500/15 px-2 py-1 text-orange-100">GPS needed</span>}
            </div>
          </div>
        )}
        {message && <div className="mt-3 rounded-md border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-orange-800">{message}</div>}
      </header>

      <section className="mx-auto max-w-3xl px-4 py-4">
        {tab === "shops" && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/95 px-3 py-3 shadow-premium backdrop-blur">
              <Search size={18} className="text-slate-500" />
              <input className="w-full bg-transparent text-base outline-none placeholder:text-slate-400" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shops" />
            </label>
            {filteredShops.map((shop) => (
              <div key={shop.id} className={`w-full rounded-lg border p-4 shadow-premium transition ${String(shop.id) === selectedShopId ? "border-orange-300 bg-orange-50/95" : "border-white/80 bg-white/95"}`}>
                <button onClick={() => setSelectedShopId(String(shop.id))} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{shop.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{shop.owner_name || shop.phone || shop.area_route}</div>
                    </div>
                    <div className="rounded-md bg-slate-950 px-3 py-2 text-right text-sm font-semibold text-white">{money(shop.current_balance)}</div>
                  </div>
                </button>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setTab("order")} className="rounded-md bg-orange-600 px-3 py-3 text-sm font-semibold text-white shadow-lift">
                    Order
                  </button>
                  <button type="button" onClick={() => setTab("payment")} className="rounded-md bg-green-600 px-3 py-3 text-sm font-semibold text-white shadow-lift">
                    Pay
                  </button>
                  {shop.gps_latitude && shop.gps_longitude ? (
                    <a href={`https://www.google.com/maps?q=${shop.gps_latitude},${shop.gps_longitude}`} target="_blank" className="rounded-md border border-slate-200 bg-white px-3 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm">
                      Map
                    </a>
                  ) : (
                    <button type="button" onClick={captureGps} className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm">
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
            {lines.map((line, index) => (
              <div key={index} className="rounded-lg border border-white/80 bg-white/95 p-3 shadow-premium backdrop-blur">
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded bg-slate-100 px-2 py-1 text-sm font-semibold text-slate-800">Item {index + 1}</span>
                  <button type="button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="rounded-md border border-slate-200 bg-white p-2 text-slate-500 shadow-sm">
                    <Trash2 size={18} />
                  </button>
                </div>
                <select className="field-lg" value={line.sku_id} onChange={(event) => updateLine(index, { sku_id: event.target.value })} required>
                  <option value="">Select SKU</option>
                  {skus.map((sku) => (
                    <option key={sku.id} value={sku.id}>
                      {sku.display_name}
                    </option>
                  ))}
                </select>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input className="field-lg" type="number" min="1" value={line.quantity_packets} onChange={(event) => updateLine(index, { quantity_packets: event.target.value })} />
                  <input className="field-lg" type="number" min="0" step="0.01" value={line.sale_rate} onChange={(event) => updateLine(index, { sale_rate: event.target.value })} />
                </div>
                <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">{line.hint || "Rate will load after SKU selection"}</div>
              </div>
            ))}
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
          <form onSubmit={savePayment} className="space-y-3 rounded-lg border border-white/80 bg-white/95 p-4 shadow-premium backdrop-blur">
            <div className="eyebrow">Payment collection</div>
            <input className="field-lg text-lg" type="number" min="1" value={paymentOnly} onChange={(event) => setPaymentOnly(event.target.value)} placeholder="Payment amount" required />
            <textarea className="field-lg min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" />
            <button className="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-4 font-semibold text-white shadow-lift">
              <Banknote size={20} /> Save payment
            </button>
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
            <button onClick={captureGps} className="btn-soft w-full py-3">
              <LocateFixed size={20} /> Capture GPS
            </button>
            <button onClick={saveVisit} className="btn-dark w-full py-4">
              <ClipboardList size={20} /> Save visit
            </button>
          </div>
        )}
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-3xl grid-cols-4 border-t border-white/80 bg-white/95 p-2 shadow-premium backdrop-blur">
        {([
          ["shops", Store, "Shops"],
          ["order", ShoppingCart, "Order"],
          ["payment", Banknote, "Pay"],
          ["visit", MapPin, "Visit"]
        ] as const).map(([value, Icon, label]) => {
          const TypedIcon = Icon as typeof Store;
          return (
            <button key={String(value)} onClick={() => setTab(value as Tab)} className={`flex flex-col items-center gap-1 rounded-md py-2 text-xs font-semibold transition ${tab === value ? "bg-slate-950 text-white shadow-lift" : "text-slate-500 hover:bg-slate-50"}`}>
              <TypedIcon size={20} />
              {label as string}
            </button>
          );
        })}
      </nav>
    </main>
  );
}
