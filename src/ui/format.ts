import { DRIVERS } from '../data/drivers';
import { TEAMS } from '../data/teams';
import type { Compound } from '../engine/types';

export const driverOf = (carId: string) => DRIVERS.find((d) => d.id === carId)!;
export const teamOf = (teamId: string) => TEAMS.find((t) => t.id === teamId)!;

export function fmtLap(s: number | null): string {
  if (s === null) return '-';
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, '0')}`;
}

export function fmtRaceTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s - h * 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${(s - h * 3600 - m * 60).toFixed(3).padStart(6, '0')}`;
}

export const COMPOUND_COLOR: Record<Compound, string> = { S: '#ff4d4d', M: '#ffd23f', H: '#f2f2f2' };
export const COMPOUND_NAME: Record<Compound, string> = { S: '소프트', M: '미디엄', H: '하드' };

/** Replaces raw car ids in engine event text with "#number name". */
export function humanize(text: string): string {
  let out = text;
  for (const d of DRIVERS) out = out.replace(new RegExp(`\\b${d.id}\\b`, 'g'), `#${d.number} ${d.name}`);
  return out;
}
