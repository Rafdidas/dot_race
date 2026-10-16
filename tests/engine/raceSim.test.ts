import { CIRCUITS, SOUTHLAKE } from '../../src/data/circuits';
import { lapBaseTime, lapLength, raceLaps } from '../../src/engine/circuit';
import { CONFIG } from '../../src/engine/config';
import type { Circuit, RaceEntry } from '../../src/engine/types';
import { makeEntries, makeRace, runToEnd } from './helpers';

const flatDriver = { pace: 60, consistency: 60, tyreMgmt: 60, wet: 60, attack: 60, defense: 60 };
const entry = (carId: string, strength: number): RaceEntry => ({
  carId,
  teamId: carId,
  car: { aero: strength, chassis: strength, power: strength, reliability: 60 },
  driver: { ...flatDriver, pace: strength },
  setup: 45,
  startCompound: 'M',
});

test('deterministic: same seed same result, different seed differs', () => {
  const a = makeRace(5);
  const b = makeRace(5);
  const c = makeRace(6);
  runToEnd(a);
  runToEnd(b);
  runToEnd(c);
  expect(a.result()).toEqual(b.result());
  expect(a.result()).not.toEqual(c.result());
});

test('runs to completion in a bounded number of steps', () => {
  const sim = makeRace(1);
  const cap = Math.ceil((raceLaps(SOUTHLAKE) * lapBaseTime(SOUTHLAKE) * 1.5) / CONFIG.tickSeconds);
  const steps = runToEnd(sim, cap);
  expect(sim.isFinished()).toBe(true);
  expect(steps).toBeLessThan(cap);
  const snap = sim.snapshot();
  expect(snap.finished).toBe(true);
  expect(snap.cars.every((c) => c.status === 'finished')).toBe(true);
});

test('grid: pole at the line, others spaced behind', () => {
  const sim = makeRace(1);
  const snap = sim.snapshot();
  const byId = new Map(snap.cars.map((c) => [c.carId, c]));
  const grid = makeEntries().map((e) => e.carId);
  expect(byId.get(grid[0])!.totalDist).toBe(0);
  expect(byId.get(grid[3])!.totalDist).toBe(-3 * CONFIG.gridSpacing);
  expect(snap.cars.map((c) => c.position)).toEqual(snap.cars.map((_, i) => i + 1));
  expect(snap.cars[0].carId).toBe(grid[0]);
});

test('stronger car (+20 on all) starting last finishes near the front on average over 20 seeds', () => {
  const entries: RaceEntry[] = Array.from({ length: 21 }, (_, i) => entry(`f${i}`, 60));
  entries.push(entry('star', 80));
  let total = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const sim = makeRace(seed, { entries });
    runToEnd(sim);
    const rows = sim.result().rows;
    total += rows.findIndex((r) => r.carId === 'star') + 1;
  }
  expect(total / 20).toBeLessThan(3);
});

test('lapped car finishes on its next line crossing a lap down, and classifies after lead-lap cars', () => {
  const entries = [entry('strong', 100), entry('mid', 60), entry('weak', 0)];
  const sim = makeRace(3, { entries });
  runToEnd(sim);
  const lapsTotal = raceLaps(SOUTHLAKE);
  const snap = sim.snapshot();
  expect(snap.cars.every((c) => c.status === 'finished')).toBe(true);
  const rows = sim.result().rows;
  const weak = rows.find((r) => r.carId === 'weak')!;
  const strong = rows.find((r) => r.carId === 'strong')!;
  expect(strong.laps).toBe(lapsTotal);
  expect(weak.laps).toBeLessThan(lapsTotal);
  expect(weak.time).not.toBeNull();
  expect(rows.map((r) => r.carId)).toEqual(['strong', 'mid', 'weak']);
  expect(rows.map((r) => r.laps)).toEqual([...rows.map((r) => r.laps)].sort((a, b) => b - a));
});

test('crossing many short segments in one tick conserves distance', () => {
  const tiny: Circuit = {
    ...SOUTHLAKE,
    id: 'tiny',
    segments: Array.from({ length: 5280 }, () => ({ type: 'straight' as const, length: 1, baseTime: 1 / 80 })),
  };
  const coarse: Circuit = {
    ...SOUTHLAKE,
    id: 'coarse',
    segments: [{ type: 'straight' as const, length: 5280, baseTime: 5280 / 80 }],
    pitEntry: 5000,
    pitExit: 100,
  };
  const only = [entry('solo', 60)];
  const a = makeRace(1, { circuit: tiny, entries: only });
  const b = makeRace(1, { circuit: coarse, entries: only });
  for (let i = 0; i < 120; i++) {
    a.step();
    b.step();
  }
  const da = a.snapshot().cars[0].totalDist;
  const db = b.snapshot().cars[0].totalDist;
  expect(da).toBeGreaterThan(1000);
  expect(Math.abs(da - db) / db).toBeLessThan(0.005);
  expect(lapLength(tiny)).toBe(lapLength(coarse));
});

test('wear accumulates by wearPerLap per lap and caps at 100', () => {
  const sim = makeRace(2, { entries: [{ ...entry('solo', 60), startCompound: 'S' }] });
  const lapLen = lapLength(SOUTHLAKE);
  let guard = 0;
  while (sim.snapshot().cars[0].totalDist < lapLen && guard++ < 5000) sim.step();
  const afterOne = sim.snapshot().cars[0].wear;
  expect(afterOne).toBeGreaterThan(6);
  expect(afterOne).toBeLessThan(10);
  runToEnd(sim);
  expect(sim.snapshot().cars[0].wear).toBe(100);
});

test('snapshot: gaps are zero for the leader and non-decreasing down the order', () => {
  const sim = makeRace(4);
  for (let i = 0; i < 400; i++) sim.step();
  const cars = sim.snapshot().cars;
  expect(cars[0].gapToLeader).toBe(0);
  for (let i = 1; i < cars.length; i++) {
    expect(cars[i].gapToLeader).toBeGreaterThanOrEqual(cars[i - 1].gapToLeader);
    expect(cars[i].interval).toBeGreaterThanOrEqual(0);
  }
  expect(CIRCUITS).toContain(SOUTHLAKE);
});
