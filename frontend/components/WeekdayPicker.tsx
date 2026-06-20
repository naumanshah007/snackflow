"use client";

import { WEEKDAYS, shortDay } from "@/lib/weekdays";

export function WeekdayPicker({
  value,
  onChange,
  today
}: {
  value: string[];
  onChange: (next: string[]) => void;
  today?: string;
}) {
  const selected = new Set(value);
  const toggle = (day: string) => {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange(WEEKDAYS.filter((d) => next.has(d)));
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAYS.map((day) => {
        const active = selected.has(day);
        const isToday = today === day;
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            aria-pressed={active}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
              active ? "border-orange-500 bg-orange-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            } ${isToday && !active ? "ring-1 ring-orange-300" : ""}`}
            title={isToday ? `${day} (today)` : day}
          >
            {shortDay(day)}
          </button>
        );
      })}
    </div>
  );
}
