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
import { aiCommands, planOneStop, type OneStopPlan } from '../ai/simpleStrategy';
import { overtakeChance } from './overtake';
import { pitLaneDistance, pitTraverseTime, rollStopTime } from './pit';
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
  pitElapsed: number;
  pitTotal: number;
  pitEnterTime: number;
  pitCrossed: boolean;
  lastAttempt: string | null;
  plan: OneStopPlan | null;
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
      const plan = opts.aiCarIds.includes(entry.carId) ? planOneStop(this.lapsTotal, this.rng) : null;
      const startCompound = plan ? plan.startCompound : entry.startCompound;
      return {
        entry,
        gridIndex,
        status: 'running' as CarStatus,
        lapsCompleted: onLine ? 0 : -1,
        lapDist: onLine ? 0 : this.lapLen - gridIndex * CONFIG.gridSpacing,
        startDelay: this.rng.range(CONFIG.startDelay[0], CONFIG.startDelay[1]) * (1.2 - consistency / 100),
        compound: startCompound,
        wear: 0,
        used: [startCompound],
        pace: 'normal' as PaceMode,
        pitRequest: null,
        inPitLane: false,
        lapStartTime: 0,
        lastLap: null,
        bestLap: null,
        finishTime: null,
        finishedLaps: 0,
        yieldTo: null,
        pitElapsed: 0,
        pitTotal: 0,
        pitEnterTime: 0,
        pitCrossed: false,
        lastAttempt: null,
        plan,
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
    this.runAi();
    this.applyCommands();
    this.tick += 1;
    const t0 = (this.tick - 1) * CONFIG.tickSeconds;
    const order = this.ranked();
    const gaps = this.gapsAhead(order);
    for (const car of order) {
      if (car.status === 'running' || car.status === 'pitting') this.advance(car, t0, gaps.get(car) ?? null);
    }
    this.resolveContacts(order);
  }

  /** AI cars decide once per simulated second. */
  protected runAi(): void {
    if (this.tick % 4 !== 0 || this.aiCarIds.length === 0) return;
    const snap = this.snapshot();
    for (const c of snap.cars) {
      const plan = this.cars.find((x) => x.entry.carId === c.carId)?.plan;
      if (!plan) continue;
      for (const cmd of aiCommands(c, plan)) this.enqueue({ ...cmd, tick: this.tick } as Command);
    }
  }

  protected onStraight(car: CarState): boolean {
    return this.circuit.segments[segmentAt(this.circuit, car.lapDist).index].type === 'straight';
  }

  /** Expected lap time at the car's current tyres/pace, with no traffic and no noise. */
  protected expectedLapTime(car: CarState): number {
    let total = 0;
    for (const segment of this.circuit.segments) {
      total += segmentTime({
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
        gapAhead: null,
        noise: 0,
      });
    }
    return total;
  }

  /**
   * Cars cannot occupy the same piece of road. `order` is the pre-move ranking: any follower that
   * reached (or jumped past) the car in front is either granted a pass or held back.
   */
  protected resolveContacts(order: CarState[]): void {
    for (let i = 1; i < order.length; i++) {
      const a = order[i - 1];
      const b = order[i];
      if (a.status !== 'running' || b.status !== 'running') continue;
      const da = this.totalDist(a);
      const db = this.totalDist(b);

      if (a.yieldTo === b.entry.carId && this.onStraight(b)) {
        a.yieldTo = null;
        if (this.passAhead(b, a)) continue;
      }
      if (db <= da - CONFIG.heldGapMeters) continue;

      if (this.onStraight(b) && (da - db) / this.refSpeed() <= CONFIG.overtakeWindow) {
        const key = `${a.entry.carId}:${b.lapsCompleted}:${segmentAt(this.circuit, b.lapDist).index}`;
        if (b.lastAttempt !== key) {
          b.lastAttempt = key;
          const delta = this.expectedLapTime(a) - this.expectedLapTime(b);
          const p = overtakeChance(delta, b.entry.driver.attack, a.entry.driver.defense, this.circuit.traits.overtakeDifficulty);
          if (this.rng.chance(p) && this.passAhead(b, a)) continue;
        }
      }
      this.holdBehind(b, da);
    }
  }

  /** Completes a pass by placing `b` just in front of `a`; refuses if that would cross a timing line. */
  protected passAhead(b: CarState, a: CarState): boolean {
    const target = this.totalDist(a) + CONFIG.passMargin;
    if (Math.floor(target / this.lapLen) !== b.lapsCompleted) return false;
    b.lapDist = target - b.lapsCompleted * this.lapLen;
    this.pushEvent(b, `${this.lapOf(b)}랩: ${b.entry.carId} → ${a.entry.carId} 추월`);
    return true;
  }

  /** Put `car` heldGapMeters behind a car at distance `aheadDist`, never back across a line it already crossed. */
  protected holdBehind(car: CarState, aheadDist: number): void {
    const target = Math.max(aheadDist - CONFIG.heldGapMeters, car.lapsCompleted * this.lapLen);
    car.lapDist = target - car.lapsCompleted * this.lapLen;
  }

  protected applyCommands(): void {
    if (this.queue.length === 0) return;
    const due = this.queue.filter((c) => c.tick <= this.tick);
    if (due.length === 0) return;
    this.queue = this.queue.filter((c) => c.tick > this.tick);
    for (const cmd of due) this.applyCommand(cmd);
  }

  protected applyCommand(cmd: Command): void {
    const car = this.cars.find((c) => c.entry.carId === cmd.carId);
    if (!car) return;
    switch (cmd.kind) {
      case 'pit':
        if (car.status === 'running') car.pitRequest = cmd.compound;
        break;
      case 'pace':
        if (car.status === 'running' || car.status === 'pitting') car.pace = cmd.mode;
        break;
      case 'teamOrder': {
        if (car.status !== 'running') break;
        const order = this.ranked();
        const mate = order[order.indexOf(car) + 1];
        const interval = mate ? (this.totalDist(car) - this.totalDist(mate)) / this.refSpeed() : Infinity;
        if (mate && mate.entry.teamId === car.entry.teamId && mate.status === 'running' && interval <= CONFIG.teamOrderRange) {
          car.yieldTo = mate.entry.carId;
          this.pushEvent(car, `${car.entry.carId} → ${mate.entry.carId} 양보 지시`);
        } else {
          this.pushEvent(car, `${car.entry.carId} 팀 오더 불가`);
        }
        break;
      }
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
      let ahead: CarState | undefined;
      for (let j = i - 1; j >= 0; j--) {
        if (order[j].status === 'running') {
          ahead = order[j];
          break;
        }
      }
      gaps.set(order[i], ahead ? (this.totalDist(ahead) - this.totalDist(order[i])) / this.refSpeed() : null);
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
    while (remaining > 1e-9 && (car.status === 'running' || car.status === 'pitting')) {
      if (guard++ > MAX_SEGMENTS_PER_TICK) throw new Error('advance: runaway segment loop');
      if (car.status === 'pitting') {
        remaining = this.advancePit(car, remaining);
        continue;
      }
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
      const pitEntry = this.circuit.pitEntry;
      if (car.pitRequest !== null && car.lapDist <= pitEntry && pitEntry <= car.lapDist + Math.min(speed * remaining, toEnd)) {
        const d = pitEntry - car.lapDist;
        this.move(car, d);
        car.lapDist = pitEntry;
        remaining -= d / speed;
        this.enterPit(car, t0 + (CONFIG.tickSeconds - remaining));
        continue;
      }
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

  protected enterPit(car: CarState, tEnter: number): void {
    car.status = 'pitting';
    car.inPitLane = true;
    car.pitElapsed = 0;
    car.pitTotal = pitTraverseTime(this.circuit, rollStopTime(this.rng));
    car.pitEnterTime = tEnter;
    car.pitCrossed = false;
    this.pushEvent(car, `${car.entry.carId} 피트인`);
  }

  /** Advances a car along the pit lane; returns the tick time left over. */
  protected advancePit(car: CarState, remaining: number): number {
    const used = Math.min(remaining, car.pitTotal - car.pitElapsed);
    car.pitElapsed += used;
    const f = car.pitTotal > 0 ? Math.min(1, car.pitElapsed / car.pitTotal) : 1;
    const laneDist = pitLaneDistance(this.circuit);
    const pos = this.circuit.pitEntry + laneDist * f;
    if (!car.pitCrossed && pos >= this.lapLen) {
      car.pitCrossed = true;
      const tCross = car.pitEnterTime + car.pitTotal * ((this.lapLen - this.circuit.pitEntry) / laneDist);
      this.crossLine(car, tCross);
      if (car.status === 'finished') {
        car.inPitLane = false;
        car.pitRequest = null;
        return 0;
      }
    }
    car.lapDist = car.pitCrossed ? pos - this.lapLen : pos;
    if (car.pitElapsed >= car.pitTotal - 1e-9) this.exitPit(car);
    return remaining - used;
  }

  protected exitPit(car: CarState): void {
    const next = car.pitRequest ?? car.compound;
    car.compound = next;
    car.wear = 0;
    if (!car.used.includes(next)) car.used.push(next);
    car.pitRequest = null;
    car.status = 'running';
    car.inPitLane = false;
    car.lapDist = this.circuit.pitExit;
    this.pushEvent(car, `${car.entry.carId} 피트 완료 (${next})`);
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
