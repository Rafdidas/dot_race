import { SOUTHLAKE } from '../../src/data/circuits';
import { overtakeChance } from '../../src/engine/race/overtake';
import type { Circuit, RaceEntry } from '../../src/engine/types';
import { allAi, makeEntries, makeRace, runToEnd } from './helpers';

const driver = { pace: 60, consistency: 60, tyreMgmt: 60, wet: 60, attack: 60, defense: 60 };
const entry = (carId: string, strength: number, teamId = carId): RaceEntry => ({
  carId,
  teamId,
  car: { aero: strength, chassis: strength, power: strength, reliability: 60 },
  driver: { ...driver, pace: strength },
  setup: 45,
  startCompound: 'M',
});

test('overtakeChance clamps and moves in the right direction', () => {
  const base = overtakeChance(0, 50, 50, 0.5);
  expect(base).toBeCloseTo(0.2, 10);
  expect(overtakeChance(2, 50, 50, 0.5)).toBeGreaterThan(base);
  expect(overtakeChance(0, 80, 50, 0.5)).toBeGreaterThan(base);
  expect(overtakeChance(0, 50, 50, 0.9)).toBeLessThan(base);
  expect(overtakeChance(100, 100, 0, 0)).toBe(0.95);
  expect(overtakeChance(-100, 0, 100, 1)).toBe(0.05);
});

test('in corners a much faster car stays behind', () => {
  const corners: Circuit = {
    ...SOUTHLAKE,
    id: 'corners',
    segments: Array.from({ length: 12 }, () => ({ type: 'slowCorner' as const, length: 440, baseTime: 440 / 35 })),
  };
  const sim = makeRace(1, { circuit: corners, entries: [entry('slow', 0), entry('fast', 100)] });
  for (let i = 0; i < 1500; i++) {
    sim.step();
    const cars = sim.snapshot().cars;
    expect(cars[0].carId).toBe('slow');
  }
  const snap = sim.snapshot();
  expect(snap.cars[1].interval).toBeLessThan(0.5);
});

test('a much faster car eventually passes on the straights', () => {
  const sim = makeRace(2, { entries: [entry('slow', 0), entry('fast', 100)] });
  for (let i = 0; i < 1000; i++) sim.step();
  const snap = sim.snapshot();
  expect(snap.cars[0].carId).toBe('fast');
  expect(snap.events.some((e) => e.text.includes('fast → slow 추월'))).toBe(true);
});

test('teamOrder yield lets the teammate pass on the next straight', () => {
  const hard: Circuit = { ...SOUTHLAKE, traits: { ...SOUTHLAKE.traits, overtakeDifficulty: 1 } };
  const sim = makeRace(3, { circuit: hard, entries: [entry('a', 60, 'x'), entry('b', 60, 'x')] });
  for (let i = 0; i < 20; i++) sim.step();
  sim.enqueue({ tick: sim.snapshot().tick, carId: 'a', kind: 'teamOrder' });
  let passed = false;
  for (let i = 0; i < 400 && !passed; i++) {
    sim.step();
    passed = sim.snapshot().cars[0].carId === 'b';
  }
  expect(passed).toBe(true);
  expect(sim.snapshot().events.some((e) => e.text.includes('b → a 추월'))).toBe(true);
});

test('AI: every car stops exactly once and satisfies the two-compound rule over 10 seeds', () => {
  const entries = makeEntries();
  for (let seed = 1; seed <= 10; seed++) {
    const sim = makeRace(seed, { entries, aiCarIds: allAi(entries) });
    const stops = new Map<string, number>();
    const inPit = new Map<string, boolean>();
    let n = 0;
    while (!sim.isFinished() && n++ < 20000) {
      sim.step();
      for (const c of sim.snapshot().cars) {
        if (c.inPitLane && !inPit.get(c.carId)) stops.set(c.carId, (stops.get(c.carId) ?? 0) + 1);
        inPit.set(c.carId, c.inPitLane);
      }
    }
    const rows = sim.result().rows;
    expect(rows).toHaveLength(22);
    for (const r of rows) {
      expect(r.status).toBe('finished');
      expect(r.usedCompounds).toHaveLength(2);
      expect(stops.get(r.carId)).toBe(1);
    }
  }
});

test('race stays deterministic with overtakes and AI', () => {
  const entries = makeEntries();
  const a = makeRace(9, { entries, aiCarIds: allAi(entries) });
  const b = makeRace(9, { entries, aiCarIds: allAi(entries) });
  runToEnd(a);
  runToEnd(b);
  expect(a.result()).toEqual(b.result());
  expect(a.snapshot().events).toEqual(b.snapshot().events);
});
