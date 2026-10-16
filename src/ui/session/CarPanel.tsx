import { useState } from 'react';
import { violatesCompoundRule } from '../../engine/race/rules';
import type { Compound, PaceMode } from '../../engine/types';
import { useRaceStore } from '../../store/raceStore';
import { COMPOUND_COLOR, COMPOUND_NAME, driverOf, teamOf } from '../format';

const PACES: { mode: PaceMode; label: string }[] = [
  { mode: 'push', label: '푸시' },
  { mode: 'normal', label: '보통' },
  { mode: 'save', label: '세이브' },
];
const COMPOUNDS: Compound[] = ['S', 'M', 'H'];
const WARN_LAPS = 5;

export function CarPanel({ carId }: { carId: string }) {
  const snap = useRaceStore((s) => s.uiSnapshot);
  const command = useRaceStore((s) => s.command);
  const [choice, setChoice] = useState<Compound>('H');
  if (!snap) return null;
  const i = snap.cars.findIndex((c) => c.carId === carId);
  const car = snap.cars[i];
  if (!car) return null;
  const behind = snap.cars[i + 1];
  const d = driverOf(carId);
  const team = teamOf(car.teamId);
  const lapsLeft = snap.lapsTotal - car.lap + 1;
  const effectiveUsed = car.pitRequest ? [...car.usedCompounds, car.pitRequest] : car.usedCompounds;
  const danger = car.status === 'running' && lapsLeft <= WARN_LAPS && violatesCompoundRule(effectiveUsed);
  const active = car.status === 'running';
  const wearColor = car.wear > 70 ? '#ff5d5d' : car.wear > 45 ? '#ffd23f' : '#5ddc7a';

  return (
    <div className="carpanel panel" style={{ borderTop: `3px solid ${team.color}` }}>
      <div className="carpanel-head">
        <b>
          #{d.number} {d.name}
        </b>
        <span className="pixel">P{car.position}</span>
        {car.status === 'pitting' && <span className="badge">PIT</span>}
        {car.status === 'retired' && <span className="badge bad">OUT</span>}
        {car.status === 'finished' && <span className="badge">FIN</span>}
      </div>
      <div className="row">
        <span className="chip" style={{ background: COMPOUND_COLOR[car.compound] }}>
          {car.compound}
        </span>
        <div className="bar">
          <div style={{ width: `${car.wear}%`, background: wearColor }} />
        </div>
        <span>{Math.round(car.wear)}%</span>
      </div>
      <div className="row muted">
        <span>앞차 {car.position === 1 ? '-' : `+${car.interval.toFixed(1)}s`}</span>
        <span>뒷차 {behind ? `+${behind.interval.toFixed(1)}s` : '-'}</span>
        <span>사용 {car.usedCompounds.join('·')}</span>
      </div>
      <div className="row">
        {PACES.map((p) => (
          <button
            key={p.mode}
            className={car.pace === p.mode ? 'active' : ''}
            disabled={!active && car.status !== 'pitting'}
            onClick={() => command({ carId, kind: 'pace', mode: p.mode })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="row">
        {COMPOUNDS.map((c) => (
          <button key={c} className={choice === c ? 'active' : ''} onClick={() => setChoice(c)} title={COMPOUND_NAME[c]}>
            <span className="dot" style={{ background: COMPOUND_COLOR[c] }} />
            {c}
          </button>
        ))}
        <button className="primary" disabled={!active} onClick={() => command({ carId, kind: 'pit', compound: choice })}>
          피트 요청
        </button>
        <button disabled={!active} onClick={() => command({ carId, kind: 'teamOrder' })}>
          팀메이트에게 양보
        </button>
      </div>
      {car.pitRequest && <div className="note">피트 예약: {car.pitRequest}</div>}
      {danger && <div className="warn">컴파운드 2종 미사용 — 실격 위험</div>}
    </div>
  );
}
