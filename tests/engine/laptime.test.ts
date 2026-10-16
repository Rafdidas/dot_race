import { segmentTime, wearPerLap, type SegmentContext } from '../../src/engine/race/laptime';
import { CONFIG } from '../../src/engine/config';

const straight = { type: 'straight', length: 800, baseTime: 10 } as const;
const slow = { type: 'slowCorner', length: 140, baseTime: 4 } as const;
const fast = { type: 'fastCorner', length: 300, baseTime: 5 } as const;

const mid = { aero: 50, chassis: 50, power: 50, reliability: 50 };
const midDriver = { pace: 50, consistency: 50, tyreMgmt: 50, wet: 50, attack: 50, defense: 50 };

const base: SegmentContext = {
  segment: straight,
  lapBaseTime: 80,
  car: mid,
  driver: midDriver,
  setup: 50,
  optimalSetup: 50,
  compound: 'M',
  wear: 0,
  raceProgress: 1,
  pace: 'normal',
  gapAhead: null,
  noise: 0,
};
const t = (o: Partial<SegmentContext>) => segmentTime({ ...base, ...o });

test('higher power is faster on straight, not on slow corner', () => {
  const strong = { ...mid, power: 80 };
  expect(t({ car: strong })).toBeLessThan(t({}));
  expect(t({ segment: slow, car: strong })).toBeCloseTo(t({ segment: slow }), 10);
});

test('higher aero is faster on fast corner', () => {
  expect(t({ segment: fast, car: { ...mid, aero: 80 } })).toBeLessThan(t({ segment: fast }));
});

test('higher chassis is faster on slow corner', () => {
  expect(t({ segment: slow, car: { ...mid, chassis: 80 } })).toBeLessThan(t({ segment: slow }));
});

test('better driver pace is faster', () => {
  expect(t({ driver: { ...midDriver, pace: 80 } })).toBeLessThan(t({}));
});

test('setup above optimal hurts straights only; below hurts corners only', () => {
  expect(t({ setup: 80 })).toBeGreaterThan(t({}));
  expect(t({ setup: 80, segment: slow })).toBeCloseTo(t({ segment: slow }), 10);
  expect(t({ setup: 20, segment: slow })).toBeGreaterThan(t({ segment: slow }));
  expect(t({ setup: 20 })).toBeCloseTo(t({}), 10);
});

test('soft faster than medium faster than hard at zero wear', () => {
  expect(t({ compound: 'S' })).toBeLessThan(t({ compound: 'M' }));
  expect(t({ compound: 'M' })).toBeLessThan(t({ compound: 'H' }));
});

test('wear loss grows faster past 70% (cliff)', () => {
  const loss = (w: number) => t({ wear: w }) - t({ wear: 0 });
  expect(loss(90) - loss(80)).toBeGreaterThan((loss(60) - loss(50)) * 3);
});

test('fuel: start of race is slower by the fuel penalty share of the segment', () => {
  const diff = t({ raceProgress: 0 }) - t({ raceProgress: 1 });
  expect(diff).toBeCloseTo(CONFIG.fuelMaxLapPenalty * (10 / 80), 10);
});

test('push faster, save slower', () => {
  expect(t({ pace: 'push' })).toBeLessThan(t({}));
  expect(t({ pace: 'save' })).toBeGreaterThan(t({}));
});

test('dirty air slows corners within 1.5s; high aero suffers less; none beyond range', () => {
  const delta = (aero: number, gap: number | null) =>
    t({ segment: fast, car: { ...mid, aero }, gapAhead: gap }) - t({ segment: fast, car: { ...mid, aero }, gapAhead: null });
  expect(delta(50, 0.5)).toBeGreaterThan(0);
  expect(delta(100, 0.5)).toBeGreaterThan(0);
  expect(delta(100, 0.5)).toBeLessThan(delta(50, 0.5));
  expect(delta(50, 2)).toBeCloseTo(0, 10);
});

test('overtake mode speeds straights within 1.0s only', () => {
  expect(t({ gapAhead: 0.5 })).toBeLessThan(t({}));
  expect(t({ gapAhead: 1.2 })).toBeCloseTo(t({}), 10);
});

test('noise scales with sigma', () => {
  expect(t({ noise: 1 })).toBeCloseTo(t({}) + CONFIG.noiseSigma * 10, 10);
});

test('wearPerLap: soft > medium > hard; push > save; better tyreMgmt lower; chassis helps', () => {
  const w = (c: 'S' | 'M' | 'H', p: 'push' | 'normal' | 'save' = 'normal', mg = 50, ch = 50) => wearPerLap(c, 1, p, mg, ch);
  expect(w('S')).toBeGreaterThan(w('M'));
  expect(w('M')).toBeGreaterThan(w('H'));
  expect(w('M', 'push')).toBeGreaterThan(w('M', 'save'));
  expect(w('M', 'normal', 90)).toBeLessThan(w('M', 'normal', 30));
  expect(w('M', 'normal', 50, 90)).toBeLessThan(w('M', 'normal', 50, 30));
});
