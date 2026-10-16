import { createRng } from '../../src/engine/rng';

test('same seed gives same sequence', () => {
  const a = createRng(42);
  const b = createRng(42);
  expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
});

test('different seeds differ', () => {
  expect(createRng(1).next()).not.toBe(createRng(2).next());
});

test('range/int/chance bounds', () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const x = r.range(2, 3);
    expect(x).toBeGreaterThanOrEqual(2);
    expect(x).toBeLessThan(3);
    const n = r.int(1, 6);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(6);
  }
  expect(r.chance(0)).toBe(false);
  expect(r.chance(1)).toBe(true);
});

test('normal has mean near 0', () => {
  const r = createRng(9);
  let s = 0;
  for (let i = 0; i < 5000; i++) s += r.normal();
  expect(Math.abs(s / 5000)).toBeLessThan(0.05);
});
