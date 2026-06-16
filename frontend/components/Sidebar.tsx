"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
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
  Users,
  Warehouse
} from "lucide-react";

import { Logo } from "@/components/Logo";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/distribution", label: "Distribution Control", icon: LayoutGrid },
  { href: "/products", label: "Products", icon: Package },
  { href: "/skus", label: "SKUs & Rates", icon: Tags },
  { href: "/rates", label: "Shop Rates", icon: Tags },
  { href: "/warehouses", label: "Warehouses", icon: Warehouse },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/stock/receive", label: "Stock Receive", icon: ClipboardList },
  { href: "/stock/ledger", label: "Stock Ledger", icon: BarChart3 },
  { href: "/shops", label: "Shops & GPS", icon: Store },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/users", label: "Users", icon: Users },
  { href: "/mobile", label: "Mobile", icon: MapPin },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-72 overflow-y-auto border-r border-white/10 bg-slate-950 px-4 py-5 text-white shadow-premium lg:block">
      <div className="rounded-lg border border-white/10 bg-white p-3 shadow-lift">
        <Logo />
      </div>
      <div className="mt-3 px-1 text-[11px] leading-snug text-slate-400">
        SnackFlow — Distribution Management System for <span className="font-semibold text-slate-200">Zaib Brothers</span>
      </div>
      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.06] p-3">
        <div className="text-xs font-semibold uppercase text-slate-400">Distribution control</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <Link href="/inventory" className="rounded-md bg-orange-500/15 px-2 py-2 text-center font-semibold text-orange-100 transition hover:bg-orange-500/25">
            Stock
          </Link>
          <Link href="/stock/ledger" className="rounded-md bg-green-500/15 px-2 py-2 text-center font-semibold text-green-100 transition hover:bg-green-500/25">
            Ledger
          </Link>
        </div>
      </div>
      <nav className="mt-5 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-white text-slate-950 shadow-lift" : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-md ${active ? "bg-orange-600 text-white" : "bg-white/10 text-slate-300"}`}>
                <Icon size={17} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
