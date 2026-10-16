import { TEAMS } from '../../src/data/teams';
import { DRIVERS } from '../../src/data/drivers';
import { CONFIG } from '../../src/engine/config';
import type { CarStats } from '../../src/engine/types';

test('11 teams with unique ids and tiers 1..11', () => {
  expect(TEAMS).toHaveLength(11);
  expect(new Set(TEAMS.map((t) => t.id)).size).toBe(11);
  expect(TEAMS.map((t) => t.tier).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  expect(TEAMS.find((t) => t.tier === 1)!.funds).toBe(150);
  expect(TEAMS.find((t) => t.tier === 11)!.funds).toBe(70);
});

test('22 drivers, exactly 2 per team, unique numbers', () => {
  expect(DRIVERS).toHaveLength(22);
  expect(new Set(DRIVERS.map((d) => d.number)).size).toBe(22);
  expect(new Set(DRIVERS.map((d) => d.id)).size).toBe(22);
  for (const t of TEAMS) expect(DRIVERS.filter((d) => d.teamId === t.id)).toHaveLength(2);
});

test('all stats in 0..100', () => {
  for (const t of TEAMS) for (const v of Object.values(t.stats)) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100);
  for (const d of DRIVERS) for (const v of Object.values(d.stats)) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100);
});

test('top tier stronger than bottom tier on average', () => {
  const avg = (s: CarStats) => Object.values(s).reduce((a, b) => a + b, 0) / Object.values(s).length;
  const top = TEAMS.find((t) => t.tier === 1)!;
  const bottom = TEAMS.find((t) => t.tier === 11)!;
  expect(avg(top.stats)).toBeGreaterThan(avg(bottom.stats) + 10);
});

test('no banned real-world words in data', () => {
  const text = JSON.stringify({ TEAMS, DRIVERS }).toLowerCase();
  for (const w of ['f1', 'formula', 'grand prix', 'ferrari', 'mercedes', 'mclaren', 'red bull', 'williams', 'alpine', 'aston', 'haas', 'sauber', 'audi', 'cadillac', 'racing bulls'])
    expect(text).not.toContain(w);
});

test('config sanity', () => {
  expect(CONFIG.tickSeconds).toBe(0.25);
  expect(CONFIG.compoundOffset.S).toBeLessThan(CONFIG.compoundOffset.M);
  expect(CONFIG.baseWearPerLap.S).toBeGreaterThan(CONFIG.baseWearPerLap.H);
});
