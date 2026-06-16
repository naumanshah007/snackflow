import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  tone = "slate",
  icon: Icon,
  caption,
  loading = false,
  pulse = false
}: {
  label: string;
  value: string | number;
  tone?: "orange" | "green" | "navy" | "amber" | "slate";
  icon?: LucideIcon;
  caption?: string;
  loading?: boolean;
  pulse?: boolean;
}) {
  const tones = {
    orange: "border-orange-100 bg-gradient-to-br from-orange-50 to-white text-orange-900",
    green: "border-green-100 bg-gradient-to-br from-green-50 to-white text-green-900",
    navy: "border-slate-900 bg-gradient-to-br from-slate-950 to-slate-800 text-white",
    amber: "border-amber-100 bg-gradient-to-br from-amber-50 to-white text-amber-900",
    slate: "border-white/80 bg-white/90 text-slate-950"
  };
  const iconTones = {
    orange: "bg-orange-600 text-white",
    green: "bg-green-600 text-white",
    navy: "bg-white/15 text-white",
    amber: "bg-amber-500 text-white",
    slate: "bg-slate-100 text-slate-700"
  };
  const labelTone = tone === "navy" ? "text-slate-300" : "text-slate-500";

  return (
    <div className={`rounded-xl border p-4 shadow-premium transition duration-200 hover:-translate-y-1 hover:shadow-lift ${tones[tone]} ${pulse ? "warn-pulse" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-xs font-semibold uppercase tracking-wide ${labelTone}`}>{label}</div>
          {loading ? (
            <div className="mt-3 h-7 w-24 rounded-md skeleton" />
          ) : (
            <div className="mt-3 text-2xl font-bold leading-none sm:text-3xl">{value}</div>
          )}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconTones[tone]}`}>
          {Icon ? <Icon size={18} /> : <ArrowUpRight size={18} />}
        </div>
      </div>
      {caption && <div className={`mt-3 text-xs ${tone === "navy" ? "text-slate-300" : "text-slate-500"}`}>{caption}</div>}
    </div>
  );
}
