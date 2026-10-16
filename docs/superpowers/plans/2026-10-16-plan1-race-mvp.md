# Plan 1: 레이스 MVP 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저에서 팀을 고르고, 세팅과 시작 타이어를 정한 뒤, 도트 서킷 위에서 22대가 달리는 레이스 1판을 실시간으로 관전하며 피트/페이스/팀 오더 지시를 내리고 결과표까지 보는 단일 레이스 버전.

**Architecture:** `src/engine/`은 브라우저 API 없는 순수 TypeScript 시뮬레이션이다. 0.25초 고정 틱과 시드 RNG를 쓰고, `RaceSim`이 `SessionSim` 인터페이스를 구현한다. `src/store/`의 루프가 배속만큼 `step()`을 호출하고, `src/render/`의 Canvas 렌더러와 `src/ui/`의 React 패널이 스냅샷을 읽는다. 지시는 `enqueue(Command)`로만 엔진에 들어간다.

**Tech Stack:** Node 24, Vite 5.4.10, React 18.3.1, TypeScript 5.6.3, Zustand 4.5.5, Vitest 2.1.4.

**Spec:** `docs/superpowers/specs/2026-10-16-dot-race-design.md` (실행자는 이 계획과 스펙을 함께 읽는다)

## 전체 로드맵 (이 문서는 Plan 1만 다룬다)

스펙의 범위가 커서 계획을 5개로 나눈다. 각 계획은 그 자체로 동작하는 결과물을 낸다. Plan 2 이후는 앞 계획이 끝난 뒤 실제 코드를 보고 작성한다.

| 계획 | 결과물 | 스펙 |
|---|---|---|
| **Plan 1 (이 문서)** | 단일 레이스: 엔진 코어, 타이어/피트/페이스/추월/2종 컴파운드 규칙, 렌더러, 세션 화면 | 4.1~4.7, 4.9, 6.1~6.6 |
| Plan 2 | 퀄리파잉, 파르크 페르메, 포인트/챔피언십, 시즌 허브/결과/종료 화면, 저장 | 3, 4.10, 7, 8 |
| Plan 3 | 팩토리: 개발 프로젝트, 예산, 코스트캡, 풍동 제한, 수리비, AI 개발 | 5 |
| Plan 4 | 날씨, 실수, 고장, SC/VSC, AI 전략가 고도화 | 4.4(웻), 4.8, 4.11 |
| Plan 5 | 밸런싱 스크립트, 나머지 서킷 데이터(총 24개), 배포 점검 | 9.2, 10 |

## Global Constraints

- 엔진(`src/engine/**`)은 `window`, `document`, `Date.now`, `Math.random`, React를 import하거나 사용하지 않는다. 랜덤은 모두 `Rng`를 쓴다.
- 고정 틱 `TICK_SECONDS = 0.25`. 배속은 `0 | 1 | 4 | 8 | 16`, 기본값 4.
- 같은 시드 + 같은 엔트리 + 같은 명령 시퀀스이면 결과가 비트 단위로 같아야 한다.
- 모든 밸런스 수치는 `src/engine/config.ts`의 `CONFIG`에만 둔다. 다른 파일에 매직 넘버를 두지 않는다.
- 레이스 랩 수 = `max(12, round(realLaps * 0.28))`.
- 실제 F1 팀/드라이버/서킷 이름, "F1", "Formula 1", "Grand Prix"를 코드, 데이터, UI 문자열 어디에도 쓰지 않는다.
- 내부 캔버스 해상도는 480×270이고, `image-rendering: pixelated`로 정수 배율 확대한다.
- UI 문자열은 한국어로 쓴다.
- TypeScript는 `strict: true`로 설정한다.
- 각 Task의 커밋 단계는 `git add -A && git commit -m "<메시지>"`이다. 메시지 끝에 저장소 규칙의 Co-Authored-By 줄을 붙인다.

## Review Focus

1. **탭이 백그라운드에 갔다 돌아올 때:** `requestAnimationFrame`이 멈췄다가 큰 dt가 들어와도, 한 프레임에 레이스가 몇 분씩 건너뛰면 안 된다. 실시간 dt를 프레임당 최대 0.25초로 자른다 → Task 9 `computeSteps` 테스트.
2. **이미 피트 중이거나 리타이어/완주한 차에 지시를 보낼 때:** 지시는 무시되고 상태가 깨지지 않아야 한다 → Task 6 테스트.
3. **현재와 같은 컴파운드로 피트할 때:** 새 타이어(마모 0)로 교체되지만, 사용 컴파운드 종류 수는 늘지 않는다 → Task 6 테스트.
4. **리더가 완주했을 때 랩다운 차량:** 다음 결승선 통과 시 완주 처리되고, 결과는 (완료 랩 수 내림차순, 완주 시간 오름차순)으로 정렬된다 → Task 5 테스트.
5. **한 틱에 짧은 구간 여러 개를 지나갈 때:** 구간 경계를 넘는 이동이 루프로 처리되어 거리가 사라지지 않아야 한다 → Task 4 테스트.

---

## 파일 구조

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore
src/
  main.tsx                     React 진입점
  App.tsx                      화면 전환 (setup → race → result)
  engine/
    rng.ts                     Rng (mulberry32)
    config.ts                  CONFIG (모든 수치)
    types.ts                   공용 타입
    circuit.ts                 랩 길이, 구간 탐색, 레이스 랩 수, 최적 세팅
    race/
      laptime.ts               segmentTime(), wearPerLap()
      raceSim.ts               RaceSim (SessionSim 구현): 이동, 랩, 완주, 결과
      pit.ts                   피트 진입/손실/교체
      overtake.ts              추월 판정, 블로킹
      rules.ts                 2종 컴파운드 규칙, 결과 정렬
    ai/
      simpleStrategy.ts        AI 1스톱 계획 (Plan 4에서 교체)
  data/
    teams.ts, drivers.ts
    circuits/southlake.ts      1라운드 서킷 (호주 참고)
    circuits/index.ts
  render/
    trackGeometry.ts           경로 → 픽셀 좌표 매핑
    sprites.ts                 차량 도트 스프라이트
    raceCanvas.ts              RaceCanvas 클래스
  store/
    loop.ts                    computeSteps()
    raceStore.ts               Zustand 스토어 + rAF 루프
  ui/
    SetupScreen.tsx            팀 선택, 세팅 슬라이더, 시작 타이어
    session/SessionScreen.tsx, TopBar.tsx, TimingTower.tsx, CarPanel.tsx, EventLog.tsx
    ResultScreen.tsx
    styles.css
tests/engine/*.test.ts, tests/store/*.test.ts
```

---

### Task 1: 프로젝트 골격과 RNG

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/engine/rng.ts`
- Test: `tests/engine/rng.test.ts`

**Interfaces:**
- Produces: `createRng(seed: number): Rng`. `Rng` 메서드는 `next(): number` ([0,1)), `range(min: number, max: number): number`, `int(min: number, maxInclusive: number): number`, `chance(p: number): boolean`, `normal(): number` (평균 0, 표준편차 1).
- Produces: npm 스크립트 `dev`, `build`, `test` (`vitest run`), `typecheck` (`tsc --noEmit`).

- [ ] **Step 1: 골격 파일 작성**

`npm create vite`는 비어 있지 않은 폴더에서 대화형 질문을 하므로 쓰지 않는다. 파일을 직접 만든다.
- dependencies: react@18.3.1, react-dom@18.3.1, zustand@4.5.5
- devDependencies: vite@5.4.10, @vitejs/plugin-react@4.3.3, typescript@5.6.3, vitest@2.1.4, @types/react@18.3.12, @types/react-dom@18.3.1
- `vite.config.ts`에 `test: { include: ['tests/**/*.test.ts'] }`를 넣는다.
- `.gitignore`: `node_modules`, `dist`
- `App.tsx`는 "dot-race"만 표시한다.

Run: `npm install`

- [ ] **Step 2: 실패하는 테스트 작성**

```ts
import { createRng } from '../../src/engine/rng';
test('same seed gives same sequence', () => {
  const a = createRng(42), b = createRng(42);
  expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
});
test('different seeds differ', () => {
  expect(createRng(1).next()).not.toBe(createRng(2).next());
});
test('range/int/chance bounds', () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const x = r.range(2, 3); expect(x).toBeGreaterThanOrEqual(2); expect(x).toBeLessThan(3);
    const n = r.int(1, 6); expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(6);
  }
  expect(r.chance(0)).toBe(false); expect(r.chance(1)).toBe(true);
});
test('normal has mean near 0', () => {
  const r = createRng(9); let s = 0;
  for (let i = 0; i < 5000; i++) s += r.normal();
  expect(Math.abs(s / 5000)).toBeLessThan(0.05);
});
```

- [ ] **Step 3: 실패 확인** — Run: `npm test` / Expected: FAIL (모듈 없음)

- [ ] **Step 4: `src/engine/rng.ts` 구현** — mulberry32를 쓰고, `normal()`은 Box-Muller로 구현한다.

- [ ] **Step 5: 통과 확인** — Run: `npm test && npm run typecheck && npm run build` / Expected: 모두 성공

- [ ] **Step 6: 커밋** — `git add -A && git commit -m "chore: scaffold vite react-ts project with seeded rng"`

---

### Task 2: 타입, CONFIG, 게임 데이터

**Files:**
- Create: `src/engine/types.ts`, `src/engine/config.ts`, `src/data/teams.ts`, `src/data/drivers.ts`
- Test: `tests/engine/data.test.ts`

**Interfaces:**
- Produces (`types.ts`):

```ts
export type Compound = 'S' | 'M' | 'H';          // Plan 4에서 'I' | 'W' 추가
export type PaceMode = 'push' | 'normal' | 'save';
export type SegmentType = 'straight' | 'slowCorner' | 'fastCorner';
export interface CarStats { aero: number; chassis: number; power: number; reliability: number }
export interface DriverStats { pace: number; consistency: number; tyreMgmt: number; wet: number; attack: number; defense: number }
export interface Team { id: string; name: string; color: string; accent: string; tier: number; funds: number; stats: CarStats }
export interface Driver { id: string; name: string; number: number; teamId: string; stats: DriverStats }
export interface Segment { type: SegmentType; length: number; baseTime: number }
export interface CircuitTraits { straightRatio: number; tyreWear: number; overtakeDifficulty: number; pitLossSeconds: number; realLaps: number; rainChance: number }
export interface Circuit { id: string; name: string; location: string; path: [number, number][]; segments: Segment[]; traits: CircuitTraits; pitEntry: number; pitExit: number }
```

`pitEntry`와 `pitExit`은 랩 시작선 기준 거리(m)다. 보통 `pitEntry > pitExit`이다(결승선을 사이에 둔다).

- Produces (`config.ts`): `export const CONFIG = { ... } as const`. Plan 1에서 쓰는 키와 초기값은 아래와 같다.

| 키 | 값 | 의미 |
|---|---|---|
| `tickSeconds` | 0.25 | |
| `lapScale` | 0.28 | |
| `minRaceLaps` | 12 | |
| `compoundOffset` | `{S:0, M:0.6, H:1.1}` | 초/랩 |
| `baseWearPerLap` | `{S:9, M:6, H:4}` | %/랩 |
| `wearCliffStart` | 70 | % |
| `wearLossAtCliff` | 1.0 | 마모 70%일 때 초/랩 손실 |
| `wearCliffK` | 0.004 | (wear−70)² × K 초/랩 추가 |
| `paceModeTime` | `{push:-0.004, normal:0, save:0.006}` | 구간 시간 배율 가산 |
| `paceModeWear` | `{push:1.3, normal:1.0, save:0.75}` | |
| `carPerfK` | 0.04 | 수치 100일 때 −4% (50 기준) |
| `driverPaceK` | 0.02 | |
| `setupPenaltyK` | 0.03 | 세팅 이차 패널티 배율 |
| `fuelMaxLapPenalty` | 1.5 | 초/랩 |
| `dirtyAirRange` | 1.5 | 초 |
| `dirtyAirK` | 0.012 | 코너 구간 시간 배율 최대 가산 |
| `noiseSigma` | 0.002 | 구간 시간 배율 표준편차 |
| `overtakeWindow` | 1.0 | 초 |
| `overtakeModeGain` | 0.01 | 직선 구간 시간 −1% |
| `overtakeBase` | 0.35 | |
| `overtakePaceK` | 0.25 | 랩타임 초 차이당 확률 가산 |
| `overtakeSkillK` | 0.003 | (attack−defense) 1점당 |
| `overtakeDifficultyK` | 0.3 | |
| `overtakeClamp` | `[0.05, 0.95]` | |
| `heldGapMeters` | 8 | 추월 실패 시 앞차와 유지 거리 |
| `pitStopTime` | `[2.2, 3.0]` | 초 |
| `slowStopChance` | 0.05 | |
| `slowStopExtra` | `[2, 6]` | 초 |
| `gridSpacing` | 8 | m |
| `startDelay` | `[0.1, 0.6]` | 초, (1.2 − consistency/100) 배율 |
| `teamOrderRange` | 2.0 | 초 |

- Produces (`data/`): `TEAMS: Team[]`(11개), `DRIVERS: Driver[]`(22명), `getTeam(id)`, `getDriversOfTeam(teamId)`.

팀 데이터. `funds`는 tier 1이 150M이고 tier 11이 70M인 선형값(정수 M)이다. 차량 수치 4개는 tier 1이 82이고 tier 11이 60인 선형값을 기준으로, 항목마다 ±4 범위에서 팀 성격을 준다.

| id | name | color | accent | tier |
|---|---|---|---|---|
| ember | 엠버 레이싱 | #FF8000 | #1A1A1A | 1 |
| volta | 볼타 레이싱 | #3671C6 | #FFD23F | 2 |
| argent | 아르장 프라임 | #27F4D2 | #1A1A1A | 3 |
| cardinal | 카디널 모터스포츠 | #E8002D | #FFFFFF | 4 |
| bluefin | 블루핀 레이싱 | #64C4FF | #0A2A5E | 5 |
| steelhorn | 스틸혼 | #B6BABD | #D7262E | 6 |
| verdant | 버던트 | #229971 | #CEDC00 | 7 |
| nova | 노바 주니어 | #6692FF | #FFFFFF | 8 |
| crimson | 크림슨 포지 | #BB0A30 | #C0C0C0 | 9 |
| tidewave | 타이드웨이브 | #0093CC | #FF87BC | 10 |
| liberty | 리버티 피크 | #C9A94A | #111111 | 11 |

드라이버는 팀당 2명이고 이름은 가상이다(실존 레이서와 겹치지 않게). 번호는 2~99 범위에서 중복 없이 정한다. 능력치는 팀 tier가 높을수록 평균이 높게(tier 1 평균 약 85, tier 11 평균 약 68), 항목마다 개성을 준다.

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/engine/data.test.ts`)

```ts
test('11 teams with unique ids and tiers 1..11', ...)       // tier 집합 = {1..11}
test('22 drivers, exactly 2 per team, unique numbers', ...)
test('all stats in 0..100', ...)
test('no banned real-world words in data', () => {
  const text = JSON.stringify({ TEAMS, DRIVERS }).toLowerCase();
  for (const w of ['f1', 'formula', 'grand prix', 'ferrari', 'mercedes', 'mclaren', 'red bull', 'williams', 'alpine', 'aston', 'haas', 'sauber', 'audi', 'cadillac', 'racing bulls'])
    expect(text).not.toContain(w);
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL

- [ ] **Step 3: `types.ts`, `config.ts`, `data/teams.ts`, `data/drivers.ts` 작성**

- [ ] **Step 4: 통과 확인** — Run: `npm test && npm run typecheck` / Expected: PASS

- [ ] **Step 5: 커밋** — `feat(engine): add core types, config and fictional team/driver data`

---

### Task 3: 서킷 데이터와 서킷 유틸

**Files:**
- Create: `src/engine/circuit.ts`, `src/data/circuits/southlake.ts`, `src/data/circuits/index.ts`
- Test: `tests/engine/circuit.test.ts`

**Interfaces:**
- Consumes: `Circuit`, `Segment` (Task 2), `CONFIG`
- Produces (`circuit.ts`):
  - `lapLength(c: Circuit): number`: 구간 길이 합
  - `lapBaseTime(c: Circuit): number`: 구간 baseTime 합
  - `segmentAt(c: Circuit, dist: number): { index: number; start: number }`: `dist`는 [0, lapLength)
  - `raceLaps(c: Circuit): number`: `max(minRaceLaps, round(realLaps * lapScale))`
  - `optimalSetup(c: Circuit): number`: `round(100 * (1 - straightRatio))`, 0~100으로 clamp
  - `straightRatioOf(c: Circuit): number`: 직선 구간 baseTime 합 / 전체
- Produces (`data/circuits`): `SOUTHLAKE: Circuit`, `CIRCUITS: Circuit[]` (Plan 1은 1개)

SOUTHLAKE(호주 참고): `name` "사우스레이크 서킷", `location` "멜버른". 랩 길이 약 5,280m, 구간 14개 내외, baseTime 합 약 80초, `traits = { straightRatio: 0.55, tyreWear: 0.9, overtakeDifficulty: 0.5, pitLossSeconds: 19, realLaps: 58, rainChance: 0.15 }`. `path`는 480×270 캔버스 안(여백 20px)에 실제 레이아웃을 단순화한 닫힌 폴리라인으로, 점 40~80개 정도다. `traits.straightRatio`는 구간 데이터로 계산한 값과 ±0.05 안에서 일치해야 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test('raceLaps: 58 real laps -> 16', () => expect(raceLaps(SOUTHLAKE)).toBe(16));
test('raceLaps floor at 12', () => expect(raceLaps({ ...SOUTHLAKE, traits: { ...SOUTHLAKE.traits, realLaps: 20 } })).toBe(12));
test('segmentAt finds containing segment', ...)  // 0 -> index 0, 첫 구간 길이 -> index 1, lapLength-0.01 -> 마지막
test('optimalSetup from straightRatio', () => expect(optimalSetup(SOUTHLAKE)).toBe(45));
test('southlake data consistent', () => {
  expect(Math.abs(straightRatioOf(SOUTHLAKE) - SOUTHLAKE.traits.straightRatio)).toBeLessThanOrEqual(0.05);
  expect(SOUTHLAKE.pitEntry).toBeLessThan(lapLength(SOUTHLAKE));
  for (const [x, y] of SOUTHLAKE.path) { expect(x).toBeGreaterThanOrEqual(20); expect(x).toBeLessThanOrEqual(460); expect(y).toBeGreaterThanOrEqual(20); expect(y).toBeLessThanOrEqual(250); }
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL

- [ ] **Step 3: `circuit.ts`와 서킷 데이터 구현**

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS

- [ ] **Step 5: 커밋** — `feat(engine): add circuit utilities and Southlake circuit`

---

### Task 4: 랩타임 모델

**Files:**
- Create: `src/engine/race/laptime.ts`
- Test: `tests/engine/laptime.test.ts`

**Interfaces:**
- Consumes: `CONFIG`, 타입들
- Produces:

```ts
export interface SegmentContext {
  segment: Segment; lapBaseTime: number;
  car: CarStats; driver: DriverStats;
  setup: number; optimalSetup: number;
  compound: Compound; wear: number;       // 0..100
  raceProgress: number;                    // 0..1 (리더 기준 아님, 자기 자신의 완료 거리 / 총 거리)
  pace: PaceMode;
  gapAhead: number | null;                 // 초, 앞차 없으면 null
  noise: number;                           // rng.normal() 값을 호출자가 넘김
}
export function segmentTime(ctx: SegmentContext): number;
export function wearPerLap(compound: Compound, tyreWearTrait: number, pace: PaceMode, tyreMgmt: number, chassis: number): number;
```

계산 순서(배율은 `baseTime`에 곱하고, 초/랩 항목은 `segment.baseTime / lapBaseTime` 비율로 나눠 더한다):
1. 차량 성능 배율: `1 − carPerfK × (eff − 50) / 50`. `eff`는 직선 구간이면 `power`, 저속 코너면 `0.7·chassis + 0.3·aero`, 고속 코너면 `0.7·aero + 0.3·chassis`.
2. 드라이버 배율: `1 − driverPaceK × (pace − 50) / 50`
3. 세팅 패널티 배율: 직선 구간은 `b > opt`일 때 `+ setupPenaltyK × ((b − opt) / 50)²`, 코너 구간은 `b < opt`일 때 같은 식으로 `(opt − b)`를 넣는다. 즉 다운포스가 과하면 직선에서, 부족하면 코너에서 손해를 본다. 스펙 4.3의 "최적에서 멀어질수록 손실"을 구간 종류별로 구현한 것이다.
4. 페이스 모드 배율: `+ paceModeTime[pace]`
5. 직선 구간이고 `gapAhead ≤ overtakeWindow`이면 `− overtakeModeGain` (오버테이크 모드)
6. 코너 구간이고 `gapAhead < dirtyAirRange`이면 `+ dirtyAirK × (dirtyAirRange − gap) / dirtyAirRange × (1 − aero / 200)`
7. 노이즈: `+ noiseSigma × noise`
8. 초/랩 항목: `compoundOffset[compound]`, 타이어 손실(`wear ≤ 70`이면 `wearLossAtCliff × wear / 70`, 그 이상이면 `wearLossAtCliff + wearCliffK × (wear − 70)²`), 연료 `fuelMaxLapPenalty × (1 − raceProgress)`.

`wearPerLap = baseWearPerLap[c] × tyreWearTrait × paceModeWear[pace] × (1.2 − tyreMgmt / 250) × (1.1 − chassis / 500)`

- [ ] **Step 1: 실패하는 테스트 작성** — 기준 컨텍스트 `base`(모든 수치 50, setup = opt, M, wear 0, progress 1, normal, gap null, noise 0)에서 한 항목씩 바꿔 비교한다.

```ts
test('higher power is faster on straight, not on slow corner', ...)
test('higher aero is faster on fast corner', ...)
test('setup above optimal hurts straights only; below hurts corners only', ...)
test('soft faster than medium faster than hard at zero wear', ...)
test('wear loss grows faster past 70% (cliff)', ...)   // (loss(90)-loss(80)) > (loss(60)-loss(50)) * 3
test('fuel: progress 0 slower than progress 1 by fuelMaxLapPenalty share', ...)
test('push faster, save slower', ...)
test('dirty air slows corners within 1.5s; high aero suffers less', ...)
test('overtake mode speeds straights within 1.0s', ...)
test('wearPerLap: soft > medium > hard; push > save; better tyreMgmt lower', ...)
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL

- [ ] **Step 3: `laptime.ts` 구현**

- [ ] **Step 4: 통과 확인** — Expected: PASS

- [ ] **Step 5: 커밋** — `feat(engine): add segment lap time and tyre wear model`

---

### Task 5: RaceSim 코어 (이동, 랩, 완주, 결과)

**Files:**
- Create: `src/engine/race/raceSim.ts`, `src/engine/race/rules.ts`
- Modify: `src/engine/types.ts` (세션 타입 추가)
- Test: `tests/engine/raceSim.test.ts`, `tests/engine/rules.test.ts`

**Interfaces:**
- Consumes: Task 1~4 전부
- Produces (`types.ts`에 추가):

```ts
export interface RaceEntry { carId: string; teamId: string; car: CarStats; driver: DriverStats; setup: number; startCompound: Compound }
export type Command =
  | { tick: number; carId: string; kind: 'pit'; compound: Compound }
  | { tick: number; carId: string; kind: 'pace'; mode: PaceMode }
  | { tick: number; carId: string; kind: 'teamOrder' };          // carId 차가 팀메이트에게 양보
export type CarStatus = 'running' | 'pitting' | 'retired' | 'finished';
export interface CarSnapshot {
  carId: string; teamId: string; position: number; status: CarStatus;
  lap: number; totalDist: number; lapDist: number; inPitLane: boolean;
  compound: Compound; wear: number; usedCompounds: Compound[]; pace: PaceMode; pitRequest: Compound | null;
  gapToLeader: number; interval: number;  // 초
  lastLap: number | null; bestLap: number | null;
}
export interface RaceEvent { tick: number; lap: number; text: string }
export interface SessionSnapshot { tick: number; time: number; lapsTotal: number; leaderLap: number; cars: CarSnapshot[]; events: RaceEvent[]; finished: boolean }
export interface ResultRow { carId: string; teamId: string; position: number; laps: number; time: number | null; status: 'finished' | 'retired' | 'dsq'; bestLap: number | null; usedCompounds: Compound[] }
export interface SessionResult { rows: ResultRow[] }
export interface SessionSim { step(): void; enqueue(cmd: Command): void; snapshot(): SessionSnapshot; isFinished(): boolean; result(): SessionResult }
```

- Produces (`raceSim.ts`): `new RaceSim({ circuit: Circuit; entries: RaceEntry[]; grid: string[]; seed: number; aiCarIds: string[] })`. `grid`는 carId의 출발 순서다. Plan 1에서 플레이어 팀이 아닌 차는 모두 `aiCarIds`에 넣는다.
- Produces (`rules.ts`):
  - `violatesCompoundRule(used: Compound[]): boolean`: 드라이 컴파운드 종류가 2 미만이면 true. Plan 4에서 I/W 면제를 추가한다.
  - `sortResults(rows: ResultRow[]): ResultRow[]`: 순서는 finished/retired 무관하게 (laps 내림차순, 같은 랩이면 완주 시간 또는 마지막 통과 시간 오름차순), 그다음 dsq를 맨 뒤에 두고 position을 다시 매긴다.

동작:
- 출발: `totalDist = −gridIndex × gridSpacing`. 각 차는 `startDelay × (1.2 − consistency/100)` 초 동안 정지한다(시드 랜덤).
- `step()`: 각 running 차의 구간 시간을 `segmentTime`으로 구하고, 속도 `segment.length / time`으로 0.25초만큼 전진한다. 한 틱에 구간 경계를 넘으면 남은 시간으로 다음 구간을 계속 계산한다(루프).
- 마모는 `wearPerLap × (이동 거리 / lapLength)`로 누적하고 100에서 멈춘다.
- 랩: `lap = floor(totalDist / lapLength)`. 결승선을 넘을 때 랩타임을 기록한다.
- 완주: 리더가 `lapsTotal × lapLength`에 도달하면 완주한다. 그 이후 다른 차는 결승선을 다음에 넘을 때 완주(랩다운 포함)한다. finished/retired가 아닌 차가 없으면 `isFinished() = true`.
- 순위: running 차는 totalDist 내림차순, finished 차는 완주 순서대로 위에 둔다.
- 갭: `gapToLeader = (leaderDist − dist) / (lapLength / lapBaseTime)`, interval은 바로 앞 차와의 같은 계산.
- 결과에서 `violatesCompoundRule`이면 status를 `'dsq'`로 바꾼다.
- 이벤트: 피트 진입, 추월, 완주를 `RaceEvent`로 남긴다. 스냅샷에는 최근 50개만 담는다.

- [ ] **Step 1: 실패하는 테스트 작성** — 22대 엔트리를 만드는 헬퍼 `makeRace(seed, overrides?)`를 `tests/engine/helpers.ts`에 둔다. 모든 차에 1스톱 지시를 미리 넣어 2종 규칙을 지키게 한다.

```ts
test('deterministic: same seed same result', ...)          // result() 깊은 비교
test('runs to completion within lapsTotal*lapBaseTime*1.5/0.25 steps', ...)
test('stronger car (all stats +20) finishes ahead on average over 20 seeds', ...)
test('lapped car finishes on next line crossing with fewer laps; sorted after lead-lap cars', ...)  // Review Focus 4
test('crossing several short segments in one tick conserves distance', ...)  // Review Focus 5: 구간 1m짜리 서킷으로 이동 거리 = 속도 적분과 일치
test('wear accumulates and caps at 100', ...)
// rules.test.ts
test('violatesCompoundRule', () => { expect(violatesCompoundRule(['M'])).toBe(true); expect(violatesCompoundRule(['M','M'])).toBe(true); expect(violatesCompoundRule(['M','H'])).toBe(false); });
test('car without second compound is dsq and sorted last', ...)
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL

- [ ] **Step 3: `rules.ts`, `raceSim.ts` 구현** (피트·추월·AI는 이 시점에 없음. 차들은 서로 겹쳐 지나갈 수 있음)

- [ ] **Step 4: 통과 확인** — Expected: PASS

- [ ] **Step 5: 커밋** — `feat(engine): add race simulation core with laps, finish and results`

---

### Task 6: 피트스톱, 페이스 모드, 팀 오더 지시

**Files:**
- Create: `src/engine/race/pit.ts`
- Modify: `src/engine/race/raceSim.ts`
- Test: `tests/engine/pit.test.ts`

**Interfaces:**
- Consumes: `RaceSim`, `Command`
- Produces (`pit.ts`):
  - `pitLaneDistance(c: Circuit): number`: `(pitExit − pitEntry + lapLength) % lapLength`
  - `rollStopTime(rng: Rng): number`: `pitStopTime` 범위 균등 분포, `slowStopChance` 확률로 `slowStopExtra`만큼 추가
  - `pitTraverseTime(c: Circuit, stopTime: number): number`: `lapBaseTime × laneDist / lapLength + pitLossSeconds + stopTime`

동작:
- `enqueue`된 명령은 `cmd.tick ≤ 현재 tick`이 되는 첫 `step()` 시작 시점에 적용한다.
- `pit`: `pitRequest`를 설정한다. 차가 이번 틱에 `pitEntry`를 지나가면 `status='pitting'`, `inPitLane=true`가 된다. 피트레인 구간은 `pitTraverseTime` 동안 일정 속도로 이동하고, 다른 차와 추월/블로킹 상호작용을 하지 않는다. `pitExit`에 도착하면 compound 교체, wear 0, `usedCompounds`에 추가(중복 없이), `pitRequest=null`, `status='running'`.
- 같은 컴파운드로 교체해도 wear는 0이 되고, `usedCompounds` 종류 수는 그대로다.
- 이미 pitting/retired/finished인 차에 보낸 `pit` 명령은 무시한다. running 차의 `pit` 명령은 `pitRequest`를 덮어쓴다(취소는 v1에 없음).
- 레이스 마지막 랩(리더가 완주한 이후 포함)에는 피트 진입을 막지 않는다(실제처럼 손해일 뿐).
- `pace`: 즉시 `pace` 변경. retired/finished면 무시.
- `teamOrder`: 같은 팀 차가 바로 뒤에 있고 `interval ≤ teamOrderRange`이면 `yieldTo = 팀메이트 carId`를 설정한다. 다음 직선 구간에서 추월 판정 없이 뒤차를 보내준다(Task 7의 추월 로직이 참조). 조건이 안 맞으면 무시하고 이벤트 "팀 오더 불가"를 남긴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test('pit request: car enters, loses about pitLoss+stop time, exits on new compound with 0 wear', ...)
test('usedCompounds grows only for new compound', ...)                 // Review Focus 3
test('pit command to pitting/retired/finished car is ignored', ...)     // Review Focus 2
test('rollStopTime within [2.2,3.0] mostly, slow stops ~5% over 2000 rolls', ...)
test('pace push increases wear vs normal over a lap', ...)
test('teamOrder outside 2.0s range is ignored with event', ...)
test('command with future tick is applied at that tick, not before', ...)
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Expected: PASS (Task 5 테스트 포함 전체)
- [ ] **Step 5: 커밋** — `feat(engine): add pit stops, pace modes and team orders`

---

### Task 7: 추월과 블로킹, AI 단순 전략

**Files:**
- Create: `src/engine/race/overtake.ts`, `src/engine/ai/simpleStrategy.ts`
- Modify: `src/engine/race/raceSim.ts`, `tests/engine/helpers.ts` (사전 지시 제거, AI가 처리)
- Test: `tests/engine/overtake.test.ts`, `tests/engine/simpleStrategy.test.ts`

**Interfaces:**
- Produces (`overtake.ts`):
  - `overtakeChance(paceDeltaPerLap: number, attack: number, defense: number, difficulty: number): number`: `overtakeBase + overtakePaceK × paceDelta + overtakeSkillK × (attack − defense) − overtakeDifficultyK × difficulty`를 `overtakeClamp`로 자른다. `paceDeltaPerLap`은 앞차 예상 랩타임에서 뒤차 예상 랩타임을 뺀 값(초, 양수면 뒤차가 빠름)이다.
  - `resolveContacts(...)`: raceSim 내부 헬퍼. 시그니처는 구현자가 정한다.
- Produces (`simpleStrategy.ts`):
  - `interface OneStopPlan { startCompound: Compound; pitLap: number; nextCompound: Compound }`
  - `planOneStop(lapsTotal: number, rng: Rng): OneStopPlan`
  - `aiCommands(car: CarSnapshot, plan: OneStopPlan): Omit<Command, 'tick'>[]`: RaceSim이 매 틱 AI 차마다 호출하고, 반환된 명령에 현재 tick을 붙여 enqueue한다. 이미 피트를 마친 차(`usedCompounds.length ≥ 2`)나 `pitRequest`가 있는 차는 빈 배열을 반환한다.
  - 계획: 시작 M → H, 또는 시작 H → M 중 하나를 랜덤으로 고른다. 피트 랩은 `lapsTotal × range(0.4, 0.6)`의 반올림.
  - 마모가 85% 이상이면 계획보다 일찍 피트한다.
  - AI 차의 `RaceEntry.startCompound`는 `RaceSim` 생성 시 계획값으로 덮어쓴다.

동작 (매 틱 이동 후, running이고 피트레인이 아닌 차 사이):
- 뒤차가 앞차의 totalDist − `heldGapMeters` 이상으로 다가오면 접촉 판정을 한다.
  - 뒤차가 직선 구간에 있고, interval ≤ `overtakeWindow`이며, 이번 직선에서 이 앞차에 대해 아직 시도하지 않았으면 `overtakeChance`로 판정한다. 성공하면 통과 허용, 실패하면 뒤차를 앞차 − `heldGapMeters`로 되돌린다. 시도 기록은 구간이 바뀌면 초기화한다.
  - 코너 구간이면 항상 앞차 − `heldGapMeters`로 되돌린다.
  - 앞차의 `yieldTo`가 뒤차 carId이면 직선에서 무조건 통과시키고 `yieldTo`를 해제한다.
- 처리 순서는 앞쪽 순위부터 한다. 결정적이어야 한다.
- 성공한 추월은 이벤트로 남긴다. 텍스트 형식은 `"{lap}랩: {attackerCarId} → {defenderCarId} 추월"`이다. carId를 "#번호 이름"으로 바꾸는 일은 UI(EventLog)가 맡는다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test('overtakeChance clamps and increases with pace delta and skill, decreases with difficulty', ...)
test('in corners a faster car stays behind', ...)        // 직선 없는 테스트 서킷
test('a much faster car eventually passes on straights', ...)
test('teamOrder yield makes teammate pass on next straight', ...)
test('all AI cars pit exactly once and satisfy compound rule over 10 seeds', ...)
test('race still deterministic with overtakes and AI', ...)
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전체 PASS
- [ ] **Step 5: 커밋** — `feat(engine): add overtaking, blocking and simple AI one-stop strategy`

---

### Task 8: Canvas 렌더러

**Files:**
- Create: `src/render/trackGeometry.ts`, `src/render/sprites.ts`, `src/render/raceCanvas.ts`
- Test: `tests/render/trackGeometry.test.ts`

**Interfaces:**
- Consumes: `Circuit`, `SessionSnapshot`, `Team`
- Produces:
  - `buildTrackGeometry(c: Circuit): TrackGeometry`: 폴리라인 누적 픽셀 길이를 미리 계산한다.
  - `pointAt(g: TrackGeometry, lapDist: number, lapLength: number): { x: number; y: number; angle: number }`: 미터 거리를 픽셀 경로 비율로 선형 매핑한다.
  - `integerScale(viewW: number, viewH: number): number`: `max(1, floor(min(viewW/480, viewH/270)))`
  - `drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, accent: string): void`: 5×3 도트 차체에 accent 줄무늬 1픽셀. 방향은 8방향으로 스냅한다(도트 느낌 유지).
  - `class RaceCanvas { constructor(canvas: HTMLCanvasElement, circuit: Circuit, teams: Team[]); draw(prev: SessionSnapshot, curr: SessionSnapshot, alpha: number, highlight: string[]): void; dispose(): void }`
    - 트랙: 오프스크린 480×270 캔버스에 한 번 그린다. 잔디 배경, 아스팔트 선(폭 6px), 연석 포인트, 결승선 체크무늬, 피트레인(트랙 안쪽 3px 오프셋 회색선).
    - 차량: prev와 curr의 `lapDist`를 alpha로 보간한다(랩 경계 wrap 처리). `inPitLane`인 차는 피트레인 오프셋 위치에 그린다. `highlight`에 든 carId(플레이어 차)는 흰 테두리 1px.
    - 정수 배율로 확대하고 `imageSmoothingEnabled = false`로 둔다.

- [ ] **Step 1: 실패하는 테스트 작성** (DOM 없이 순수 함수만)

```ts
test('pointAt(0) is first path point; pointAt(lapLength/2) is about halfway along polyline', ...)
test('pointAt wraps at lapLength', ...)
test('integerScale', () => { expect(integerScale(1920, 1080)).toBe(4); expect(integerScale(300, 200)).toBe(1); expect(integerScale(1000, 600)).toBe(2); });
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Expected: PASS
- [ ] **Step 5: 커밋** — `feat(render): add pixel track and car renderer`

---

### Task 9: 세션 루프와 스토어

**Files:**
- Create: `src/store/loop.ts`, `src/store/raceStore.ts`
- Test: `tests/store/loop.test.ts`

**Interfaces:**
- Consumes: `RaceSim`, `SessionSnapshot`, `Command`
- Produces (`loop.ts`): `computeSteps(accumulator: number, realDt: number, speed: 0 | 1 | 4 | 8 | 16): { steps: number; accumulator: number }`
  - `realDt`는 0.25초로 자른 뒤 `× speed`를 누적하고, `steps = floor(acc / tickSeconds)`.
  - 한 번 호출에 steps 최대 `16`(= 0.25 × 16 / 0.25)이다.
- Produces (`raceStore.ts`): Zustand `useRaceStore`

```ts
interface RaceStoreState {
  phase: 'setup' | 'race' | 'result';
  playerTeamId: string | null;
  speed: 0 | 1 | 4 | 8 | 16;
  uiSnapshot: SessionSnapshot | null;     // 250ms마다 갱신
  result: SessionResult | null;
  startRace(opts: { playerTeamId: string; setups: Record<string, number>; startCompounds: Record<string, Compound>; seed: number }): void;
  setSpeed(s: 0 | 1 | 4 | 8 | 16): void;
  command(cmd: Omit<Command, 'tick'>): void;   // 현재 tick을 붙여 enqueue
  backToSetup(): void;
}
export function getRenderFrame(): { prev: SessionSnapshot; curr: SessionSnapshot; alpha: number } | null;
```

- sim 인스턴스, prev/curr 스냅샷, rAF 핸들은 Zustand 상태가 아니라 모듈 내부 변수로 둔다(매 프레임 React 리렌더 방지).
- 그리드: Plan 1에는 퀄리파잉이 없으므로 `tier` 오름차순, 팀 내에서는 driver.pace 내림차순으로 정한다. 시드 RNG로 ±2자리 섞는다.
- `isFinished()`가 되면 루프를 멈추고 `result`를 저장한 뒤 `phase='result'`로 바꾼다.
- 언마운트나 `backToSetup` 시 rAF를 취소한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test('speed 0 produces no steps', ...)
test('1x: 1 second real -> 4 steps over frames of 1/60s', ...)
test('huge dt (tab resumed after 30s) at 16x yields at most 16 steps', ...)   // Review Focus 1
test('accumulator carries remainder', ...)
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test && npm run typecheck` / Expected: PASS
- [ ] **Step 5: 커밋** — `feat(store): add session loop and race store`

---

### Task 10: 화면 (세팅 → 세션 → 결과)

**Files:**
- Create: `src/ui/SetupScreen.tsx`, `src/ui/session/SessionScreen.tsx`, `src/ui/session/TopBar.tsx`, `src/ui/session/TimingTower.tsx`, `src/ui/session/CarPanel.tsx`, `src/ui/session/EventLog.tsx`, `src/ui/ResultScreen.tsx`, `src/ui/styles.css`
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: `useRaceStore`, `getRenderFrame`, `RaceCanvas`, `TEAMS`, `DRIVERS`, `CIRCUITS`, `optimalSetup`은 쓰지 않는다(최적값 비공개)

화면 요구사항:
- **SetupScreen:** 11개 팀 카드(컬러, 이름, tier에 따른 예상 난이도: 1~3 쉬움, 4~6 보통, 7~9 어려움, 10~11 도전)가 있다. 팀을 고르면 드라이버 2명 각각에 세팅 슬라이더(0 = "속도형", 100 = "코너링형", 기본 50)와 시작 타이어 S/M/H 선택이 나온다. 서킷 정보로 이름, 위치, 레이스 랩 수, 직선 비율, 타이어 마모도, 추월 난이도를 "낮음/보통/높음" 텍스트로 보여준다. 시드는 `Date.now()`로 정한다(UI 레이어라 허용). "레이스 시작" 버튼이 있다.
- **SessionScreen:** 스펙 6.5 배치를 따른다. CSS grid를 쓰고 최소 폭은 1280px 기준이다.
  - 맵: `<canvas>`를 정수 배율로 키운다. 컨테이너 크기는 `ResizeObserver`로 감시한다. rAF마다 `getRenderFrame()`으로 그린다.
  - TopBar: "랩 {leaderLap}/{lapsTotal}", 배속 버튼 ⏸ 1x 4x 8x 16x(현재 강조). 날씨와 깃발 칸은 "맑음 / 그린"으로 고정한다(Plan 4에서 연결).
  - TimingTower: 22행. 순위, 팀 컬러 바, 번호, 이름, interval(리더는 "리더", 피트 중은 "PIT", 리타이어는 "OUT"), 컴파운드 아이콘(S 빨강, M 노랑, H 흰색), 마모%. 플레이어 차 행을 강조한다.
  - CarPanel × 2: 이름, 순위, 컴파운드/마모 바, 앞/뒤 interval, 페이스 모드 3버튼, 피트 버튼 + 컴파운드 선택(S/M/H), 예약된 피트 표시("피트 예약: H"), 팀 오더 버튼("팀메이트에게 양보"). 2종 컴파운드 미충족 상태에서 남은 랩 ≤ 5이면 빨간 경고 "컴파운드 2종 미사용 — 실격 위험".
  - EventLog: 최근 이벤트 10개. carId는 "#번호 이름"으로 변환해서 보여준다.
- **ResultScreen:** 순위, 번호, 이름, 팀, 랩, 시간(리더 기준 +갭, 랩다운은 "+N랩"), 베스트랩, 사용 컴파운드, 상태(완주/리타이어/실격). 플레이어 차를 강조한다. "다시 하기" 버튼은 `backToSetup`을 호출한다.
- **스타일:** 제목과 숫자는 Google Fonts "Press Start 2P"(라틴 문자만 지원), 한글과 본문은 시스템 산세리프를 쓴다. 배경 #101418, 패널 #1B222B, 텍스트 #E6EDF3.

- [ ] **Step 1: 화면 구현**

- [ ] **Step 2: 타입·빌드 확인** — Run: `npm run typecheck && npm run build` / Expected: 성공

- [ ] **Step 3: 브라우저 확인** — `npm run dev`로 띄우고 다음을 직접 확인한다.
  1. 팀 선택 → 세팅 → 시작
  2. 맵에서 22대가 움직임
  3. 16x로 바꾸면 빨라짐, ⏸이면 멈춤
  4. 피트 지시 → 해당 차가 피트레인으로 들어가 타이어가 바뀜
  5. 레이스 종료 → 결과표
  6. "다시 하기"
  7. 콘솔 에러 0건

- [ ] **Step 4: 커밋** — `feat(ui): add setup, live race session and result screens`

---

### Task 11: Plan 1 마무리 검증

- [ ] **Step 1:** Run: `npm test && npm run typecheck && npm run build` / Expected: 전부 성공
- [ ] **Step 2:** 금지어 검사 — Run: `grep -rniE "formula|grand prix|\bf1\b|ferrari|mercedes|mclaren|red bull|williams|alpine|aston|haas|sauber|audi|cadillac" src` / Expected: 출력 없음
- [ ] **Step 3:** 브라우저에서 4x로 레이스 1판을 끝까지 진행하고, 레이스 시간(약 5~7분)과 AI 피트 동작을 확인한다. 결과를 이 문서 하단 "검증 기록"에 3줄로 적는다.
- [ ] **Step 4:** 커밋 — `chore: verify plan 1 race MVP`

## 검증 기록

(Task 11에서 작성)
