import { DRIVERS } from '../../src/data/drivers';
import { TEAMS } from '../../src/data/teams';
import { SOUTHLAKE } from '../../src/data/circuits';
import { optimalSetup } from '../../src/engine/circuit';
import { RaceSim } from '../../src/engine/race/raceSim';
import type { Circuit, RaceEntry } from '../../src/engine/types';

export function makeEntries(): RaceEntry[] {
  return DRIVERS.map((d) => {
    const team = TEAMS.find((t) => t.id === d.teamId)!;
    return {
      carId: d.id,
      teamId: d.teamId,
      car: team.stats,
      driver: d.stats,
      setup: optimalSetup(SOUTHLAKE),
      startCompound: 'M',
    };
  });
}

export function makeRace(seed: number, opts: { circuit?: Circuit; entries?: RaceEntry[]; aiCarIds?: string[] } = {}): RaceSim {
  const entries = opts.entries ?? makeEntries();
  return new RaceSim({
    circuit: opts.circuit ?? SOUTHLAKE,
    entries,
    grid: entries.map((e) => e.carId),
    seed,
    aiCarIds: opts.aiCarIds ?? [],
  });
}

export function runToEnd(sim: RaceSim, maxSteps = 20000): number {
  let n = 0;
  while (!sim.isFinished() && n < maxSteps) {
    sim.step();
    n++;
  }
  return n;
}

export const allAi = (entries: RaceEntry[]): string[] => entries.map((e) => e.carId);
