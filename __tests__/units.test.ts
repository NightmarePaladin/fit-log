import { convertWeightString, makeUnitFormat, toDisplay, toLb } from '../src/lib/units';

describe('units', () => {
  it('lb is identity', () => {
    expect(toDisplay(135, 'lb')).toBe(135);
    expect(toLb(135, 'lb')).toBe(135);
  });
  it('converts lb to kg for display', () => {
    expect(toDisplay(225, 'kg')).toBe(102.06);
    expect(toDisplay(2.2046226218, 'kg')).toBe(1);
  });
  it('kg round-trips exactly through canonical lb (typical plate loads)', () => {
    for (const kg of [1.25, 2.5, 20, 42.5, 60, 62.5, 100, 142.5, 200]) {
      expect(toDisplay(toLb(kg, 'kg'), 'kg')).toBe(kg);
    }
  });
  it('formats sets and volume in the chosen unit', () => {
    const f = makeUnitFormat('kg');
    expect(f.set(225, 10)).toBe('102.06 × 10');
    expect(f.vol(2250)).toBe('1,021');
    expect(makeUnitFormat('lb').set(135, 10)).toBe('135 × 10');
  });
  it('converts typed draft values when the unit changes', () => {
    expect(convertWeightString('225', 'lb', 'kg')).toBe('102.06');
    expect(convertWeightString('100', 'kg', 'lb')).toBe('220.46');
    expect(convertWeightString('', 'lb', 'kg')).toBe('');
    expect(convertWeightString('135', 'lb', 'lb')).toBe('135');
  });
});
