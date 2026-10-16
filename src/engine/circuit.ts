import { CONFIG } from './config';
import type { Circuit } from './types';

export function lapLength(c: Circuit): number {
  return c.segments.reduce((a, s) => a + s.length, 0);
}

export function lapBaseTime(c: Circuit): number {
  return c.segments.reduce((a, s) => a + s.baseTime, 0);
}

/** dist must be in [0, lapLength). */
export function segmentAt(c: Circuit, dist: number): { index: number; start: number } {
  let start = 0;
  for (let i = 0; i < c.segments.length; i++) {
    const end = start + c.segments[i].length;
    if (dist < end) return { index: i, start };
    start = end;
  }
  const last = c.segments.length - 1;
  return { index: last, start: start - c.segments[last].length };
}

export function raceLaps(c: Circuit): number {
  return Math.max(CONFIG.minRaceLaps, Math.round(c.traits.realLaps * CONFIG.lapScale));
}

export function optimalSetup(c: Circuit): number {
  return Math.max(0, Math.min(100, Math.round(100 * (1 - c.traits.straightRatio))));
}

export function straightRatioOf(c: Circuit): number {
  const straight = c.segments.filter((s) => s.type === 'straight').reduce((a, s) => a + s.baseTime, 0);
  return straight / lapBaseTime(c);
}
