import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  tone = "slate",
  icon: Icon,
  caption
}: {
  label: string;
  value: string | number;
  tone?: "orange" | "green" | "navy" | "slate";
  icon?: LucideIcon;
  caption?: string;
}) {
  const tones = {
    orange: "border-orange-100 bg-orange-50/90 text-orange-800",
    green: "border-green-100 bg-green-50/90 text-green-800",
    navy: "border-slate-900 bg-slate-950 text-white",
    slate: "border-white/80 bg-white/90 text-slate-950"
  };
  const iconTones = {
    orange: "bg-orange-600 text-white",
    green: "bg-green-600 text-white",
    navy: "bg-white/12 text-white",
    slate: "bg-slate-100 text-slate-700"
  };
  return (
    <div className={`rounded-lg border p-4 shadow-premium transition hover:-translate-y-0.5 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-xs font-semibold uppercase ${tone === "navy" ? "text-slate-300" : "text-slate-500"}`}>{label}</div>
          <div className="mt-3 text-2xl font-bold leading-none sm:text-3xl">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${iconTones[tone]}`}>
          {Icon ? <Icon size={18} /> : <ArrowUpRight size={18} />}
        </div>
      </div>
      {caption && <div className={`mt-3 text-xs ${tone === "navy" ? "text-slate-300" : "text-slate-500"}`}>{caption}</div>}
    </div>
  );
}
