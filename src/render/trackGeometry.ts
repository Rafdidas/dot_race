import type { Circuit } from '../engine/types';

export const VIEW_W = 480;
export const VIEW_H = 270;

export interface TrackGeometry {
  points: [number, number][];
  /** cum[i] = polyline length from point 0 to point i; cum[n] = full closed length. */
  cum: number[];
  total: number;
}

export interface TrackPoint {
  x: number;
  y: number;
  /** Heading in radians (canvas coordinates, y down). */
  angle: number;
}

export function buildTrackGeometry(c: Circuit): TrackGeometry {
  const points = c.path;
  const cum: number[] = [0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { points, cum, total: cum[cum.length - 1] };
}

/** Maps a distance along the lap (metres, any integer number of laps allowed) to a pixel position. */
export function pointAt(g: TrackGeometry, lapDist: number, lapLength: number): TrackPoint {
  const ratio = (((lapDist % lapLength) + lapLength) % lapLength) / lapLength;
  const target = ratio * g.total;
  const n = g.points.length;
  let i = 0;
  while (i < n - 1 && g.cum[i + 1] <= target) i++;
  const a = g.points[i];
  const b = g.points[(i + 1) % n];
  const span = g.cum[i + 1] - g.cum[i];
  const t = span > 0 ? (target - g.cum[i]) / span : 0;
  return {
    x: a[0] + (b[0] - a[0]) * t,
    y: a[1] + (b[1] - a[1]) * t,
    angle: Math.atan2(b[1] - a[1], b[0] - a[0]),
  };
}

export function integerScale(viewW: number, viewH: number): number {
  return Math.max(1, Math.floor(Math.min(viewW / VIEW_W, viewH / VIEW_H)));
}
