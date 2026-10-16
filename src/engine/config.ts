// All balance numbers live here (spec §9.2).
export const CONFIG = {
  tickSeconds: 0.25,
  lapScale: 0.28,
  minRaceLaps: 12,

  compoundOffset: { S: 0, M: 0.6, H: 1.1 }, // s/lap
  baseWearPerLap: { S: 9, M: 6, H: 4 }, // %/lap
  wearCliffStart: 70,
  wearLossAtCliff: 1.0, // s/lap at 70% wear
  wearCliffK: 0.004, // (wear-70)^2 * K s/lap beyond the cliff

  paceModeTime: { push: -0.004, normal: 0, save: 0.006 },
  paceModeWear: { push: 1.3, normal: 1.0, save: 0.75 },

  carPerfK: 0.04,
  driverPaceK: 0.02,
  setupPenaltyK: 0.03,
  fuelMaxLapPenalty: 1.5, // s/lap at race start
  dirtyAirRange: 1.5, // s
  dirtyAirK: 0.012,
  noiseSigma: 0.002,

  overtakeWindow: 1.0, // s
  overtakeModeGain: 0.01,
  overtakeBase: 0.35,
  overtakePaceK: 0.25,
  overtakeSkillK: 0.003,
  overtakeDifficultyK: 0.3,
  overtakeClamp: [0.05, 0.95] as [number, number],
  heldGapMeters: 8,

  pitStopTime: [2.2, 3.0] as [number, number], // s
  slowStopChance: 0.05,
  slowStopExtra: [2, 6] as [number, number], // s

  gridSpacing: 8, // m
  startDelay: [0.1, 0.6] as [number, number], // s, scaled by (1.2 - consistency/100)
  teamOrderRange: 2.0, // s
} as const;
