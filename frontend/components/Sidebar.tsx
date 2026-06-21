"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileBarChart,
  Home,
  LayoutGrid,
  MapPin,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Undo2,
  Users,
  Warehouse
} from "lucide-react";

import { Logo } from "@/components/Logo";

export type NavItem = { href: string; label: string; icon: typeof Home };

export const navGroups: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: Home }]
  },
  {
    title: "Distribution Control",
    items: [
      { href: "/distribution", label: "Control Center", icon: LayoutGrid },
      { href: "/inventory", label: "Inventory", icon: Boxes },
      { href: "/stock/receive", label: "Stock Receive", icon: ClipboardList },
      { href: "/stock/returns", label: "Return to Supplier", icon: Undo2 },
      { href: "/stock/ledger", label: "Stock Ledger", icon: BarChart3 }
    ]
  },
  {
    title: "Catalog",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/skus", label: "SKUs & Rates", icon: Tags },
      { href: "/rates", label: "Shop Rates", icon: Tags },
      { href: "/warehouses", label: "Warehouses", icon: Warehouse }
    ]
  },
  {
    title: "Sales & Shops",
    items: [
      { href: "/shops", label: "Shops & GPS", icon: Store },
      { href: "/sales", label: "Sales", icon: ShoppingCart }
    ]
  },
  {
    title: "Finance",
    items: [
      { href: "/payments", label: "Payments", icon: CreditCard },
      { href: "/expenses", label: "Expenses", icon: Receipt }
    ]
  },
  {
    title: "Reports",
    items: [
      { href: "/reports", label: "Reports", icon: FileBarChart },
      { href: "/monthly-closing", label: "Monthly Closing", icon: CalendarCheck }
    ]
  },
  {
    title: "System",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/mobile", label: "Order Booker", icon: MapPin },
      { href: "/settings", label: "Settings", icon: Settings }
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-72 flex-col overflow-y-auto border-r border-white/10 bg-slate-950 px-4 py-5 text-white shadow-premium lg:flex">
      <div className="rounded-xl border border-white/10 bg-white p-3 shadow-lift">
        <Logo />
      </div>
      <div className="mt-3 px-1 text-[11px] leading-snug text-slate-400">
        Distribution Management System for <span className="font-semibold text-slate-200">Zaib Brothers</span>
      </div>

      <nav className="mt-5 space-y-5 pb-4">
        {navGroups.map((group, groupIndex) => (
          <div key={group.title ?? `group-${groupIndex}`}>
            {group.title && <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{group.title}</div>}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      active ? "bg-white text-slate-950 shadow-lift" : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                        active ? "bg-orange-600 text-white" : "bg-white/10 text-slate-300 group-hover:bg-white/20"
                      }`}
                    >
                      <Icon size={16} />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.06] p-3 text-xs text-slate-400">
        <div className="flex items-center gap-2 font-semibold text-slate-200">
          <span className="relative flex h-2 w-2">
            <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Carton-first mode
        </div>
        <p className="mt-1.5 leading-snug">Stock shown in cartons + loose packets.</p>
      </div>
    </aside>
  );
}
