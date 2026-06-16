import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Banknote,
  Boxes,
  ClipboardList,
  FileText,
  Gauge,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Truck,
  Warehouse
} from "lucide-react";

import { AnimatedDistributionHero } from "@/components/AnimatedDistributionHero";

const features = [
  { icon: Boxes, title: "Carton-first everywhere", desc: "Enter, view, sell and report in cartons + loose packets. Packets are kept internally for accuracy." },
  { icon: Warehouse, title: "Two warehouses, never mixed", desc: "Warehouse 1 and Warehouse 2 stock stay separate, with scoped order bookers and routes." },
  { icon: MapPin, title: "GPS shop routes", desc: "Capture shop locations, track field visits, and open any shop on the map in one tap." },
  { icon: Banknote, title: "Payment recovery", desc: "Collect against pending balances with automatic date/time, instant ledger and balance updates." },
  { icon: RotateCcw, title: "Ledger-safe reversals", desc: "Reverse a sale or take partial returns — stock and balances correct themselves, history stays intact." },
  { icon: BarChart3, title: "Profit & reports", desc: "Daily sales, item movement, pending bills, expenses and profit — with carton-friendly CSV exports." }
];

const steps = [
  { icon: ClipboardList, title: "Receive cartons", desc: "Log stock by cartons with date and cost; balances update live." },
  { icon: Truck, title: "Book & deliver", desc: "Order bookers sell in cartons on their route, stock deducts on delivery." },
  { icon: Banknote, title: "Collect cash", desc: "Record payments against shop pending balance with a timestamp." },
  { icon: Gauge, title: "See the numbers", desc: "Dashboard and reports show sales, recovery, stock and profit." }
];

export function LandingView() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* ambient gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_70%_-10%,rgba(249,115,22,0.20),transparent),radial-gradient(900px_500px_at_10%_20%,rgba(22,163,74,0.16),transparent),linear-gradient(180deg,#0b1220_0%,#0f172a_60%,#0b1220_100%)]" />
        <div className="blob left-[8%] top-24 h-72 w-72 bg-orange-500/30" />
        <div className="blob right-[6%] top-10 h-72 w-72 bg-emerald-500/25" style={{ animationDelay: "-7s" }} />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lift">
            <Image src="/logo.png" alt="Zaib Brothers" width={120} height={40} className="h-8 w-24 max-w-none object-contain" priority />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold">SnackFlow</div>
            <div className="text-[11px] text-slate-400">Zaib Brothers</div>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="hidden rounded-md px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:text-white sm:inline-flex">
            Sign in
          </Link>
          <Link href="/dashboard" className="btn-primary">
            Open Dashboard <ArrowRight size={16} />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-5 pb-10 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8 lg:pb-20 lg:pt-10">
        <div className="reveal">
          <div className="chip border-white/15 bg-white/10 text-orange-200">
            <ShieldCheck size={14} /> Distribution Management System
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            SnackFlow for <span className="bg-gradient-to-r from-orange-400 to-emerald-400 bg-clip-text text-transparent">Zaib Brothers</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
            Carton-first stock, sales, shop ledger, payment collection, and warehouse control for snack distribution teams.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="btn-primary px-5 py-3 text-base">
              Open Dashboard <ArrowRight size={18} />
            </Link>
            <Link href="/mobile" className="btn-ghost px-5 py-3 text-base">
              <Smartphone size={18} /> Order Booker Mobile
            </Link>
            <a href="/docs/SnackFlow_User_Handover_Manual.pdf" target="_blank" rel="noopener noreferrer" className="btn-ghost px-5 py-3 text-base">
              <FileText size={18} /> View Manual
            </a>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
            <span className="inline-flex items-center gap-2"><Boxes size={16} className="text-orange-300" /> Carton-first</span>
            <span className="inline-flex items-center gap-2"><Warehouse size={16} className="text-sky-300" /> 2 warehouses</span>
            <span className="inline-flex items-center gap-2"><MapPin size={16} className="text-emerald-300" /> GPS routes</span>
            <span className="inline-flex items-center gap-2"><RotateCcw size={16} className="text-amber-300" /> Safe reversals</span>
          </div>
        </div>

        <div className="reveal reveal-2 glass-dark p-4 sm:p-6">
          <AnimatedDistributionHero interactive />
        </div>
      </section>

      {/* Light content area */}
      <div className="relative z-10 rounded-t-[2.5rem] bg-slate-50 text-slate-900">
        {/* Features */}
        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="max-w-2xl">
            <div className="eyebrow text-orange-600">Built for the route</div>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Everything a snack distributor runs on</h2>
            <p className="mt-3 text-slate-600">From warehouse intake to shop recovery, in the language your team already uses — cartons.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className={`reveal reveal-${Math.min(index + 1, 6)} group rounded-2xl border border-slate-200 bg-white p-6 shadow-panel transition hover:-translate-y-1 hover:shadow-premium`}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-emerald-100 text-orange-700 transition group-hover:scale-105">
                    <Icon size={22} />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-slate-950">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Workflow */}
        <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-premium">
            <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="bg-white p-7">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
                        <Icon size={18} />
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Step {index + 1}</span>
                    </div>
                    <h3 className="mt-4 font-bold text-slate-950">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Manual + roles */}
        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <a
              href="/docs/SnackFlow_User_Handover_Manual.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col justify-between gap-6 rounded-3xl bg-slate-950 p-8 text-white shadow-premium transition hover:-translate-y-1"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="chip border-white/15 bg-white/10 text-orange-200"><FileText size={14} /> PDF</div>
                  <h3 className="mt-4 text-2xl font-bold">Client Handover Manual</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                    Step-by-step guide for admin, warehouse manager, order booker, and accountant.
                  </p>
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white transition group-hover:scale-105">
                  <ArrowRight size={22} />
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {["Setup", "Stock receive", "Carton sales", "Payments", "Reversals", "Reports"].map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">{tag}</span>
                ))}
              </div>
            </a>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-panel">
              <h3 className="text-xl font-bold text-slate-950">Made for every role</h3>
              <ul className="mt-5 space-y-4 text-sm">
                {[
                  ["Admin / Owner", "Full control of stock, prices, users and reports."],
                  ["Warehouse Manager", "Receive cartons and manage warehouse balances."],
                  ["Order Booker", "Mobile route: orders, payments, new shops, GPS."],
                  ["Accountant", "Ledgers, payments, expenses and profit clarity."]
                ].map(([role, desc]) => (
                  <li key={role} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">✓</span>
                    <span>
                      <span className="font-semibold text-slate-900">{role}</span>
                      <span className="text-slate-600"> — {desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 via-orange-500 to-emerald-600 p-10 text-white shadow-premium sm:p-14">
            <div className="blob right-10 top-0 h-48 w-48 bg-white/30" />
            <div className="relative">
              <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">Run the whole distribution from one screen.</h2>
              <p className="mt-3 max-w-xl text-white/90">SnackFlow — Distribution Management System for Zaib Brothers.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-lift transition hover:bg-slate-100">
                  Open Dashboard <ArrowRight size={18} />
                </Link>
                <Link href="/mobile" className="inline-flex items-center gap-2 rounded-md border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                  <Smartphone size={18} /> Order Booker Mobile
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                <Image src="/logo.png" alt="Zaib Brothers" width={120} height={40} className="h-6 w-20 max-w-none object-contain" />
              </span>
              <span>SnackFlow — Distribution Management System for <span className="font-semibold text-slate-700">Zaib Brothers</span></span>
            </div>
            <div className="flex items-center gap-5">
              <Link href="/login" className="hover:text-slate-900">Sign in</Link>
              <a href="/docs/SnackFlow_User_Handover_Manual.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900">Manual</a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
