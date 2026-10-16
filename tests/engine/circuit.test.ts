import { lapBaseTime, lapLength, optimalSetup, raceLaps, segmentAt, straightRatioOf } from '../../src/engine/circuit';
import { SOUTHLAKE, CIRCUITS } from '../../src/data/circuits';

test('raceLaps: 58 real laps -> 16', () => {
  expect(raceLaps(SOUTHLAKE)).toBe(16);
});

test('raceLaps floor at 12', () => {
  expect(raceLaps({ ...SOUTHLAKE, traits: { ...SOUTHLAKE.traits, realLaps: 20 } })).toBe(12);
});

test('lap length and base time are sums of segments', () => {
  expect(lapLength(SOUTHLAKE)).toBe(SOUTHLAKE.segments.reduce((a, s) => a + s.length, 0));
  expect(lapBaseTime(SOUTHLAKE)).toBeGreaterThan(70);
  expect(lapBaseTime(SOUTHLAKE)).toBeLessThan(90);
});

test('segmentAt finds containing segment', () => {
  const first = SOUTHLAKE.segments[0].length;
  expect(segmentAt(SOUTHLAKE, 0)).toEqual({ index: 0, start: 0 });
  expect(segmentAt(SOUTHLAKE, first - 0.01).index).toBe(0);
  expect(segmentAt(SOUTHLAKE, first)).toEqual({ index: 1, start: first });
  const last = SOUTHLAKE.segments.length - 1;
  expect(segmentAt(SOUTHLAKE, lapLength(SOUTHLAKE) - 0.01).index).toBe(last);
});

test('optimalSetup from straightRatio', () => {
  expect(optimalSetup(SOUTHLAKE)).toBe(45);
});

test('southlake data consistent', () => {
  expect(Math.abs(straightRatioOf(SOUTHLAKE) - SOUTHLAKE.traits.straightRatio)).toBeLessThanOrEqual(0.05);
  expect(SOUTHLAKE.pitEntry).toBeLessThan(lapLength(SOUTHLAKE));
  expect(SOUTHLAKE.pitExit).toBeLessThan(SOUTHLAKE.pitEntry);
  expect(SOUTHLAKE.path.length).toBeGreaterThanOrEqual(40);
  expect(SOUTHLAKE.path.length).toBeLessThanOrEqual(80);
  for (const [x, y] of SOUTHLAKE.path) {
    expect(x).toBeGreaterThanOrEqual(20);
    expect(x).toBeLessThanOrEqual(460);
    expect(y).toBeGreaterThanOrEqual(20);
    expect(y).toBeLessThanOrEqual(250);
  }
  expect(CIRCUITS).toContain(SOUTHLAKE);
});
