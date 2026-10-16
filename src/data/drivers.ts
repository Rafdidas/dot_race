import type { Driver, DriverStats } from '../engine/types';
import { TEAMS } from './teams';

// Fictional drivers. Team strength drives the baseline: tier 1 ~85, tier 11 ~68.
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const mk = (tier: number, lead: boolean, o: [number, number, number, number, number, number]): DriverStats => {
  const b = 85 - (tier - 1) * 1.7 + (lead ? 3 : -3);
  return {
    pace: clamp(b + o[0]),
    consistency: clamp(b + o[1]),
    tyreMgmt: clamp(b + o[2]),
    wet: clamp(b + o[3]),
    attack: clamp(b + o[4]),
    defense: clamp(b + o[5]),
  };
};

type Offsets = [number, number, number, number, number, number];
type Row = [id: string, name: string, number: number, teamId: string, offsets: Offsets];

const ROWS: Row[] = [
  ['valmont', '다리오 발몽', 7, 'ember', [3, -2, 1, 0, 4, -1]],
  ['rennick', '이슬라 레닉', 31, 'ember', [0, 4, 3, 2, -2, 3]],
  ['kessler', '요리스 케슬러', 2, 'volta', [4, 0, -1, -2, 3, 2]],
  ['arden', '토마스 아덴', 44, 'volta', [-1, 3, 4, 3, 0, 1]],
  ['marchetti', '엘리아스 마르케티', 12, 'argent', [2, 1, 0, 4, 1, -2]],
  ['halvard', '노르 할바르드', 63, 'argent', [0, 2, 3, -1, 2, 4]],
  ['corvin', '마테오 코르빈', 5, 'cardinal', [3, -3, 0, 1, 5, 0]],
  ['ostrander', '라파엘 오스트란더', 18, 'cardinal', [-2, 3, 2, 0, -1, 3]],
  ['duroy', '앙셀 뒤루아', 23, 'bluefin', [1, 2, -2, 3, 2, 0]],
  ['vasquez', '키란 바스케스', 77, 'bluefin', [2, -1, 4, -2, 3, 1]],
  ['brandvold', '레이프 브란볼드', 9, 'steelhorn', [0, 3, 1, 1, -1, 4]],
  ['pell', '오스카 펠', 52, 'steelhorn', [3, 0, -3, 2, 4, -2]],
  ['lacombe', '테오 라콩브', 14, 'verdant', [2, 2, 2, -1, 0, 1]],
  ['sandoval', '미라 산도발', 88, 'verdant', [-1, 4, 0, 4, 1, 2]],
  ['ferrant', '위고 페랑', 3, 'nova', [4, -2, 1, 0, 3, -1]],
  ['kamiya', '유토 카미야', 21, 'nova', [0, 1, 3, 2, -2, 3]],
  ['aldous', '스벤 알더스', 27, 'crimson', [1, 3, -1, 1, 2, 0]],
  ['ricci', '파올로 리치', 66, 'crimson', [3, -2, 2, -3, 4, 1]],
  ['hartmann', '벤노 하르트만', 10, 'tidewave', [0, 2, 3, 2, 0, 3]],
  ['delgado', '시러스 델가도', 41, 'tidewave', [2, 0, -2, 1, 3, -1]],
  ['winslow', '알로 윈슬로', 16, 'liberty', [1, 3, 1, 0, -1, 2]],
  ['okonkwo', '펠릭스 오콩쿼', 99, 'liberty', [3, -1, 0, 3, 2, 0]],
];

export const DRIVERS: Driver[] = ROWS.map(([id, name, number, teamId, o], i) => {
  const tier = TEAMS.find((t) => t.id === teamId)!.tier;
  return { id, name, number, teamId, stats: mk(tier, i % 2 === 0, o) };
});

export const getDriversOfTeam = (teamId: string): Driver[] => DRIVERS.filter((d) => d.teamId === teamId);
