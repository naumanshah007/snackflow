"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, Menu, Search, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Sidebar, navGroups } from "@/components/Sidebar";
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

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const logout = () => {
    clearToken();
    router.replace("/login");
  };

  return (
    <div className="app-bg min-h-screen">
      <Sidebar />
      <header className="no-print sticky top-0 z-20 border-b border-white/70 bg-white/75 backdrop-blur-xl lg:ml-72">
        <div className="flex min-h-[4.5rem] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button className="focus-ring rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden" onClick={() => setMenuOpen((value) => !value)} aria-label="Open navigation">
              <Menu size={22} />
            </button>
            <div className="hidden sm:block lg:hidden">
              <Logo compact />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <span className="hidden sm:inline">SnackFlow</span>
                <span className="hidden text-slate-300 sm:inline">·</span>
                Zaib Brothers <ChevronRight size={13} className="text-slate-300" /> {pathname.split("/").filter(Boolean)[0] || "home"}
              </div>
              <div className="mt-0.5 text-xl font-bold text-slate-950">{title}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-500 shadow-sm md:flex">
              <Search size={16} />
              <span className="max-w-48 truncate">{pathname}</span>
            </div>
            <Link href="/mobile" className="focus-ring rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition hover:bg-slate-50" aria-label="Open mobile view">
              <Smartphone size={18} />
            </Link>
            <div className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm shadow-sm sm:block">
              <div className="font-semibold text-slate-900">{user?.name || "Loading"}</div>
              <div className="text-xs text-slate-500">{user?.role || ""}</div>
            </div>
            <button onClick={logout} className="focus-ring rounded-lg bg-slate-950 p-2.5 text-white shadow-lift transition hover:bg-slate-800" aria-label="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <nav
            className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col overflow-y-auto bg-slate-950 px-4 py-5 text-white shadow-premium"
            style={{ animation: "rise-in 0.25s ease both" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-white p-2.5">
                <Logo />
              </div>
              <button onClick={() => setMenuOpen(false)} className="rounded-lg border border-white/15 p-2 text-slate-300" aria-label="Close menu">
                <X size={20} />
              </button>
            </div>
            <div className="mt-5 space-y-5">
              {navGroups.map((group, groupIndex) => (
                <div key={group.title ?? `m-${groupIndex}`}>
                  {group.title && <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{group.title}</div>}
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10"}`}
                        >
                          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-orange-600 text-white" : "bg-white/10"}`}>
                            <Icon size={16} />
                          </span>
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>
        </div>
      )}

      <main className="lg:ml-72">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
