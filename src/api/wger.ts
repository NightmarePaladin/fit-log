import type { RepsMode } from '../lib/units';

/**
 * Exercise library search, powered by wger (https://wger.de), a free open exercise database. No account or API key.
 * Its exercise data is licensed CC-BY-SA, so the picker shows an attribution line wherever these results appear.
 */
const ENDPOINT = 'https://wger.de/api/v2/exerciseinfo/';
const TIMEOUT_MS = 8000;

export const WGER_ATTRIBUTION = 'Exercise data from wger.de (CC-BY-SA 4.0)';

export type WgerExercise = {
  id: number;
  name: string;
  /** our muscle_group label: Chest, Arms, Back, Legs, Shoulders, Core, Cardio */
  muscleGroup: string;
  /** primary muscles, e.g. ["Chest", "Triceps"] */
  muscles: string[];
  equipment: string[];
  imageUrl: string | null;
  /** how it is logged: weight + reps (false), reps only (true) or by time ('time') */
  mode: RepsMode;
};

type RawWger = {
  id: number;
  category?: { name?: string } | null;
  muscles?: { name?: string; name_en?: string }[];
  equipment?: { name?: string }[];
  images?: { image?: string; thumbnails?: { small?: string }; is_main?: boolean }[];
  translations?: { language: number; name?: string }[];
};

const ENGLISH = 2; // wger's language id for English
const BODYWEIGHT = /bodyweight|none/i;

/** wger categories → the labels the built-in library uses. */
const GROUPS: Record<string, string> = { Abs: 'Core', Calves: 'Legs' };

/** Turn one wger record into what the app needs. null when it has no English name. */
export function mapWgerExercise(raw: RawWger): WgerExercise | null {
  const name = raw.translations?.find((t) => t.language === ENGLISH)?.name?.trim();
  if (!name) return null;
  const category = raw.category?.name ?? '';
  const equipment = (raw.equipment ?? []).map((e) => e.name ?? '').filter(Boolean);
  const image = raw.images?.find((i) => i.is_main) ?? raw.images?.[0];
  // wger lists "none (bodyweight exercise)" explicitly; an empty equipment list just means "not specified".
  const bodyweight = equipment.some((e) => BODYWEIGHT.test(e));
  return {
    id: raw.id,
    name,
    muscleGroup: GROUPS[category] ?? (category || 'Other'),
    muscles: (raw.muscles ?? []).map((m) => m.name_en || m.name || '').filter(Boolean),
    equipment: equipment.filter((e) => !BODYWEIGHT.test(e)),
    imageUrl: image?.thumbnails?.small ?? image?.image ?? null,
    // Cardio is logged by time. Bodyweight-only moves (no equipment) by reps. Everything else with weight.
    mode: category === 'Cardio' ? 'time' : bodyweight,
  };
}

const cache = new Map<string, WgerExercise[]>();

/** Search the library by name. Throws on a network problem so the caller can say it is unavailable. */
export async function searchWger(term: string, signal?: AbortSignal): Promise<WgerExercise[]> {
  const q = term.trim().toLowerCase();
  if (q.length < 3) return [];
  const hit = cache.get(q);
  if (hit) return hit;

  const url = `${ENDPOINT}?language__code=en&name__search=${encodeURIComponent(q)}&limit=15&format=json`;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => timeout.abort());
  try {
    const res = await fetch(url, { signal: timeout.signal });
    if (!res.ok) throw new Error(`Exercise library returned ${res.status}`);
    const json = (await res.json()) as { results?: RawWger[] };
    const seen = new Set<string>();
    const items: WgerExercise[] = [];
    for (const raw of json.results ?? []) {
      const m = mapWgerExercise(raw);
      if (!m || seen.has(m.name.toLowerCase())) continue;
      seen.add(m.name.toLowerCase());
      items.push(m);
    }
    cache.set(q, items);
    return items;
  } finally {
    clearTimeout(timer);
  }
}
