// Canonical weekday names, matching the backend (app/models.py WEEKDAYS).
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export function todayWeekday(): Weekday {
  return WEEKDAYS[(new Date().getDay() + 6) % 7];
}

// Short labels for compact chips, e.g. "Mon".
export function shortDay(day: string): string {
  return day.slice(0, 3);
}

export function normalizeDays(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return WEEKDAYS.filter((day) => value.includes(day));
}
