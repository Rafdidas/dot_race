import { SOUTHLAKE } from '../../src/data/circuits';
import { lapLength } from '../../src/engine/circuit';
import { buildTrackGeometry, integerScale, pointAt } from '../../src/render/trackGeometry';
import { carPixels, snapDirection } from '../../src/render/sprites';
import type { Circuit } from '../../src/engine/types';

// A 100x100 square, clockwise from the top-left: perimeter 400.
const square: Circuit = {
  ...SOUTHLAKE,
  path: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ],
  segments: [{ type: 'straight', length: 4000, baseTime: 50 }],
};
const L = lapLength(square);

test('pointAt(0) is the first path point, heading along the first edge', () => {
  const g = buildTrackGeometry(square);
  const p = pointAt(g, 0, L);
  expect([p.x, p.y]).toEqual([0, 0]);
  expect(p.angle).toBeCloseTo(0, 10);
});

test('pointAt follows the polyline proportionally, including the closing edge', () => {
  const g = buildTrackGeometry(square);
  const eighth = pointAt(g, L / 8, L);
  expect([eighth.x, eighth.y]).toEqual([50, 0]);
  const half = pointAt(g, L / 2, L);
  expect([half.x, half.y]).toEqual([100, 100]);
  const late = pointAt(g, (7 * L) / 8, L);
  expect(late.x).toBeCloseTo(0, 10);
  expect(late.y).toBeCloseTo(50, 10);
  expect(late.angle).toBeCloseTo(-Math.PI / 2, 10);
});

test('pointAt wraps at lapLength and for negative (grid) distances', () => {
  const g = buildTrackGeometry(square);
  const a = pointAt(g, L / 8, L);
  const b = pointAt(g, L + L / 8, L);
  expect(b.x).toBeCloseTo(a.x, 10);
  expect(b.y).toBeCloseTo(a.y, 10);
  const c = pointAt(g, -L / 8, L);
  const d = pointAt(g, (7 * L) / 8, L);
  expect(c.x).toBeCloseTo(d.x, 10);
  expect(c.y).toBeCloseTo(d.y, 10);
});

test('real circuit: geometry total is positive and pointAt stays inside the canvas', () => {
  const g = buildTrackGeometry(SOUTHLAKE);
  expect(g.total).toBeGreaterThan(500);
  for (let i = 0; i < 200; i++) {
    const p = pointAt(g, (lapLength(SOUTHLAKE) * i) / 200, lapLength(SOUTHLAKE));
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(480);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(270);
  }
});

test('integerScale', () => {
  expect(integerScale(1920, 1080)).toBe(4);
  expect(integerScale(300, 200)).toBe(1);
  expect(integerScale(1000, 600)).toBe(2);
  expect(integerScale(100, 100)).toBe(1);
});

test('sprites: 8 directions, deduplicated pixels, an accent stripe in each', () => {
  expect(snapDirection(0)).toBe(0);
  expect(snapDirection(Math.PI / 4 + 0.1)).toBe(1);
  expect(snapDirection(-Math.PI / 2)).toBe(6);
  expect(snapDirection(2 * Math.PI)).toBe(0);
  for (let d = 0; d < 8; d++) {
    const px = carPixels(d);
    expect(new Set(px.map((p) => `${p.dx},${p.dy}`)).size).toBe(px.length);
    expect(px.length).toBeGreaterThanOrEqual(9);
    if (d % 2 === 0) expect(px).toHaveLength(15);
    expect(px.filter((p) => p.part === 'accent').length).toBeGreaterThanOrEqual(1);
  }
});
