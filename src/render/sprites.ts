export interface CarPixel {
  dx: number;
  dy: number;
  part: 'body' | 'accent';
}

/** Car facing +x: a 5x3 body with a one-pixel accent stripe down the middle. */
const BASE: CarPixel[] = [];
for (let dx = -2; dx <= 2; dx++) {
  for (let dy = -1; dy <= 1; dy++) {
    BASE.push({ dx, dy, part: dy === 0 && Math.abs(dx) <= 1 ? 'accent' : 'body' });
  }
}

/** Snaps a heading (radians) to one of 8 directions: 0 = +x, increasing clockwise on screen. */
export function snapDirection(angle: number): number {
  const k = Math.round(angle / (Math.PI / 4));
  return ((k % 8) + 8) % 8;
}

const CACHE: CarPixel[][] = [];

/** Pixel offsets for a car facing direction `dir` (0..7); rotated offsets are rounded and deduplicated. */
export function carPixels(dir: number): CarPixel[] {
  const cached = CACHE[dir];
  if (cached) return cached;
  const theta = (dir * Math.PI) / 4;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const seen = new Map<string, CarPixel>();
  for (const p of BASE) {
    const dx = Math.round(p.dx * cos - p.dy * sin);
    const dy = Math.round(p.dx * sin + p.dy * cos);
    const key = `${dx},${dy}`;
    const prev = seen.get(key);
    if (!prev || (prev.part === 'body' && p.part === 'accent')) seen.set(key, { dx, dy, part: p.part });
  }
  const out = [...seen.values()];
  CACHE[dir] = out;
  return out;
}

export function drawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string,
  accent: string,
  highlight = false,
): void {
  const px = carPixels(snapDirection(angle));
  const cx = Math.round(x);
  const cy = Math.round(y);
  if (highlight) {
    ctx.fillStyle = '#ffffff';
    for (const p of px) {
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) ctx.fillRect(cx + p.dx + ox, cy + p.dy + oy, 1, 1);
    }
  }
  for (const p of px) {
    ctx.fillStyle = p.part === 'accent' ? accent : color;
    ctx.fillRect(cx + p.dx, cy + p.dy, 1, 1);
  }
}
