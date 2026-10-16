import { useRaceStore } from '../store/raceStore';
import { COMPOUND_COLOR, driverOf, fmtLap, fmtRaceTime, teamOf } from './format';

const STATUS_LABEL = { finished: '완주', retired: '리타이어', dsq: '실격' } as const;

export function ResultScreen() {
  const result = useRaceStore((s) => s.result);
  const playerTeamId = useRaceStore((s) => s.playerTeamId);
  const backToSetup = useRaceStore((s) => s.backToSetup);
  if (!result) return null;
  const leader = result.rows[0];

  return (
    <div className="result">
      <h1 className="pixel">RESULT</h1>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>순위</th>
              <th>번호</th>
              <th>드라이버</th>
              <th>팀</th>
              <th>랩</th>
              <th>시간</th>
              <th>베스트랩</th>
              <th>타이어</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => {
              const d = driverOf(r.carId);
              const t = teamOf(r.teamId);
              let time = '-';
              if (r.time !== null) {
                if (r === leader) time = fmtRaceTime(r.time);
                else if (r.laps < leader.laps) time = `+${leader.laps - r.laps}랩`;
                else time = `+${(r.time - leader.time!).toFixed(3)}`;
              }
              return (
                <tr key={r.carId} className={r.teamId === playerTeamId ? 'mine' : ''}>
                  <td>{r.position}</td>
                  <td>#{d.number}</td>
                  <td>{d.name}</td>
                  <td>
                    <span className="team-bar inline" style={{ background: t.color }} />
                    {t.name}
                  </td>
                  <td>{r.laps}</td>
                  <td>{time}</td>
                  <td>{fmtLap(r.bestLap)}</td>
                  <td>
                    {r.usedCompounds.map((c) => (
                      <span key={c} className="chip" style={{ background: COMPOUND_COLOR[c] }}>
                        {c}
                      </span>
                    ))}
                  </td>
                  <td className={r.status === 'finished' ? '' : 'bad'}>{STATUS_LABEL[r.status]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button className="primary big" onClick={backToSetup}>
        다시 하기
      </button>
    </div>
  );
}
