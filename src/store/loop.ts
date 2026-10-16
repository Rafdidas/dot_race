import { CONFIG } from '../engine/config';

export type Speed = 0 | 1 | 4 | 8 | 16;

/** Longest frame (real seconds) the loop will honour; a tab left in the background cannot fast-forward the race. */
const MAX_FRAME_SECONDS = 0.25;
const MAX_STEPS_PER_FRAME = 16;

/**
 * Converts real elapsed time into whole simulation ticks.
 * Paused (speed 0) neither steps nor accumulates; any backlog beyond the per-frame cap is dropped.
 */
export function computeSteps(accumulator: number, realDt: number, speed: Speed): { steps: number; accumulator: number } {
  if (speed === 0) return { steps: 0, accumulator };
  const acc = accumulator + Math.min(Math.max(realDt, 0), MAX_FRAME_SECONDS) * speed;
  const wanted = Math.floor(acc / CONFIG.tickSeconds + 1e-9);
  const steps = Math.min(wanted, MAX_STEPS_PER_FRAME);
  const left = acc - steps * CONFIG.tickSeconds;
  return { steps, accumulator: steps < wanted ? Math.min(left, CONFIG.tickSeconds * 0.999) : Math.max(0, left) };
}
