export type Unit = 'lb' | 'kg';

export const LB_PER_KG = 2.2046226218;

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Stored (lb) → number in the display unit, rounded to 2 decimals. */
export function toDisplay(lb: number, unit: Unit): number {
  return round(unit === 'kg' ? lb / LB_PER_KG : lb, 2);
}

/** A value typed in the display unit → canonical lb (4 decimals keeps kg round-trips exact). */
export function toLb(value: number, unit: Unit): number {
  return round(unit === 'kg' ? value * LB_PER_KG : value, 4);
}

/** Convert a typed weight string from one unit to another (used when the preference changes). */
export function convertWeightString(s: string, from: Unit, to: Unit): string {
  const n = parseFloat(s);
  if (from === to || !Number.isFinite(n)) return s;
  return trimNum(toDisplay(toLb(n, from), to));
}

export const trimNum = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));

export type UnitFormat = {
  unit: Unit;
  /** "lb" | "kg" */
  label: string;
  /** stored lb → display number */
  w: (lb: number) => number;
  /** stored lb → "135" / "61.2" */
  fmt: (lb: number) => string;
  /** stored lb + reps → "135 × 10" */
  set: (lb: number, reps: number) => string;
  /** like set(), but a reps-only exercise with no weight reads "12 reps" */
  setOrReps: (lb: number, reps: number, repsOnly?: boolean) => string;
  /** stored-lb volume → "12,345" */
  vol: (lb: number) => string;
  /** weight typed by the user in the display unit → lb for storage */
  toLb: (value: number) => number;
};

export function makeUnitFormat(unit: Unit): UnitFormat {
  return {
    unit,
    label: unit,
    w: (lb) => toDisplay(lb, unit),
    fmt: (lb) => trimNum(toDisplay(lb, unit)),
    set: (lb, reps) => `${trimNum(toDisplay(lb, unit))} × ${reps}`,
    setOrReps: (lb, reps, repsOnly) =>
      repsOnly && lb === 0 ? `${reps} reps` : `${trimNum(toDisplay(lb, unit))} × ${reps}`,
    vol: (lb) => Math.round(toDisplay(lb, unit)).toLocaleString(),
    toLb: (value) => toLb(value, unit),
  };
}
