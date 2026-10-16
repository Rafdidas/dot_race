import { CONFIG } from '../config';

/**
 * Probability that the car behind gets past on a straight.
 * paceDeltaPerLap = ahead's expected lap time minus behind's (seconds; positive = behind is faster).
 */
export function overtakeChance(paceDeltaPerLap: number, attack: number, defense: number, difficulty: number): number {
  const p =
    CONFIG.overtakeBase +
    CONFIG.overtakePaceK * paceDeltaPerLap +
    CONFIG.overtakeSkillK * (attack - defense) -
    CONFIG.overtakeDifficultyK * difficulty;
  return Math.max(CONFIG.overtakeClamp[0], Math.min(CONFIG.overtakeClamp[1], p));
}
