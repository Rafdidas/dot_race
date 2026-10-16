import { SOUTHLAKE } from '../../src/data/circuits';
import { lapLength, raceLaps } from '../../src/engine/circuit';
import { CONFIG } from '../../src/engine/config';
import type { Circuit, RaceEntry } from '../../src/engine/types';
import { makeRace, runToEnd } from './helpers';

const driver = { pace: 60, consistency: 60, tyreMgmt: 60, wet: 60, attack: 60, defense: 60 };
const entry = (carId: string, strength: number, teamId = carId): RaceEntry => ({
  carId,
  teamId,
  car: { aero: strength, chassis: strength, power: strength, reliability: 60 },
  driver: { ...driver, pace: strength },
  setup: 45,
  startCompound: 'M',
});

test('a stop taken on the final lap still counts: no DSQ, new compound recorded', () => {
  const sim = makeRace(1, { entries: [entry('solo', 60)] });
  const lap = lapLength(SOUTHLAKE);
  const lastLapStart = (raceLaps(SOUTHLAKE) - 1) * lap;
  let guard = 0;
  while (sim.snapshot().cars[0].totalDist < lastLapStart + 100 && guard++ < 20000) sim.step();
  sim.enqueue({ tick: sim.snapshot().tick, carId: 'solo', kind: 'pit', compound: 'H' });
  runToEnd(sim);
  const row = sim.result().rows[0];
  expect(row.usedCompounds).toEqual(['M', 'H']);
  expect(row.status).toBe('finished');
});

test('a pitting car between two runners does not let the rear one pass without contact rules', () => {
  const corners: Circuit = {
    ...SOUTHLAKE,
    id: 'corners',
    segments: Array.from({ length: 12 }, () => ({ type: 'slowCorner' as const, length: 440, baseTime: 440 / 35 })),
    pitEntry: 999,
    pitExit: 1500,
  };
  const sim = makeRace(1, { circuit: corners, entries: [entry('a', 0), entry('p', 60), entry('b', 100)] });
  const cars = (sim as unknown as { cars: { entry: { carId: string }; lapsCompleted: number; lapDist: number; startDelay: number; status: string; inPitLane: boolean; pitTotal: number; pitElapsed: number; pitEnterTime: number }[] }).cars;
  const get = (id: string) => cars.find((c) => c.entry.carId === id)!;
  for (const c of cars) {
    c.lapsCompleted = 0;
    c.startDelay = 0;
  }
  get('a').lapDist = 1000;
  get('b').lapDist = 998;
  Object.assign(get('p'), { lapDist: 999, status: 'pitting', inPitLane: true, pitTotal: 100, pitElapsed: 0, pitEnterTime: 0 });
  sim.step();
  const a = sim.snapshot().cars.find((c) => c.carId === 'a')!;
  const b = sim.snapshot().cars.find((c) => c.carId === 'b')!;
  expect(b.totalDist).toBeLessThanOrEqual(a.totalDist - CONFIG.heldGapMeters + 1e-6);
});

test('a team order cannot teleport a teammate that is well behind', () => {
  const sim = makeRace(2, { entries: [entry('a', 100, 'x'), entry('b', 0, 'x')] });
  let guard = 0;
  const gap = () => sim.snapshot().cars.find((c) => c.carId === 'b')!.interval;
  while (gap() < 1.4 && guard++ < 5000) sim.step();
  expect(gap()).toBeGreaterThan(1.4);
  expect(gap()).toBeLessThanOrEqual(CONFIG.teamOrderRange);
  sim.enqueue({ tick: sim.snapshot().tick, carId: 'a', kind: 'teamOrder' });
  for (let i = 0; i < 600; i++) {
    sim.step();
    expect(sim.snapshot().cars[0].carId).toBe('a');
  }
  expect(sim.snapshot().events.some((e) => e.text.includes('양보 지시'))).toBe(true);
});
