/** Weeks run Monday 00:00 → next Monday 00:00 in the device's local timezone. */
export function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate()); // local midnight (DST-safe)
  const daysSinceMonday = (s.getDay() + 6) % 7; // Sun=0 → 6, Mon=1 → 0
  s.setDate(s.getDate() - daysSinceMonday);
  return s;
}

export function addWeeks(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n * 7);
  return r;
}

/** Stable key like "2026-10-26" for the Monday that starts the week. */
export function weekKey(d: Date): string {
  const s = startOfWeek(d);
  const m = String(s.getMonth() + 1).padStart(2, '0');
  const day = String(s.getDate()).padStart(2, '0');
  return `${s.getFullYear()}-${m}-${day}`;
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatWeekLabel(d: Date): string {
  const s = startOfWeek(d);
  return `${s.getMonth() + 1}/${s.getDate()}`;
}
