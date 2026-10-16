import { computeSteps } from '../../src/store/loop';
import { buildEntries, buildGrid } from '../../src/store/raceSetup';
import { SOUTHLAKE } from '../../src/data/circuits';
import { DRIVERS } from '../../src/data/drivers';
import { optimalSetup } from '../../src/engine/circuit';

test('speed 0 produces no steps and does not accumulate', () => {
  expect(computeSteps(0.1, 0.05, 0)).toEqual({ steps: 0, accumulator: 0.1 });
});

test('1x: one real second is four ticks', () => {
  let acc = 0;
  let total = 0;
  for (let i = 0; i < 64; i++) {
    const r = computeSteps(acc, 1 / 64, 1);
    acc = r.accumulator;
    total += r.steps;
  }
  expect(total).toBe(4);
});

test('4x: one real second is sixteen ticks', () => {
  let acc = 0;
  let total = 0;
  for (let i = 0; i < 64; i++) {
    const r = computeSteps(acc, 1 / 64, 4);
    acc = r.accumulator;
    total += r.steps;
  }
  expect(total).toBe(16);
});

test('a tab resumed after 30 s at 16x yields at most 16 steps and keeps no backlog', () => {
  const r = computeSteps(0, 30, 16);
  expect(r.steps).toBeLessThanOrEqual(16);
  expect(r.accumulator).toBeLessThan(0.25);
  const next = computeSteps(r.accumulator, 1 / 64, 16);
  expect(next.steps).toBeLessThanOrEqual(1);
});

test('accumulator carries the remainder between frames', () => {
  const a = computeSteps(0, 0.125, 1);
  expect(a).toEqual({ steps: 0, accumulator: 0.125 });
  const b = computeSteps(a.accumulator, 0.125, 1);
  expect(b.steps).toBe(1);
  expect(b.accumulator).toBeCloseTo(0, 10);
});

test('buildEntries: 22 entries; the player picks setup and tyre, AI setups stay near the optimum', () => {
  const player = DRIVERS.filter((d) => d.teamId === 'ember').map((d) => d.id);
  const entries = buildEntries(SOUTHLAKE, 'ember', { [player[0]]: 80, [player[1]]: 10 }, { [player[0]]: 'S', [player[1]]: 'H' }, 7);
  expect(entries).toHaveLength(22);
  const byId = new Map(entries.map((e) => [e.carId, e]));
  expect(byId.get(player[0])!.setup).toBe(80);
  expect(byId.get(player[0])!.startCompound).toBe('S');
  expect(byId.get(player[1])!.setup).toBe(10);
  const opt = optimalSetup(SOUTHLAKE);
  for (const e of entries) {
    if (player.includes(e.carId)) continue;
    expect(Math.abs(e.setup - opt)).toBeLessThanOrEqual(6);
  }
});

test('buildGrid: every car once, stronger teams ahead on average, deterministic by seed', () => {
  const entries = buildEntries(SOUTHLAKE, 'ember', {}, {}, 1);
  const g1 = buildGrid(entries, 5);
  const g2 = buildGrid(entries, 5);
  expect(g1).toEqual(g2);
  expect(new Set(g1).size).toBe(22);
  const tier = (id: string) => DRIVERS.find((d) => d.id === id)!.teamId;
  expect(['ember', 'volta']).toContain(tier(g1[0]));
  expect(['liberty', 'tidewave']).toContain(tier(g1[21]));
  expect(buildGrid(entries, 6)).not.toEqual(g1);
});
