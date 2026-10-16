import { aiCommands, planOneStop } from '../../src/engine/ai/simpleStrategy';
import { createRng } from '../../src/engine/rng';
import type { CarSnapshot } from '../../src/engine/types';

const car = (o: Partial<CarSnapshot> = {}): CarSnapshot => ({
  carId: 'x',
  teamId: 't',
  position: 5,
  status: 'running',
  lap: 1,
  totalDist: 0,
  lapDist: 0,
  inPitLane: false,
  compound: 'M',
  wear: 10,
  usedCompounds: ['M'],
  pace: 'normal',
  pitRequest: null,
  gapToLeader: 0,
  interval: 0,
  lastLap: null,
  bestLap: null,
  ...o,
});

test('planOneStop: two different compounds, pit lap in 40-60% of the race', () => {
  const rng = createRng(1);
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const p = planOneStop(16, rng);
    expect(p.startCompound).not.toBe(p.nextCompound);
    expect(['M', 'H']).toContain(p.startCompound);
    expect(p.pitLap).toBeGreaterThanOrEqual(6);
    expect(p.pitLap).toBeLessThanOrEqual(10);
    seen.add(p.startCompound);
  }
  expect(seen.size).toBe(2);
});

const plan = { startCompound: 'M', pitLap: 8, nextCompound: 'H' } as const;

test('aiCommands requests the planned stop once the pit lap is reached', () => {
  expect(aiCommands(car({ lap: 7 }), plan)).toEqual([]);
  expect(aiCommands(car({ lap: 8 }), plan)).toEqual([{ carId: 'x', kind: 'pit', compound: 'H' }]);
});

test('aiCommands pits early when tyres are nearly gone', () => {
  expect(aiCommands(car({ lap: 3, wear: 86 }), plan)).toEqual([{ carId: 'x', kind: 'pit', compound: 'H' }]);
});

test('aiCommands stays quiet when a stop is requested, already done, or the car is not running', () => {
  expect(aiCommands(car({ lap: 9, pitRequest: 'H' }), plan)).toEqual([]);
  expect(aiCommands(car({ lap: 12, usedCompounds: ['M', 'H'] }), plan)).toEqual([]);
  expect(aiCommands(car({ lap: 9, status: 'pitting' }), plan)).toEqual([]);
  expect(aiCommands(car({ lap: 9, status: 'finished' }), plan)).toEqual([]);
});
