import { useRaceStore } from '../../store/raceStore';
import { COMPOUND_COLOR, driverOf, teamOf } from '../format';

export function TimingTower() {
  const snap = useRaceStore((s) => s.uiSnapshot);
  const playerTeamId = useRaceStore((s) => s.playerTeamId);
  if (!snap) return null;
  return (
    <div className="tower panel">
      {snap.cars.map((c) => {
        const d = driverOf(c.carId);
        const t = teamOf(c.teamId);
        let gap = c.position === 1 ? '리더' : `+${c.interval.toFixed(1)}`;
        if (c.inPitLane) gap = 'PIT';
        else if (c.status === 'retired') gap = 'OUT';
        else if (c.status === 'finished') gap = c.position === 1 ? '완주' : `+${c.gapToLeader.toFixed(1)}`;
        return (
          <div key={c.carId} className={`tower-row${c.teamId === playerTeamId ? ' mine' : ''}`}>
            <span className="pos">{c.position}</span>
            <span className="team-bar" style={{ background: t.color }} />
            <span className="num">#{d.number}</span>
            <span className="name">{d.name}</span>
            <span className="gap">{gap}</span>
            <span className="chip" style={{ background: COMPOUND_COLOR[c.compound] }}>
              {c.compound}
            </span>
            <span className="wear">{Math.round(c.wear)}%</span>
          </div>
        );
      })}
    </div>
  );
}
