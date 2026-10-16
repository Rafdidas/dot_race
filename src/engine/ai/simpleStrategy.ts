import type { Rng } from '../rng';
import type { CarSnapshot, CommandInput, Compound } from '../types';

export interface OneStopPlan {
  startCompound: Compound;
  pitLap: number;
  nextCompound: Compound;
}

const EARLY_PIT_WEAR = 85;

/** Plan 1 AI: one stop, M->H or H->M, around 40-60% distance. Plan 4 replaces this with a reactive strategist. */
export function planOneStop(lapsTotal: number, rng: Rng): OneStopPlan {
  const startMedium = rng.chance(0.5);
  return {
    startCompound: startMedium ? 'M' : 'H',
    nextCompound: startMedium ? 'H' : 'M',
    pitLap: Math.round(lapsTotal * rng.range(0.4, 0.6)),
  };
}

export function aiCommands(car: CarSnapshot, plan: OneStopPlan): CommandInput[] {
  if (car.status !== 'running' || car.pitRequest !== null || car.usedCompounds.length >= 2) return [];
  if (car.lap >= plan.pitLap || car.wear >= EARLY_PIT_WEAR) {
    return [{ carId: car.carId, kind: 'pit', compound: plan.nextCompound }];
  }
  return [];
}
