"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Banknote, Boxes, MapPin, Truck } from "lucide-react";

/**
 * AnimatedLogoHero — a distinct, logo-centric live visual for the sign-in page.
 * The Zaib Brothers logo sits at the centre inside pulsing rings, with carton
 * boxes, payment coins and route dots orbiting around it and GPS pins floating.
 * Optional mouse parallax. Respects prefers-reduced-motion.
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

function OrbitItem({ angle, radius, dur, reverse = false, children }: { angle: number; radius: number; dur: number; reverse?: boolean; children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" style={{ animation: `spin-slow ${dur}s linear infinite ${reverse ? "reverse" : ""}` }}>
      <div style={{ transform: `rotate(${angle}deg) translateY(-${radius}px)` }}>{children}</div>
    </div>
  );
}

export function AnimatedLogoHero({ className = "", interactive = false }: { className?: string; interactive?: boolean }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || reduced) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
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
      className={`relative mx-auto aspect-square w-full max-w-[360px] ${className}`}
      aria-hidden="true"
      onMouseMove={handleMove}
      onMouseLeave={resetMove}
      style={{ "--mx": 0, "--my": 0 } as React.CSSProperties}
    >
      {/* ambient blobs (deepest parallax layer) */}
      <div className="absolute inset-0" style={layer(26)}>
        <div className="blob left-2 top-2 h-40 w-40 bg-orange-400/40" />
        <div className="blob bottom-0 right-2 h-40 w-40 bg-emerald-400/40" style={{ animationDelay: "-6s" }} />
        <div className="blob left-1/2 top-1/2 h-32 w-32 bg-sky-400/30" style={{ animationDelay: "-10s" }} />
      </div>

      {/* rings + orbits + logo */}
      <div className="absolute inset-0" style={layer(-8)}>
        {/* pulse rings behind the logo */}
        <div className="absolute inset-0 grid place-items-center">
          <span className="pulse-ring absolute h-32 w-32 rounded-full bg-orange-400/15" />
          <span className="pulse-ring absolute h-32 w-32 rounded-full bg-emerald-400/15" style={{ animationDelay: "-1.3s" }} />
        </div>

        {/* rotating dashed orbit guides */}
        <div className="absolute inset-0 grid place-items-center">
          <span className="absolute h-[230px] w-[230px] rounded-full border border-dashed border-white/15" style={{ animation: "spin-slow 34s linear infinite" }} />
          <span className="absolute h-[300px] w-[300px] rounded-full border border-white/[0.07]" />
        </div>

        {/* orbiting elements */}
        <OrbitItem angle={20} radius={115} dur={26}>
          <div className="flex h-9 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 shadow-lift ring-1 ring-white/30">
            <Boxes size={16} className="text-white" />
          </div>
        </OrbitItem>
        <OrbitItem angle={160} radius={115} dur={26}>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-green-600 text-[10px] font-extrabold text-white shadow-lift ring-1 ring-white/30">
            Rs
          </div>
        </OrbitItem>
        <OrbitItem angle={270} radius={115} dur={26}>
          <div className="flex h-9 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 shadow-lift ring-1 ring-white/30">
            <Truck size={16} className="text-white" />
          </div>
        </OrbitItem>

        <OrbitItem angle={80} radius={150} dur={40} reverse>
          <div className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-orange-600 shadow-lift">
            <MapPin size={14} />
          </div>
        </OrbitItem>
        <OrbitItem angle={210} radius={150} dur={40} reverse>
          <div className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-emerald-600 shadow-lift">
            <Banknote size={14} />
          </div>
        </OrbitItem>
        <OrbitItem angle={330} radius={150} dur={40} reverse>
          <span className="block h-3 w-3 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.85)]" />
        </OrbitItem>

        {/* floating accents */}
        <div className="anim-float absolute left-3 top-10">
          <div className="flex h-8 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 shadow-lift ring-1 ring-white/30">
            <Boxes size={14} className="text-white" />
          </div>
        </div>
        <div className="anim-bob absolute bottom-8 right-4">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-orange-600 shadow-lift">
            <MapPin size={15} />
          </div>
        </div>

        {/* centre logo */}
        <div className="absolute inset-0 grid place-items-center">
          <div className="anim-float-lg relative grid h-28 w-28 place-items-center rounded-3xl bg-white p-3 shadow-premium ring-1 ring-white/60">
            <Image src="/logo.png" alt="Zaib Brothers" width={160} height={160} className="h-auto w-full object-contain" priority />
            <span className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lift">
              <span className="relative flex h-1.5 w-1.5">
                <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-white" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
