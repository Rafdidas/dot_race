import { CONFIG } from '../config';
import type { CarStats, Compound, DriverStats, PaceMode, Segment } from '../types';

export interface SegmentContext {
  segment: Segment;
  lapBaseTime: number;
  car: CarStats;
  driver: DriverStats;
  setup: number;
  optimalSetup: number;
  compound: Compound;
  wear: number; // 0..100
  raceProgress: number; // 0..1, this car's completed distance / total distance
  pace: PaceMode;
  gapAhead: number | null; // seconds; null = no car ahead
  noise: number; // rng.normal() supplied by the caller
}

function carEffect(ctx: SegmentContext): number {
  const { car, segment } = ctx;
  switch (segment.type) {
    case 'straight':
      return car.power;
    case 'slowCorner':
      return 0.7 * car.chassis + 0.3 * car.aero;
    case 'fastCorner':
      return 0.7 * car.aero + 0.3 * car.chassis;
  }
}

function setupPenalty(ctx: SegmentContext): number {
  const diff = ctx.segment.type === 'straight' ? ctx.setup - ctx.optimalSetup : ctx.optimalSetup - ctx.setup;
  if (diff <= 0) return 0;
  return CONFIG.setupPenaltyK * (diff / 50) ** 2;
}

function tyreLoss(wear: number): number {
  if (wear <= CONFIG.wearCliffStart) return (CONFIG.wearLossAtCliff * wear) / CONFIG.wearCliffStart;
  return CONFIG.wearLossAtCliff + CONFIG.wearCliffK * (wear - CONFIG.wearCliffStart) ** 2;
}

/** Time in seconds to cover one segment. */
export function segmentTime(ctx: SegmentContext): number {
  const { segment, gapAhead } = ctx;
  const isStraight = segment.type === 'straight';

  let mult = 1;
  mult -= (CONFIG.carPerfK * (carEffect(ctx) - 50)) / 50;
  mult -= (CONFIG.driverPaceK * (ctx.driver.pace - 50)) / 50;
  mult += setupPenalty(ctx);
  mult += CONFIG.paceModeTime[ctx.pace];
  if (gapAhead !== null) {
    if (isStraight && gapAhead <= CONFIG.overtakeWindow) mult -= CONFIG.overtakeModeGain;
    if (!isStraight && gapAhead < CONFIG.dirtyAirRange) {
      mult += CONFIG.dirtyAirK * ((CONFIG.dirtyAirRange - gapAhead) / CONFIG.dirtyAirRange) * (1 - ctx.car.aero / 200);
    }
  }
  mult += CONFIG.noiseSigma * ctx.noise;

  const perLap = CONFIG.compoundOffset[ctx.compound] + tyreLoss(ctx.wear) + CONFIG.fuelMaxLapPenalty * (1 - ctx.raceProgress);
  return segment.baseTime * mult + perLap * (segment.baseTime / ctx.lapBaseTime);
}

/** Tyre wear (percentage points) accumulated over one full lap. */
export function wearPerLap(compound: Compound, tyreWearTrait: number, pace: PaceMode, tyreMgmt: number, chassis: number): number {
  return (
    CONFIG.baseWearPerLap[compound] *
    tyreWearTrait *
    CONFIG.paceModeWear[pace] *
    (1.2 - tyreMgmt / 250) *
    (1.1 - chassis / 500)
  );
}
