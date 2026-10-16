import type { Circuit, Segment, SegmentType } from '../../engine/types';

// Reference speeds (m/s) used to derive each segment's base time.
const SPEED: Record<SegmentType, number> = { straight: 80, slowCorner: 35, fastCorner: 60 };
const seg = (type: SegmentType, length: number): Segment => ({ type, length, baseTime: length / SPEED[type] });

// A stylised, simplified loop (480x270 canvas, 20px margin), inspired by a long
// street-park circuit in a southern harbour city. 48 points.
const path: [number, number][] = Array.from({ length: 48 }, (_, i) => {
  const t = (i / 48) * Math.PI * 2;
  const x = 240 + 200 * Math.cos(t) * (1 + 0.1 * Math.sin(3 * t));
  const y = 135 + 105 * Math.sin(t) * (1 + 0.12 * Math.cos(2 * t));
  return [Math.round(x), Math.round(y)];
});

export const SOUTHLAKE: Circuit = {
  id: 'southlake',
  name: '사우스레이크 서킷',
  location: '멜버른',
  path,
  segments: [
    seg('straight', 900),
    seg('slowCorner', 120),
    seg('fastCorner', 260),
    seg('straight', 700),
    seg('slowCorner', 100),
    seg('straight', 480),
    seg('fastCorner', 300),
    seg('slowCorner', 140),
    seg('straight', 600),
    seg('fastCorner', 220),
    seg('slowCorner', 90),
    seg('straight', 920),
    seg('fastCorner', 300),
    seg('slowCorner', 150),
  ],
  traits: {
    straightRatio: 0.55,
    tyreWear: 0.9,
    overtakeDifficulty: 0.5,
    pitLossSeconds: 19,
    realLaps: 58,
    rainChance: 0.15,
  },
  pitEntry: 5100,
  pitExit: 180,
};
