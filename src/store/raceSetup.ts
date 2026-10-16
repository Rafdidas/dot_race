import { DRIVERS } from '../data/drivers';
import { TEAMS } from '../data/teams';
import { optimalSetup } from '../engine/circuit';
import { createRng } from '../engine/rng';
import type { Circuit, Compound, RaceEntry } from '../engine/types';

const AI_SETUP_SPREAD = 6;
const GRID_JITTER = 2;

/** One entry per driver. Player cars use the chosen setup/tyre; AI cars get a setup near the circuit's optimum. */
export function buildEntries(
  circuit: Circuit,
  playerTeamId: string,
  setups: Record<string, number>,
  startCompounds: Record<string, Compound>,
  seed: number,
): RaceEntry[] {
  const rng = createRng(seed ^ 0x5eed);
  const opt = optimalSetup(circuit);
  return DRIVERS.map((driver) => {
    const team = TEAMS.find((t) => t.id === driver.teamId)!;
    const mine = driver.teamId === playerTeamId;
    const aiSetup = Math.max(0, Math.min(100, opt + rng.int(-AI_SETUP_SPREAD, AI_SETUP_SPREAD)));
    return {
      carId: driver.id,
      teamId: driver.teamId,
      car: team.stats,
      driver: driver.stats,
      setup: mine ? (setups[driver.id] ?? opt) : aiSetup,
      startCompound: mine ? (startCompounds[driver.id] ?? 'M') : 'M',
    };
  });
}

/** Plan 1 has no qualifying: order by team strength, then driver pace, shuffled by up to two places. */
export function buildGrid(entries: RaceEntry[], seed: number): string[] {
  const rng = createRng(seed ^ 0x91d);
  const tier = (e: RaceEntry) => TEAMS.find((t) => t.id === e.teamId)!.tier;
  const base = [...entries].sort((a, b) => tier(a) - tier(b) || b.driver.pace - a.driver.pace);
  return base
    .map((e, i) => ({ id: e.carId, key: i + rng.range(-GRID_JITTER, GRID_JITTER) }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.id);
}
