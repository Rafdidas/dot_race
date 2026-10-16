import { SOUTHLAKE } from '../../src/data/circuits';
import { lapBaseTime, lapLength } from '../../src/engine/circuit';
import { CONFIG } from '../../src/engine/config';
import { pitLaneDistance, pitTraverseTime, rollStopTime } from '../../src/engine/race/pit';
import { createRng } from '../../src/engine/rng';
import type { RaceEntry } from '../../src/engine/types';
import { makeRace, runToEnd } from './helpers';

const driver = { pace: 60, consistency: 60, tyreMgmt: 60, wet: 60, attack: 60, defense: 60 };
const entry = (carId: string, strength = 60, teamId = carId): RaceEntry => ({
  carId,
  teamId,
  car: { aero: strength, chassis: strength, power: strength, reliability: 60 },
  driver: { ...driver, pace: strength },
  setup: 45,
  startCompound: 'M',
});

const solo = (seed = 1, compound: 'S' | 'M' | 'H' = 'M') =>
  makeRace(seed, { entries: [{ ...entry('solo'), startCompound: compound }] });
const car0 = (sim: ReturnType<typeof solo>) => sim.snapshot().cars[0];

function stepUntil(sim: ReturnType<typeof solo>, pred: () => boolean, max = 20000) {
  let n = 0;
  while (!pred() && n++ < max) sim.step();
  return n;
}

test('pit lane helpers', () => {
  expect(pitLaneDistance(SOUTHLAKE)).toBe(360);
  const stop = 2.5;
  expect(pitTraverseTime(SOUTHLAKE, stop)).toBeCloseTo(
    (lapBaseTime(SOUTHLAKE) * 360) / lapLength(SOUTHLAKE) + SOUTHLAKE.traits.pitLossSeconds + stop,
    10,
  );
});

test('rollStopTime within range, slow stops about 5% over 2000 rolls', () => {
  const rng = createRng(11);
  let slow = 0;
  for (let i = 0; i < 2000; i++) {
    const t = rollStopTime(rng);
    expect(t).toBeGreaterThanOrEqual(CONFIG.pitStopTime[0]);
    expect(t).toBeLessThanOrEqual(CONFIG.pitStopTime[1] + CONFIG.slowStopExtra[1]);
    if (t > CONFIG.pitStopTime[1]) slow++;
  }
  expect(slow).toBeGreaterThan(70);
  expect(slow).toBeLessThan(130);
});

test('pit request: car enters, spends about pitLoss+stop time, exits on the new compound with fresh tyres', () => {
  const plain = solo(1, 'H');
  const pitting = solo(1, 'H');
  pitting.enqueue({ tick: 0, carId: 'solo', kind: 'pit', compound: 'S' });
  stepUntil(pitting, () => car0(pitting).inPitLane);
  expect(car0(pitting).status).toBe('pitting');
  expect(car0(pitting).pitRequest).toBe('S');
  const wearBefore = car0(pitting).wear;
  expect(wearBefore).toBeGreaterThan(1);
  stepUntil(pitting, () => !car0(pitting).inPitLane);
  const after = car0(pitting);
  expect(after.status).toBe('running');
  expect(after.compound).toBe('S');
  expect(after.pitRequest).toBeNull();
  expect(after.wear).toBeLessThan(2);
  expect(after.usedCompounds).toEqual(['H', 'S']);
  runToEnd(plain);
  runToEnd(pitting);
  const loss = pitting.result().rows[0].time! - plain.result().rows[0].time!;
  expect(loss).toBeGreaterThan(15);
  expect(loss).toBeLessThan(32);
});

test('pitting for the same compound resets wear but does not add a compound kind', () => {
  const sim = solo(2, 'M');
  sim.enqueue({ tick: 0, carId: 'solo', kind: 'pit', compound: 'M' });
  stepUntil(sim, () => car0(sim).inPitLane);
  stepUntil(sim, () => !car0(sim).inPitLane);
  const c = car0(sim);
  expect(c.usedCompounds).toEqual(['M']);
  expect(c.wear).toBeLessThan(2);
  expect(c.compound).toBe('M');
});

test('pit command to a pitting or finished car is ignored without breaking state', () => {
  const sim = solo(3, 'M');
  sim.enqueue({ tick: 0, carId: 'solo', kind: 'pit', compound: 'H' });
  stepUntil(sim, () => car0(sim).inPitLane);
  sim.enqueue({ tick: sim.snapshot().tick, carId: 'solo', kind: 'pit', compound: 'S' });
  sim.step();
  expect(car0(sim).pitRequest).toBe('H');
  stepUntil(sim, () => !car0(sim).inPitLane);
  expect(car0(sim).compound).toBe('H');
  expect(car0(sim).pitRequest).toBeNull();
  runToEnd(sim);
  const before = JSON.stringify(sim.snapshot().cars[0]);
  sim.enqueue({ tick: sim.snapshot().tick, carId: 'solo', kind: 'pit', compound: 'S' });
  sim.enqueue({ tick: sim.snapshot().tick, carId: 'ghost', kind: 'pit', compound: 'S' });
  sim.step();
  expect(JSON.stringify(sim.snapshot().cars[0])).toBe(before);
});

test('push increases wear and pace over a lap versus normal', () => {
  const lap = lapLength(SOUTHLAKE);
  const normal = solo(4);
  const push = solo(4);
  push.enqueue({ tick: 0, carId: 'solo', kind: 'pace', mode: 'push' });
  const tNormal = stepUntil(normal, () => car0(normal).totalDist >= lap);
  const tPush = stepUntil(push, () => car0(push).totalDist >= lap);
  expect(car0(push).pace).toBe('push');
  expect(car0(push).wear).toBeGreaterThan(car0(normal).wear * 1.15);
  expect(tPush).toBeLessThan(tNormal);
});

test('command with a future tick is applied at that tick, not before', () => {
  const sim = solo(5);
  sim.enqueue({ tick: 10, carId: 'solo', kind: 'pace', mode: 'push' });
  for (let i = 0; i < 10; i++) sim.step();
  expect(car0(sim).pace).toBe('normal');
  sim.step();
  expect(car0(sim).pace).toBe('push');
});

test('teamOrder: accepted for a teammate right behind, ignored with an event when out of range', () => {
  const close = makeRace(6, { entries: [entry('a', 60, 'x'), entry('b', 60, 'x')] });
  for (let i = 0; i < 20; i++) close.step();
  close.enqueue({ tick: close.snapshot().tick, carId: 'a', kind: 'teamOrder' });
  close.step();
  expect(close.snapshot().events.some((e) => e.text.includes('a → b 양보 지시'))).toBe(true);

  const far = makeRace(6, { entries: [entry('a', 100, 'x'), entry('b', 0, 'x')] });
  for (let i = 0; i < 600; i++) far.step();
  far.enqueue({ tick: far.snapshot().tick, carId: 'a', kind: 'teamOrder' });
  far.step();
  const texts = far.snapshot().events.map((e) => e.text);
  expect(texts.some((t) => t.includes('팀 오더 불가'))).toBe(true);
  expect(texts.some((t) => t.includes('양보 지시'))).toBe(false);
});
