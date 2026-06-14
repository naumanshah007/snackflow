"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, Menu, Search, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { Sidebar } from "@/components/Sidebar";
import { Logo } from "@/components/Logo";
import { apiFetch, clearToken, getToken } from "@/lib/api";

type User = {
  id: number;
  name: string;
  role: string;
  username: string;
};

export function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<User>("/auth/me")
      .then(setUser)
      .catch(() => router.replace("/login"));
  }, [router]);

  const logout = () => {
    clearToken();
    router.replace("/login");
  };

  const mobileLinks = [
    ["/dashboard", "Dashboard"],
    ["/inventory", "Inventory"],
    ["/shops", "Shops"],
    ["/sales", "Sales"],
    ["/reports", "Reports"],
    ["/mobile", "Mobile"]
  ];

  return (
    <div className="app-bg min-h-screen">
      <Sidebar />
      <header className="no-print sticky top-0 z-20 border-b border-white/80 bg-white/80 backdrop-blur-xl lg:ml-72">
        <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button className="focus-ring rounded-md border border-slate-200 bg-white p-2 text-slate-700 shadow-sm lg:hidden" onClick={() => setMenuOpen((value) => !value)} aria-label="Open navigation">
              <Menu size={22} />
            </button>
            <div className="hidden sm:block lg:hidden">
              <Logo compact />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                SnackFlow <ChevronRight size={14} /> {pathname.split("/").filter(Boolean)[0] || "home"}
              </div>
              <div className="mt-1 text-xl font-bold text-slate-950">{title}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-500 shadow-sm md:flex">
              <Search size={16} />
              <span className="max-w-48 truncate">{pathname}</span>
            </div>
            <Link href="/mobile" className="focus-ring rounded-md border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm hover:bg-slate-50" aria-label="Open mobile view">
              <Smartphone size={18} />
            </Link>
            <div className="hidden rounded-md border border-slate-200 bg-white px-3 py-2 text-right text-sm shadow-sm sm:block">
              <div className="font-medium text-slate-900">{user?.name || "Loading"}</div>
              <div className="text-xs text-slate-500">{user?.role || ""}</div>
            </div>
            <button onClick={logout} className="focus-ring rounded-md bg-slate-950 p-2.5 text-white shadow-lift hover:bg-slate-800" aria-label="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="grid grid-cols-2 gap-2 border-t border-slate-200/80 bg-white/95 p-3 lg:hidden">
            {mobileLinks.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700" onClick={() => setMenuOpen(false)}>
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="lg:ml-72">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
