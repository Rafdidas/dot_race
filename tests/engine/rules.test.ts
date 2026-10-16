import { sortResults, violatesCompoundRule } from '../../src/engine/race/rules';
import type { ResultRow } from '../../src/engine/types';

const row = (carId: string, o: Partial<ResultRow>): ResultRow => ({
  carId,
  teamId: 't',
  position: 0,
  laps: 16,
  time: 1000,
  status: 'finished',
  bestLap: 80,
  usedCompounds: ['M', 'H'],
  ...o,
});

test('violatesCompoundRule', () => {
  expect(violatesCompoundRule([])).toBe(true);
  expect(violatesCompoundRule(['M'])).toBe(true);
  expect(violatesCompoundRule(['M', 'M'])).toBe(true);
  expect(violatesCompoundRule(['M', 'H'])).toBe(false);
  expect(violatesCompoundRule(['S', 'M', 'H'])).toBe(false);
});

test('sortResults: laps desc then time asc, positions renumbered', () => {
  const sorted = sortResults([
    row('c', { laps: 15, time: 1010 }),
    row('b', { time: 1005 }),
    row('a', { time: 1000 }),
  ]);
  expect(sorted.map((r) => r.carId)).toEqual(['a', 'b', 'c']);
  expect(sorted.map((r) => r.position)).toEqual([1, 2, 3]);
});

test('sortResults: dsq sorted last even when faster; retired (no time) after finishers on same laps', () => {
  const sorted = sortResults([
    row('dsq-fast', { time: 990, status: 'dsq', usedCompounds: ['M'] }),
    row('ret', { laps: 16, time: null, status: 'retired' }),
    row('ok', { time: 1000 }),
  ]);
  expect(sorted.map((r) => r.carId)).toEqual(['ok', 'ret', 'dsq-fast']);
});
