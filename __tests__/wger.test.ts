import { mapWgerExercise, searchWger } from '../src/api/wger';

const raw = (over: Record<string, unknown> = {}) => ({
  id: 73,
  category: { name: 'Chest' },
  muscles: [{ name: 'Pectoralis major', name_en: 'Chest' }],
  equipment: [{ name: 'Barbell' }, { name: 'Bench' }],
  images: [
    { image: 'https://wger.de/media/a.png', thumbnails: { small: 'https://wger.de/media/a-small.png' }, is_main: true },
  ],
  translations: [
    { language: 1, name: 'Bankdrücken' },
    { language: 2, name: ' Bench Press ' },
  ],
  ...over,
});

describe('mapWgerExercise', () => {
  it('uses the English name, our muscle labels and the small thumbnail', () => {
    expect(mapWgerExercise(raw())).toEqual({
      id: 73, name: 'Bench Press', muscleGroup: 'Chest', muscles: ['Chest'], equipment: ['Barbell', 'Bench'],
      imageUrl: 'https://wger.de/media/a-small.png', mode: false,
    });
  });

  it('skips exercises with no English name', () => {
    expect(mapWgerExercise(raw({ translations: [{ language: 1, name: 'Bankdrücken' }] }))).toBeNull();
  });

  it('renames wger categories to the built-in library labels', () => {
    expect(mapWgerExercise(raw({ category: { name: 'Abs' } }))?.muscleGroup).toBe('Core');
    expect(mapWgerExercise(raw({ category: { name: 'Calves' } }))?.muscleGroup).toBe('Legs');
  });

  it('logs cardio by time and explicit bodyweight moves by reps; unspecified equipment keeps weight', () => {
    expect(mapWgerExercise(raw({ category: { name: 'Cardio' }, equipment: [] }))?.mode).toBe('time');
    const dips = mapWgerExercise(raw({ category: { name: 'Arms' }, equipment: [{ name: 'none (bodyweight exercise)' }] }));
    expect(dips?.mode).toBe(true);
    expect(dips?.equipment).toEqual([]);
    expect(mapWgerExercise(raw({ equipment: [] }))?.mode).toBe(false);
  });

  it('copes with a record that has no images or muscles', () => {
    expect(mapWgerExercise(raw({ images: [], muscles: [] }))).toMatchObject({ imageUrl: null, muscles: [] });
  });
});

describe('searchWger', () => {
  const ok = (results: unknown[]) => ({ ok: true, status: 200, json: async () => ({ results }) });

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  it('does not call the network for fewer than 3 letters', async () => {
    expect(await searchWger('be')).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('asks for English, encodes the term, drops duplicate names and non-English records', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      ok([raw(), raw({ id: 74 }), raw({ id: 75, translations: [{ language: 1, name: 'x' }] })]),
    );
    const items = await searchWger('Lat Pull & more');
    expect(items.map((i) => i.id)).toEqual([73]);
    const url = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('language__code=en');
    expect(url).toContain('name__search=lat%20pull%20%26%20more');
  });

  it('remembers a term, so retyping it does not hit the network again', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(ok([raw()]));
    await searchWger('squatcache');
    await searchWger('  SquatCache ');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when the library answers with an error, and does not cache that', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    await expect(searchWger('failcase')).rejects.toThrow(/503/);
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce(ok([raw()]));
    expect(await searchWger('failcase')).toHaveLength(1);
  });
});
