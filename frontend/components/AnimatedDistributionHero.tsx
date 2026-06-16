"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AnimatedDistributionHero
 * A live, lightweight SVG visualisation of the Zaib Brothers distribution
 * ecosystem: two warehouses + a ledger node on the left, shops on the right,
 * carton pills flowing out along route lines, and payment dots flowing back.
 *
 * Motion is CSS (route dashes, floats, pulses) + SMIL animateMotion (pills).
 * Respects prefers-reduced-motion: the flowing pills/dots are not rendered and
 * CSS motion is frozen by the global reduced-motion rule.
 */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

// Carton-out routes: warehouse right edge -> shop left edge.
const cartonRoutes = [
  { id: "r1", d: "M174,100 C 270,78 320,92 402,95", dur: "5.5s", delay: "0s" },
  { id: "r2", d: "M174,128 C 286,150 330,218 402,221", dur: "6.4s", delay: "1.1s" },
  { id: "r3", d: "M174,234 C 286,236 330,240 402,241", dur: "5s", delay: "0.6s" },
  { id: "r4", d: "M174,250 C 300,300 330,360 402,367", dur: "6.8s", delay: "1.6s" }
];

// Payment-back routes: shop left edge -> ledger node right edge.
const paymentRoutes = [
  { id: "p1", d: "M402,110 C 320,200 280,338 174,340", dur: "6s", delay: "0.4s" },
  { id: "p2", d: "M402,352 C 320,360 250,360 174,360", dur: "5.4s", delay: "2s" }
];

export function AnimatedDistributionHero({ className = "", interactive = false }: { className?: string; interactive?: boolean }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || reduced) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = ((event.clientX - rect.left) / rect.width - 0.5) * 2; // -1 .. 1
    const my = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    el.style.setProperty("--mx", mx.toFixed(3));
    el.style.setProperty("--my", my.toFixed(3));
  };

  const resetMove = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", "0");
    el.style.setProperty("--my", "0");
  };

  const layer = (factor: number) => ({
    transform: `translate3d(calc(var(--mx,0) * ${factor}px), calc(var(--my,0) * ${factor}px), 0)`,
    transition: "transform 0.35s cubic-bezier(0.22,1,0.36,1)",
    willChange: "transform"
  });

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      aria-hidden="true"
      onMouseMove={handleMove}
      onMouseLeave={resetMove}
      style={{ "--mx": 0, "--my": 0 } as React.CSSProperties}
    >
      {/* soft gradient glow blobs behind the diagram (deepest parallax layer) */}
      <div className="absolute inset-0" style={layer(26)}>
        <div className="blob -left-10 top-4 h-56 w-56 bg-orange-400/40" />
        <div className="blob right-0 bottom-2 h-56 w-56 bg-emerald-400/40" style={{ animationDelay: "-6s" }} />
        <div className="blob left-1/3 top-1/2 h-44 w-44 bg-sky-400/30" style={{ animationDelay: "-11s" }} />
      </div>

      <svg viewBox="0 0 560 440" className="relative w-full h-auto" role="img" style={layer(-9)}>
        <defs>
          <linearGradient id="gWarehouse" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="gOrange" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="gGreen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <linearGradient id="gRoute" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#0f172a" floodOpacity="0.18" />
          </filter>

          {[...cartonRoutes, ...paymentRoutes].map((r) => (
            <path key={r.id} id={r.id} d={r.d} fill="none" />
          ))}
        </defs>

        {/* Route lines (carton flow) */}
        {cartonRoutes.map((r) => (
          <use key={`line-${r.id}`} href={`#${r.id}`} stroke="url(#gRoute)" strokeWidth="2.5" strokeLinecap="round" className="route-dash" opacity="0.55" />
        ))}
        {/* Route lines (payment flow, dotted lighter) */}
        {paymentRoutes.map((r) => (
          <use key={`line-${r.id}`} href={`#${r.id}`} stroke="#16a34a" strokeWidth="2" strokeLinecap="round" className="route-dash route-dash-slow" opacity="0.35" />
        ))}

        {/* ---------- Left column: warehouses + ledger ---------- */}
        <WarehouseCard x={24} y={72} title="Warehouse 1" sub="Carton stock" accent="#f97316" floatClass="anim-float" />
        <WarehouseCard x={24} y={192} title="Warehouse 2" sub="Carton stock" accent="#38bdf8" floatClass="anim-float" delay="-2s" />
        <HubCard x={24} y={312} title="Ledger & Reports" sub="Cash · profit · stock" />

        {/* order booker chips */}
        <BookerChip cx={232} cy={120} label="OB 1" />
        <BookerChip cx={232} cy={300} label="OB 2" />

        {/* ---------- Right column: shops ---------- */}
        <ShopCard x={402} y={64} name="Kiryana A" floatClass="anim-bob" />
        <ShopCard x={402} y={200} name="Store B" floatClass="anim-bob" delay="-1.1s" />
        <ShopCard x={402} y={336} name="Mart C" floatClass="anim-bob" delay="-2.2s" />

        {/* ---------- Moving cartons + payment dots ---------- */}
        {!reduced &&
          cartonRoutes.map((r) => (
            <g key={`carton-${r.id}`}>
              <CartonPill />
              <animateMotion dur={r.dur} begin={r.delay} repeatCount="indefinite" rotate="0">
                <mpath href={`#${r.id}`} />
              </animateMotion>
            </g>
          ))}
        {!reduced &&
          paymentRoutes.map((r) => (
            <g key={`pay-${r.id}`}>
              <PaymentDot />
              <animateMotion dur={r.dur} begin={r.delay} repeatCount="indefinite" rotate="0">
                <mpath href={`#${r.id}`} />
              </animateMotion>
            </g>
          ))}
      </svg>
    </div>
  );
}

function WarehouseCard({ x, y, title, sub, accent, floatClass, delay = "0s" }: { x: number; y: number; title: string; sub: string; accent: string; floatClass?: string; delay?: string }) {
  return (
    <g className={floatClass} style={{ animationDelay: delay }} filter="url(#soft)">
      <rect x={x} y={y} width={150} height={84} rx={16} fill="url(#gWarehouse)" />
      <rect x={x} y={y} width={150} height={84} rx={16} fill="none" stroke="#ffffff" strokeOpacity="0.08" />
      {/* live stock pulse */}
      <g transform={`translate(${x + 130} ${y + 20})`}>
        <circle r="6" fill={accent} className="pulse-ring" opacity="0.5" />
        <circle r="4" fill={accent} />
      </g>
      <rect x={x + 16} y={y + 18} width={22} height={22} rx={5} fill={accent} opacity="0.95" />
      <rect x={x + 19} y={y + 24} width={16} height={2.4} rx={1} fill="#0f172a" opacity="0.5" />
      <text x={x + 48} y={y + 30} fill="#f8fafc" fontSize="13" fontWeight="700" fontFamily="inherit">{title}</text>
      <text x={x + 16} y={y + 58} fill="#94a3b8" fontSize="10.5" fontFamily="inherit">{sub}</text>
      <rect x={x + 16} y={y + 64} width={86} height={6} rx={3} fill="#1f2937" />
      <rect x={x + 16} y={y + 64} width={56} height={6} rx={3} fill={accent} />
    </g>
  );
}

function HubCard({ x, y, title, sub }: { x: number; y: number; title: string; sub: string }) {
  return (
    <g filter="url(#soft)">
      <rect x={x} y={y} width={150} height={80} rx={16} fill="#ffffff" />
      <rect x={x} y={y} width={150} height={80} rx={16} fill="none" stroke="#e2e8f0" />
      <circle cx={x + 27} cy={y + 30} r="13" fill="#ecfdf5" />
      <path d={`M${x + 21},${y + 31} l4,4 l8,-9`} fill="none" stroke="#16a34a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <text x={x + 48} y={y + 28} fill="#0f172a" fontSize="12.5" fontWeight="700" fontFamily="inherit">{title}</text>
      <text x={x + 48} y={y + 44} fill="#64748b" fontSize="10" fontFamily="inherit">{sub}</text>
      <g transform={`translate(${x + 16} ${y + 56})`}>
        <rect width={28} height={12} rx={3} fill="#fff7ed" />
        <rect x={34} width={28} height={12} rx={3} fill="#f0fdf4" />
        <rect x={68} width={28} height={12} rx={3} fill="#eff6ff" />
      </g>
    </g>
  );
}

function ShopCard({ x, y, name, floatClass, delay = "0s" }: { x: number; y: number; name: string; floatClass?: string; delay?: string }) {
  return (
    <g className={floatClass} style={{ animationDelay: delay }} filter="url(#soft)">
      <rect x={x} y={y} width={134} height={64} rx={14} fill="#ffffff" />
      <rect x={x} y={y} width={134} height={64} rx={14} fill="none" stroke="#e2e8f0" />
      {/* GPS pin */}
      <g transform={`translate(${x + 22} ${y + 32})`} className="anim-bob">
        <path d="M0,-12 C7,-12 11,-7 11,-1 C11,7 0,16 0,16 C0,16 -11,7 -11,-1 C-11,-7 -7,-12 0,-12 Z" fill="#f97316" />
        <circle cx="0" cy="-1" r="3.6" fill="#ffffff" />
      </g>
      <text x={x + 44} y={y + 28} fill="#0f172a" fontSize="12" fontWeight="700" fontFamily="inherit">{name}</text>
      <text x={x + 44} y={y + 44} fill="#64748b" fontSize="9.5" fontFamily="inherit">Pending · cartons</text>
      <circle cx={x + 120} cy={y + 16} r="4" fill="#16a34a" />
    </g>
  );
}

function BookerChip({ cx, cy, label }: { cx: number; cy: number; label: string }) {
  return (
    <g className="anim-float" style={{ animationDelay: "-1s" }}>
      <rect x={cx - 26} y={cy - 13} width={52} height={26} rx={13} fill="#0f172a" filter="url(#soft)" />
      <circle cx={cx - 13} cy={cy} r="7" fill="#f97316" />
      <text x={cx + 2} y={cy + 4} fill="#f8fafc" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="inherit">{label}</text>
    </g>
  );
}

function CartonPill() {
  return (
    <g>
      <rect x={-11} y={-8} width={22} height={16} rx={4} fill="url(#gOrange)" />
      <rect x={-11} y={-1.4} width={22} height={2.6} fill="#0f172a" opacity="0.18" />
      <rect x={-1.3} y={-8} width={2.6} height={16} fill="#0f172a" opacity="0.18" />
    </g>
  );
}

function PaymentDot() {
  return (
    <g>
      <circle r="9" fill="url(#gGreen)" />
      <text y="3.2" textAnchor="middle" fontSize="8" fontWeight="800" fill="#ffffff" fontFamily="inherit">Rs</text>
    </g>
  );
}
