import { useState } from 'react';
import { SOUTHLAKE } from '../data/circuits';
import { getDriversOfTeam } from '../data/drivers';
import { TEAMS } from '../data/teams';
import { raceLaps } from '../engine/circuit';
import type { Compound } from '../engine/types';
import { useRaceStore } from '../store/raceStore';
import { COMPOUND_COLOR, COMPOUND_NAME } from './format';

const COMPOUNDS: Compound[] = ['S', 'M', 'H'];

const difficulty = (tier: number) => (tier <= 3 ? '쉬움' : tier <= 6 ? '보통' : tier <= 9 ? '어려움' : '도전');
const level = (v: number, lo: number, hi: number) => (v < lo ? '낮음' : v <= hi ? '보통' : '높음');

export function SetupScreen() {
  const startRace = useRaceStore((s) => s.startRace);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [setups, setSetups] = useState<Record<string, number>>({});
  const [compounds, setCompounds] = useState<Record<string, Compound>>({});
  const traits = SOUTHLAKE.traits;

  const pickTeam = (id: string) => {
    setTeamId(id);
    const s: Record<string, number> = {};
    const c: Record<string, Compound> = {};
    for (const d of getDriversOfTeam(id)) {
      s[d.id] = 50;
      c[d.id] = 'M';
    }
    setSetups(s);
    setCompounds(c);
  };

  const start = () => {
    if (!teamId) return;
    startRace({ playerTeamId: teamId, setups, startCompounds: compounds, seed: Date.now() & 0x7fffffff });
  };

  return (
    <div className="setup">
      <h1 className="pixel">DOT RACE</h1>
      <p className="muted">팀을 고르고 세팅과 시작 타이어를 정한 뒤 레이스를 시작하세요.</p>

      <div className="team-grid">
        {TEAMS.map((t) => (
          <button key={t.id} className={`team-card${t.id === teamId ? ' selected' : ''}`} style={{ borderLeft: `8px solid ${t.color}` }} onClick={() => pickTeam(t.id)}>
            <b>{t.name}</b>
            <span className="muted">예상 난이도 {difficulty(t.tier)}</span>
          </button>
        ))}
      </div>

      <div className="panel circuit-info">
        <h2>
          {SOUTHLAKE.name} <span className="muted">({SOUTHLAKE.location})</span>
        </h2>
        <div className="row">
          <span>레이스 {raceLaps(SOUTHLAKE)}랩</span>
          <span>직선 비율 {level(traits.straightRatio, 0.4, 0.6)}</span>
          <span>타이어 마모도 {level(traits.tyreWear, 0.85, 1.1)}</span>
          <span>추월 난이도 {level(traits.overtakeDifficulty, 0.35, 0.65)}</span>
        </div>
      </div>

      {teamId && (
        <div className="drivers">
          {getDriversOfTeam(teamId).map((d) => (
            <div key={d.id} className="panel driver-setup">
              <b>
                #{d.number} {d.name}
              </b>
              <label className="row">
                <span className="muted">속도형</span>
                <input type="range" min={0} max={100} value={setups[d.id] ?? 50} onChange={(e) => setSetups({ ...setups, [d.id]: Number(e.target.value) })} />
                <span className="muted">코너링형</span>
                <span className="pixel small">{setups[d.id] ?? 50}</span>
              </label>
              <div className="row">
                <span className="muted">시작 타이어</span>
                {COMPOUNDS.map((c) => (
                  <button key={c} className={compounds[d.id] === c ? 'active' : ''} onClick={() => setCompounds({ ...compounds, [d.id]: c })}>
                    <span className="dot" style={{ background: COMPOUND_COLOR[c] }} />
                    {COMPOUND_NAME[c]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="primary big" disabled={!teamId} onClick={start}>
        레이스 시작
      </button>
    </div>
  );
}
