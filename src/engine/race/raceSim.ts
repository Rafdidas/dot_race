import { lapBaseTime, lapLength, optimalSetup, raceLaps, segmentAt } from '../circuit';
import { CONFIG } from '../config';
import { createRng, type Rng } from '../rng';
import type {
  CarSnapshot,
  CarStatus,
  Circuit,
  Command,
  Compound,
  PaceMode,
  RaceEntry,
  RaceEvent,
  ResultRow,
  SessionResult,
  SessionSim,
  SessionSnapshot,
} from '../types';
import { segmentTime, wearPerLap } from './laptime';
import { sortResults, violatesCompoundRule } from './rules';

export interface RaceSimOptions {
  circuit: Circuit;
  entries: RaceEntry[];
  grid: string[]; // carIds in starting order
  seed: number;
  aiCarIds: string[];
}

interface CarState {
  entry: RaceEntry;
  gridIndex: number;
  status: CarStatus;
  lapsCompleted: number; // -1 while still behind the start line on the grid
  lapDist: number; // 0..lapLength
  startDelay: number;
  compound: Compound;
  wear: number;
  used: Compound[];
  pace: PaceMode;
  pitRequest: Compound | null;
  inPitLane: boolean;
  lapStartTime: number;
  lastLap: number | null;
  bestLap: number | null;
  finishTime: number | null;
  finishedLaps: number;
  yieldTo: string | null;
}

const MAX_EVENTS = 50;
const MAX_SEGMENTS_PER_TICK = 100000;

export class RaceSim implements SessionSim {
  readonly aiCarIds: string[];
  protected readonly circuit: Circuit;
  protected readonly rng: Rng;
  protected readonly cars: CarState[];
  protected readonly lapLen: number;
  protected readonly lapTime0: number;
  protected readonly lapsTotal: number;
  protected readonly opt: number;
  protected tick = 0;
  protected raceOver = false;
  protected raceOverTime = 0;
  protected events: RaceEvent[] = [];
  protected queue: Command[] = [];

  constructor(opts: RaceSimOptions) {
    this.circuit = opts.circuit;
    this.aiCarIds = opts.aiCarIds;
    this.rng = createRng(opts.seed);
    this.lapLen = lapLength(opts.circuit);
    this.lapTime0 = lapBaseTime(opts.circuit);
    this.lapsTotal = raceLaps(opts.circuit);
    this.opt = optimalSetup(opts.circuit);

    this.cars = opts.entries.map((entry) => {
      const gridIndex = opts.grid.indexOf(entry.carId);
      if (gridIndex < 0) throw new Error(`car ${entry.carId} missing from grid`);
      const onLine = gridIndex === 0;
      const consistency = entry.driver.consistency;
      return {
        entry,
        gridIndex,
        status: 'running' as CarStatus,
        lapsCompleted: onLine ? 0 : -1,
        lapDist: onLine ? 0 : this.lapLen - gridIndex * CONFIG.gridSpacing,
        startDelay: this.rng.range(CONFIG.startDelay[0], CONFIG.startDelay[1]) * (1.2 - consistency / 100),
        compound: entry.startCompound,
        wear: 0,
        used: [entry.startCompound],
        pace: 'normal' as PaceMode,
        pitRequest: null,
        inPitLane: false,
        lapStartTime: 0,
        lastLap: null,
        bestLap: null,
        finishTime: null,
        finishedLaps: 0,
        yieldTo: null,
      };
    });
  }

  get time(): number {
    return this.tick * CONFIG.tickSeconds;
  }

  enqueue(cmd: Command): void {
    this.queue.push(cmd);
  }

  isFinished(): boolean {
    return this.cars.every((c) => c.status === 'finished' || c.status === 'retired');
  }

  step(): void {
    this.tick += 1;
    const t0 = (this.tick - 1) * CONFIG.tickSeconds;
    const order = this.ranked();
    const gaps = this.gapsAhead(order);
    for (const car of order) {
      if (car.status === 'running') this.advance(car, t0, gaps.get(car) ?? null);
    }
  }

  protected totalDist(car: CarState): number {
    if (car.status === 'finished') return car.finishedLaps * this.lapLen;
    return car.lapsCompleted * this.lapLen + car.lapDist;
  }

  protected refSpeed(): number {
    return this.lapLen / this.lapTime0;
  }

  /** Positions: retired last; otherwise distance desc, finish time then grid as tiebreaks. */
  protected ranked(): CarState[] {
    return [...this.cars].sort((a, b) => {
      const ra = Number(a.status === 'retired');
      const rb = Number(b.status === 'retired');
      if (ra !== rb) return ra - rb;
      const da = this.totalDist(a);
      const db = this.totalDist(b);
      if (da !== db) return db - da;
      const fa = a.finishTime ?? Infinity;
      const fb = b.finishTime ?? Infinity;
      if (fa !== fb) return fa - fb;
      return a.gridIndex - b.gridIndex;
    });
  }

  protected gapsAhead(order: CarState[]): Map<CarState, number | null> {
    const gaps = new Map<CarState, number | null>();
    for (let i = 0; i < order.length; i++) {
      const ahead = order[i - 1];
      if (!ahead || ahead.status !== 'running') {
        gaps.set(order[i], null);
      } else {
        gaps.set(order[i], (this.totalDist(ahead) - this.totalDist(order[i])) / this.refSpeed());
      }
    }
    return gaps;
  }

  protected advance(car: CarState, t0: number, gapAhead: number | null): void {
    let remaining: number = CONFIG.tickSeconds;
    if (car.startDelay > 0) {
      const used = Math.min(remaining, car.startDelay);
      car.startDelay -= used;
      remaining -= used;
    }
    let guard = 0;
    while (remaining > 1e-9 && car.status === 'running') {
      if (guard++ > MAX_SEGMENTS_PER_TICK) throw new Error('advance: runaway segment loop');
      const { index, start } = segmentAt(this.circuit, car.lapDist);
      const segment = this.circuit.segments[index];
      const segEnd = start + segment.length;
      const time = segmentTime({
        segment,
        lapBaseTime: this.lapTime0,
        car: car.entry.car,
        driver: car.entry.driver,
        setup: car.entry.setup,
        optimalSetup: this.opt,
        compound: car.compound,
        wear: car.wear,
        raceProgress: this.progress(car),
        pace: car.pace,
        gapAhead,
        noise: this.rng.normal(),
      });
      const speed = segment.length / time;
      const toEnd = segEnd - car.lapDist;
      const timeToEnd = toEnd / speed;
      if (remaining < timeToEnd) {
        this.move(car, speed * remaining);
        remaining = 0;
      } else {
        this.move(car, toEnd);
        car.lapDist = segEnd;
        remaining -= timeToEnd;
        if (index === this.circuit.segments.length - 1) {
          this.crossLine(car, t0 + (CONFIG.tickSeconds - remaining));
        }
      }
    }
  }

  protected progress(car: CarState): number {
    const p = this.totalDist(car) / (this.lapsTotal * this.lapLen);
    return Math.max(0, Math.min(1, p));
  }

  protected move(car: CarState, dist: number): void {
    car.lapDist += dist;
    const perLap = wearPerLap(
      car.compound,
      this.circuit.traits.tyreWear,
      car.pace,
      car.entry.driver.tyreMgmt,
      car.entry.car.chassis,
    );
    car.wear = Math.min(100, car.wear + (perLap * dist) / this.lapLen);
  }

  protected crossLine(car: CarState, tCross: number): void {
    car.lapsCompleted += 1;
    car.lapDist = 0;
    if (car.lapsCompleted >= 1) {
      const lapTime = tCross - car.lapStartTime;
      car.lastLap = lapTime;
      car.bestLap = car.bestLap === null ? lapTime : Math.min(car.bestLap, lapTime);
      car.lapStartTime = tCross;
    }
    if (car.lapsCompleted >= this.lapsTotal) {
      if (!this.raceOver) {
        this.raceOver = true;
        this.raceOverTime = tCross;
      }
      this.finishCar(car, tCross);
    } else if (this.raceOver && car.lapsCompleted >= 1 && tCross >= this.raceOverTime) {
      this.finishCar(car, tCross);
    }
  }

  protected finishCar(car: CarState, tCross: number): void {
    car.status = 'finished';
    car.finishTime = tCross;
    car.finishedLaps = car.lapsCompleted;
    car.lapDist = 0;
    this.pushEvent(car, `${car.entry.carId} 체커기 통과`);
  }

  protected pushEvent(car: CarState, text: string): void {
    this.events.push({ tick: this.tick, lap: this.lapOf(car), text });
    if (this.events.length > MAX_EVENTS) this.events.shift();
  }

  protected lapOf(car: CarState): number {
    return Math.min(this.lapsTotal, Math.max(1, car.lapsCompleted + 1));
  }

  snapshot(): SessionSnapshot {
    const order = this.ranked();
    const leader = order[0];
    const leaderDist = this.totalDist(leader);
    const speed = this.refSpeed();
    const cars: CarSnapshot[] = order.map((car, i) => {
      const dist = this.totalDist(car);
      const ahead = order[i - 1];
      return {
        carId: car.entry.carId,
        teamId: car.entry.teamId,
        position: i + 1,
        status: car.status,
        lap: this.lapOf(car),
        totalDist: dist,
        lapDist: car.lapDist,
        inPitLane: car.inPitLane,
        compound: car.compound,
        wear: car.wear,
        usedCompounds: [...car.used],
        pace: car.pace,
        pitRequest: car.pitRequest,
        gapToLeader: Math.max(0, (leaderDist - dist) / speed),
        interval: ahead ? Math.max(0, (this.totalDist(ahead) - dist) / speed) : 0,
        lastLap: car.lastLap,
        bestLap: car.bestLap,
      };
    });
    return {
      tick: this.tick,
      time: this.time,
      lapsTotal: this.lapsTotal,
      leaderLap: this.lapOf(leader),
      cars,
      events: [...this.events],
      finished: this.isFinished(),
    };
  }

  result(): SessionResult {
    const rows: ResultRow[] = this.cars.map((car) => {
      const finished = car.status === 'finished';
      return {
        carId: car.entry.carId,
        teamId: car.entry.teamId,
        position: 0,
        laps: finished ? car.finishedLaps : Math.max(0, car.lapsCompleted),
        time: car.finishTime,
        status: finished ? (violatesCompoundRule(car.used) ? 'dsq' : 'finished') : 'retired',
        bestLap: car.bestLap,
        usedCompounds: [...car.used],
      };
    });
    return { rows: sortResults(rows) };
  }
}
