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
