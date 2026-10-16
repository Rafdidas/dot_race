import { useRaceStore } from '../../store/raceStore';
import { humanize } from '../format';

export function EventLog() {
  const snap = useRaceStore((s) => s.uiSnapshot);
  const events = snap ? [...snap.events].reverse().slice(0, 10) : [];
  return (
    <div className="eventlog panel">
      {events.length === 0 && <div className="muted">아직 이벤트가 없어요.</div>}
      {events.map((e, i) => (
        <div key={`${e.tick}-${i}`}>{humanize(e.text)}</div>
      ))}
    </div>
  );
}
