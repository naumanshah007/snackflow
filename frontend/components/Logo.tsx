import Image from "next/image";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white shadow-panel">
        <Image src="/logo.png" alt="SnackFlow" width={120} height={40} className="h-8 w-24 max-w-none object-contain" priority />
      </div>
      {!compact && (
        <div>
          <div className="text-base font-bold text-slate-950">SnackFlow</div>
          <div className="text-xs text-slate-500">Smart Stock, Sales & Shop Ledger</div>
        </div>
      )}
    </div>
  );
}
