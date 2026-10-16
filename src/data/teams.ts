import type { Team } from '../engine/types';

// Fictional teams; only the main colours are borrowed from real-world liveries.
// funds: tier 1 = 150, tier 11 = 70 (linear, integer millions).
// stats: base 82 (tier 1) .. 60 (tier 11), +/- personality offsets.
const base = (tier: number) => 82 - (tier - 1) * 2.2;
const funds = (tier: number) => 150 - (tier - 1) * 8;
const stats = (tier: number, o: [number, number, number, number]) => {
  const b = base(tier);
  const c = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  return { aero: c(b + o[0]), chassis: c(b + o[1]), power: c(b + o[2]), reliability: c(b + o[3]) };
};

export const TEAMS: Team[] = [
  { id: 'ember', name: '엠버 레이싱', color: '#FF8000', accent: '#1A1A1A', tier: 1, funds: funds(1), stats: stats(1, [2, 3, 0, -3]) },
  { id: 'volta', name: '볼타 레이싱', color: '#3671C6', accent: '#FFD23F', tier: 2, funds: funds(2), stats: stats(2, [4, 0, 1, -2]) },
  { id: 'argent', name: '아르장 프라임', color: '#27F4D2', accent: '#1A1A1A', tier: 3, funds: funds(3), stats: stats(3, [-1, 1, 4, 3]) },
  { id: 'cardinal', name: '카디널 모터스포츠', color: '#E8002D', accent: '#FFFFFF', tier: 4, funds: funds(4), stats: stats(4, [1, 2, 3, -4]) },
  { id: 'bluefin', name: '블루핀 레이싱', color: '#64C4FF', accent: '#0A2A5E', tier: 5, funds: funds(5), stats: stats(5, [0, 3, -2, 2]) },
  { id: 'steelhorn', name: '스틸혼', color: '#B6BABD', accent: '#D7262E', tier: 6, funds: funds(6), stats: stats(6, [-2, 1, 2, 4]) },
  { id: 'verdant', name: '버던트', color: '#229971', accent: '#CEDC00', tier: 7, funds: funds(7), stats: stats(7, [3, -1, 0, 1]) },
  { id: 'nova', name: '노바 주니어', color: '#6692FF', accent: '#FFFFFF', tier: 8, funds: funds(8), stats: stats(8, [1, 1, -1, 0]) },
  { id: 'crimson', name: '크림슨 포지', color: '#BB0A30', accent: '#C0C0C0', tier: 9, funds: funds(9), stats: stats(9, [-3, 2, 4, 0]) },
  { id: 'tidewave', name: '타이드웨이브', color: '#0093CC', accent: '#FF87BC', tier: 10, funds: funds(10), stats: stats(10, [2, -2, 1, 3]) },
  { id: 'liberty', name: '리버티 피크', color: '#C9A94A', accent: '#111111', tier: 11, funds: funds(11), stats: stats(11, [0, 0, -2, 2]) },
];

export const getTeam = (id: string): Team => {
  const t = TEAMS.find((x) => x.id === id);
  if (!t) throw new Error(`unknown team ${id}`);
  return t;
};
