import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon = Inbox, title, hint }: { icon?: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-4 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={22} />
      </span>
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {hint && <div className="max-w-xs text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
