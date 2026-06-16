"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Boxes, MapPin, RotateCcw, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AnimatedLogoHero } from "@/components/AnimatedLogoHero";
import { login } from "@/lib/api";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { username: "admin", password: "admin123" }
  });

  const submit = async (values: LoginForm) => {
    setError("");
    try {
      await login(values.username, values.password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.52fr)]">
      <section className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#0f172a_0%,#1f2937_48%,#14532d_100%)]" />
        <div className="blob left-10 top-16 h-72 w-72 bg-orange-500/25" />
        <div className="blob bottom-10 right-10 h-72 w-72 bg-emerald-500/25" style={{ animationDelay: "-8s" }} />
        <div className="relative flex h-full flex-col p-10 text-white xl:p-12">
          <div className="flex items-center justify-between gap-4">
            <div className="w-52 rounded-xl bg-white p-3 shadow-premium">
              <Image src="/logo.png" alt="Zaib Brothers" width={420} height={140} className="h-auto w-full object-contain" priority />
            </div>
            <span className="chip border-white/15 bg-white/10 text-emerald-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Live distribution
            </span>
          </div>

          <div className="mt-7">
            <div className="eyebrow text-orange-200">SnackFlow · Distribution Management System</div>
            <h1 className="mt-2 text-4xl font-bold leading-tight xl:text-5xl">Zaib Brothers</h1>
            <p className="mt-3 max-w-md text-base leading-7 text-slate-300">Carton-first stock, route sales, shop ledgers, cash recovery, and profit clarity.</p>
          </div>

          {/* live, mouse-interactive logo-centric visual */}
          <div className="mt-2 flex flex-1 items-center justify-center">
            <AnimatedLogoHero interactive />
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-200">
            <span className="chip border-white/15 bg-white/10"><Boxes size={13} className="text-orange-300" /> Carton-first</span>
            <span className="chip border-white/15 bg-white/10"><MapPin size={13} className="text-emerald-300" /> GPS shop routes</span>
            <span className="chip border-white/15 bg-white/10"><RotateCcw size={13} className="text-sky-300" /> Ledger-safe reversals</span>
            <span className="chip border-white/15 bg-white/10"><ShieldCheck size={13} className="text-amber-300" /> Two warehouses</span>
          </div>
        </div>
      </section>

      <section className="app-bg flex items-center justify-center px-4 py-10">
        <form onSubmit={handleSubmit(submit)} className="w-full max-w-md rounded-lg border border-white/80 bg-white/95 p-6 shadow-premium backdrop-blur">
          <div className="mb-6">
            <div className="w-52">
              <Image src="/logo.png" alt="Zaib Brothers" width={420} height={140} className="h-auto w-full object-contain" priority />
            </div>
            <div className="mt-6 inline-flex rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase text-orange-700">Secure access</div>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">Sign in</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use admin/admin123 after running the seed script.</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Username</span>
            <input className="field-lg" {...register("username")} />
            {errors.username && <span className="text-xs text-red-600">{errors.username.message}</span>}
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
            <input type="password" className="field-lg" {...register("password")} />
            {errors.password && <span className="text-xs text-red-600">{errors.password.message}</span>}
          </label>
          {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <button disabled={isSubmitting} className="btn-primary mt-6 w-full py-3 disabled:opacity-70">
            Sign in <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}
