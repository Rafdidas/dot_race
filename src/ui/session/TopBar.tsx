import type { Speed } from '../../store/loop';
import { useRaceStore } from '../../store/raceStore';

const SPEEDS: { value: Speed; label: string }[] = [
  { value: 0, label: '⏸' },
  { value: 1, label: '1x' },
  { value: 4, label: '4x' },
  { value: 8, label: '8x' },
  { value: 16, label: '16x' },
];

export function TopBar() {
  const snap = useRaceStore((s) => s.uiSnapshot);
  const speed = useRaceStore((s) => s.speed);
  const setSpeed = useRaceStore((s) => s.setSpeed);
  return (
    <div className="topbar panel">
      <div className="pixel">
        랩 {snap?.leaderLap ?? 0}/{snap?.lapsTotal ?? 0}
      </div>
      <div>
        날씨 <b>맑음</b>
      </div>
      <div>
        깃발 <b className="flag-green">그린</b>
      </div>
      <div className="spacer" />
      <div className="speed">
        {SPEEDS.map((s) => (
          <button key={s.value} className={s.value === speed ? 'active' : ''} onClick={() => setSpeed(s.value)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
