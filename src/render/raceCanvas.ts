import { lapLength } from '../engine/circuit';
import type { Circuit, SessionSnapshot, Team } from '../engine/types';
import { drawCar } from './sprites';
import { buildTrackGeometry, integerScale, pointAt, VIEW_H, VIEW_W, type TrackGeometry } from './trackGeometry';

const GRASS = '#2e5d34';
const KERB = '#c9ccd2';
const ASPHALT = '#454a53';
const PIT_LANE = '#7a808a';
const PIT_OFFSET = 7; // px from the racing line

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Draws the pixel-art circuit and cars. All drawing happens at 480x270 and is scaled up by an integer factor. */
export class RaceCanvas {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly frame: HTMLCanvasElement;
  private readonly frameCtx: CanvasRenderingContext2D;
  private readonly track: HTMLCanvasElement;
  private readonly geometry: TrackGeometry;
  private readonly lapLen: number;
  private readonly teams: Map<string, Team>;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly circuit: Circuit,
    teams: Team[],
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas not available');
    this.ctx = ctx;
    this.frame = makeCanvas(VIEW_W, VIEW_H);
    this.frameCtx = this.frame.getContext('2d')!;
    this.track = makeCanvas(VIEW_W, VIEW_H);
    this.geometry = buildTrackGeometry(circuit);
    this.lapLen = lapLength(circuit);
    this.teams = new Map(teams.map((t) => [t.id, t]));
    this.paintTrack();
    this.resize(canvas.clientWidth || VIEW_W, canvas.clientHeight || VIEW_H);
  }

  /** Size the canvas to the largest integer multiple of 480x270 that fits the given box. */
  resize(viewW: number, viewH: number): void {
    const s = integerScale(viewW, viewH);
    this.canvas.width = VIEW_W * s;
    this.canvas.height = VIEW_H * s;
    this.canvas.style.imageRendering = 'pixelated';
    this.ctx.imageSmoothingEnabled = false;
  }

  private strokePath(ctx: CanvasRenderingContext2D, width: number, color: string): void {
    const pts = this.circuit.path;
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.stroke();
  }

  private paintTrack(): void {
    const ctx = this.track.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = GRASS;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.strokePath(ctx, 9, KERB);
    this.strokePath(ctx, 7, ASPHALT);

    // pit lane
    ctx.fillStyle = PIT_LANE;
    const start = this.circuit.pitEntry;
    const len = (this.circuit.pitExit - this.circuit.pitEntry + this.lapLen) % this.lapLen;
    for (let d = 0; d <= len; d += 15) {
      const p = this.lanePoint(start + d);
      ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
    }

    // chequered start/finish line across the track
    const s = pointAt(this.geometry, 0, this.lapLen);
    const nx = -Math.sin(s.angle);
    const ny = Math.cos(s.angle);
    for (let i = -4; i <= 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#111111';
      ctx.fillRect(Math.round(s.x + nx * i * 0.9), Math.round(s.y + ny * i * 0.9), 1, 1);
    }
  }

  /** A point on the pit lane: the racing line pushed sideways. */
  private lanePoint(dist: number): { x: number; y: number; angle: number } {
    const p = pointAt(this.geometry, dist, this.lapLen);
    return { x: p.x - Math.sin(p.angle) * PIT_OFFSET, y: p.y + Math.cos(p.angle) * PIT_OFFSET, angle: p.angle };
  }

  /** Interpolates between two snapshots (alpha 0..1) and paints one frame. */
  draw(prev: SessionSnapshot, curr: SessionSnapshot, alpha: number, highlight: string[]): void {
    const f = this.frameCtx;
    f.imageSmoothingEnabled = false;
    f.drawImage(this.track, 0, 0);
    const prevById = new Map(prev.cars.map((c) => [c.carId, c]));
    const marked = new Set(highlight);

    // back of the field first so the front runners are drawn on top
    for (let i = curr.cars.length - 1; i >= 0; i--) {
      const car = curr.cars[i];
      if (car.status === 'retired' || car.status === 'finished') continue;
      const before = prevById.get(car.carId) ?? car;
      let d1 = car.lapDist;
      if (d1 < before.lapDist - this.lapLen / 2) d1 += this.lapLen;
      const dist = before.lapDist + (d1 - before.lapDist) * alpha;
      const pos = car.inPitLane ? this.lanePoint(dist) : pointAt(this.geometry, dist, this.lapLen);
      const team = this.teams.get(car.teamId);
      drawCar(f, pos.x, pos.y, pos.angle, team?.color ?? '#999999', team?.accent ?? '#ffffff', marked.has(car.carId));
    }

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.frame, 0, 0, this.canvas.width, this.canvas.height);
  }

  dispose(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
