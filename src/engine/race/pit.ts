import { lapBaseTime, lapLength } from '../circuit';
import { CONFIG } from '../config';
import type { Rng } from '../rng';
import type { Circuit } from '../types';

/** Length of the pit lane in metres (it normally spans the start/finish line). */
export function pitLaneDistance(c: Circuit): number {
  const len = lapLength(c);
  return (c.pitExit - c.pitEntry + len) % len;
}

/** Stationary time in seconds; occasionally a slow stop. */
export function rollStopTime(rng: Rng): number {
  let t = rng.range(CONFIG.pitStopTime[0], CONFIG.pitStopTime[1]);
  if (rng.chance(CONFIG.slowStopChance)) t += rng.range(CONFIG.slowStopExtra[0], CONFIG.slowStopExtra[1]);
  return t;
}

/** Total time from pit entry to pit exit, including the circuit's fixed loss and the stop. */
export function pitTraverseTime(c: Circuit, stopTime: number): number {
  return (lapBaseTime(c) * pitLaneDistance(c)) / lapLength(c) + c.traits.pitLossSeconds + stopTime;
}
