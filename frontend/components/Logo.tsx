import Image from "next/image";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-panel ring-1 ring-slate-200/70">
        <Image src="/logo.png" alt="Zaib Brothers" width={120} height={40} className="h-8 w-24 max-w-none object-contain" priority />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-base font-bold text-slate-950">SnackFlow</div>
          <div className="text-[11px] font-medium text-slate-500">Zaib Brothers · Distribution</div>
        </div>
      )}
    </div>
  );
}
