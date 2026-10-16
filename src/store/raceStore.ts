import { create } from 'zustand';
import { SOUTHLAKE } from '../data/circuits';
import { DRIVERS } from '../data/drivers';
import { CONFIG } from '../engine/config';
import { RaceSim } from '../engine/race/raceSim';
import type { Command, CommandInput, Compound, SessionResult, SessionSnapshot } from '../engine/types';
import { computeSteps, type Speed } from './loop';
import { buildEntries, buildGrid } from './raceSetup';

const UI_REFRESH_MS = 250;
const DEFAULT_SPEED: Speed = 4;

interface RaceStoreState {
  phase: 'setup' | 'race' | 'result';
  playerTeamId: string | null;
  speed: Speed;
  /** Refreshed every 250 ms (not every frame) so React panels stay cheap. */
  uiSnapshot: SessionSnapshot | null;
  result: SessionResult | null;
  startRace(opts: {
    playerTeamId: string;
    setups: Record<string, number>;
    startCompounds: Record<string, Compound>;
    seed: number;
  }): void;
  setSpeed(s: Speed): void;
  command(cmd: CommandInput): void;
  backToSetup(): void;
}

// The sim and render frames live outside React state: they change every animation frame.
let sim: RaceSim | null = null;
let prev: SessionSnapshot | null = null;
let curr: SessionSnapshot | null = null;
let accumulator = 0;
let rafHandle: number | null = null;
let lastFrame = 0;
let lastUiRefresh = 0;

export function getRenderFrame(): { prev: SessionSnapshot; curr: SessionSnapshot; alpha: number } | null {
  if (!prev || !curr) return null;
  return { prev, curr, alpha: Math.min(1, accumulator / CONFIG.tickSeconds) };
}

function stopLoop(): void {
  if (rafHandle !== null) cancelAnimationFrame(rafHandle);
  rafHandle = null;
}

export const useRaceStore = create<RaceStoreState>((set, get) => {
  function frame(now: number): void {
    rafHandle = null;
    if (!sim) return;
    const dt = (now - lastFrame) / 1000;
    lastFrame = now;
    const r = computeSteps(accumulator, dt, get().speed);
    accumulator = r.accumulator;
    if (r.steps > 0) {
      for (let i = 0; i < r.steps - 1 && !sim.isFinished(); i++) sim.step();
      prev = sim.snapshot();
      if (!sim.isFinished()) sim.step();
      curr = sim.snapshot();
    }
    if (sim.isFinished()) {
      set({ uiSnapshot: curr, result: sim.result(), phase: 'result' });
      return;
    }
    if (now - lastUiRefresh >= UI_REFRESH_MS) {
      lastUiRefresh = now;
      set({ uiSnapshot: curr });
    }
    rafHandle = requestAnimationFrame(frame);
  }

  return {
    phase: 'setup',
    playerTeamId: null,
    speed: DEFAULT_SPEED,
    uiSnapshot: null,
    result: null,

    startRace({ playerTeamId, setups, startCompounds, seed }) {
      stopLoop();
      const circuit = SOUTHLAKE;
      const entries = buildEntries(circuit, playerTeamId, setups, startCompounds, seed);
      const grid = buildGrid(entries, seed);
      const mine = new Set(DRIVERS.filter((d) => d.teamId === playerTeamId).map((d) => d.id));
      sim = new RaceSim({
        circuit,
        entries,
        grid,
        seed,
        aiCarIds: entries.filter((e) => !mine.has(e.carId)).map((e) => e.carId),
      });
      prev = curr = sim.snapshot();
      accumulator = 0;
      lastFrame = performance.now();
      lastUiRefresh = 0;
      set({ phase: 'race', playerTeamId, speed: DEFAULT_SPEED, uiSnapshot: curr, result: null });
      rafHandle = requestAnimationFrame(frame);
    },

    setSpeed(s) {
      set({ speed: s });
    },

    command(cmd) {
      if (!sim || !curr) return;
      sim.enqueue({ ...cmd, tick: curr.tick } as Command);
    },

    backToSetup() {
      stopLoop();
      sim = null;
      prev = curr = null;
      accumulator = 0;
      set({ phase: 'setup', uiSnapshot: null, result: null });
    },
  };
});
