"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="w-72 rounded-lg bg-white p-4 shadow-premium">
            <Image src="/logo.png" alt="SnackFlow" width={420} height={140} className="h-auto w-full object-contain" priority />
          </div>
          <div className="max-w-2xl">
            <div className="eyebrow text-orange-200">Premium distribution workspace</div>
            <h1 className="mt-3 text-6xl font-bold leading-tight">SnackFlow</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-200">Smart stock, route sales, shop ledgers, cash recovery, and profit clarity for growing snack distribution teams.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm text-slate-200">
            <div className="rounded-lg border border-white/15 bg-white/10 p-4 shadow-lift">Warehouse inventory</div>
            <div className="rounded-lg border border-white/15 bg-white/10 p-4 shadow-lift">GPS shop routes</div>
            <div className="rounded-lg border border-white/15 bg-white/10 p-4 shadow-lift">Ledger-safe reversals</div>
          </div>
        </div>
      </section>

      <section className="app-bg flex items-center justify-center px-4 py-10">
        <form onSubmit={handleSubmit(submit)} className="w-full max-w-md rounded-lg border border-white/80 bg-white/95 p-6 shadow-premium backdrop-blur">
          <div className="mb-6">
            <div className="w-52">
              <Image src="/logo.png" alt="SnackFlow" width={420} height={140} className="h-auto w-full object-contain" priority />
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
