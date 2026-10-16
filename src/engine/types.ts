export type Compound = 'S' | 'M' | 'H'; // Plan 4: add 'I' | 'W'
export type PaceMode = 'push' | 'normal' | 'save';
export type SegmentType = 'straight' | 'slowCorner' | 'fastCorner';

export interface CarStats {
  aero: number;
  chassis: number;
  power: number;
  reliability: number;
}

export interface DriverStats {
  pace: number;
  consistency: number;
  tyreMgmt: number;
  wet: number;
  attack: number;
  defense: number;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  accent: string;
  tier: number;
  funds: number;
  stats: CarStats;
}

export interface Driver {
  id: string;
  name: string;
  number: number;
  teamId: string;
  stats: DriverStats;
}

export interface Segment {
  type: SegmentType;
  length: number;
  baseTime: number;
}

export interface CircuitTraits {
  straightRatio: number;
  tyreWear: number;
  overtakeDifficulty: number;
  pitLossSeconds: number;
  realLaps: number;
  rainChance: number;
}

export interface Circuit {
  id: string;
  name: string;
  location: string;
  path: [number, number][];
  segments: Segment[];
  traits: CircuitTraits;
  pitEntry: number;
  pitExit: number;
}

export interface RaceEntry {
  carId: string;
  teamId: string;
  car: CarStats;
  driver: DriverStats;
  setup: number;
  startCompound: Compound;
}

export type Command =
  | { tick: number; carId: string; kind: 'pit'; compound: Compound }
  | { tick: number; carId: string; kind: 'pace'; mode: PaceMode }
  | { tick: number; carId: string; kind: 'teamOrder' }; // carId yields to its teammate

export type CarStatus = 'running' | 'pitting' | 'retired' | 'finished';

export interface CarSnapshot {
  carId: string;
  teamId: string;
  position: number;
  status: CarStatus;
  lap: number;
  totalDist: number;
  lapDist: number;
  inPitLane: boolean;
  compound: Compound;
  wear: number;
  usedCompounds: Compound[];
  pace: PaceMode;
  pitRequest: Compound | null;
  gapToLeader: number; // seconds
  interval: number; // seconds to the car ahead
  lastLap: number | null;
  bestLap: number | null;
}

export interface RaceEvent {
  tick: number;
  lap: number;
  text: string;
}

export interface SessionSnapshot {
  tick: number;
  time: number;
  lapsTotal: number;
  leaderLap: number;
  cars: CarSnapshot[];
  events: RaceEvent[];
  finished: boolean;
}

export interface ResultRow {
  carId: string;
  teamId: string;
  position: number;
  laps: number;
  time: number | null;
  status: 'finished' | 'retired' | 'dsq';
  bestLap: number | null;
  usedCompounds: Compound[];
}

export interface SessionResult {
  rows: ResultRow[];
}

export interface SessionSim {
  step(): void;
  enqueue(cmd: Command): void;
  snapshot(): SessionSnapshot;
  isFinished(): boolean;
  result(): SessionResult;
}
