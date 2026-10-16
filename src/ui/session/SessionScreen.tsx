import { useEffect, useMemo, useRef } from 'react';
import { SOUTHLAKE } from '../../data/circuits';
import { DRIVERS } from '../../data/drivers';
import { TEAMS } from '../../data/teams';
import { RaceCanvas } from '../../render/raceCanvas';
import { getRenderFrame, useRaceStore } from '../../store/raceStore';
import { CarPanel } from './CarPanel';
import { EventLog } from './EventLog';
import { TimingTower } from './TimingTower';
import { TopBar } from './TopBar';

export function SessionScreen() {
  const playerTeamId = useRaceStore((s) => s.playerTeamId);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mine = useMemo(() => DRIVERS.filter((d) => d.teamId === playerTeamId).map((d) => d.id), [playerTeamId]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const rc = new RaceCanvas(canvas, SOUTHLAKE, TEAMS);
    const fit = () => rc.resize(wrap.clientWidth, wrap.clientHeight);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    let raf = 0;
    const loop = () => {
      const f = getRenderFrame();
      if (f) rc.draw(f.prev, f.curr, f.alpha, mine);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      rc.dispose();
    };
  }, [mine]);

  return (
    <div className="session">
      <TopBar />
      <div className="map-col">
        <div className="map-wrap" ref={wrapRef}>
          <canvas ref={canvasRef} />
        </div>
        <EventLog />
      </div>
      <TimingTower />
      <div className="cars">
        {mine.map((id) => (
          <CarPanel key={id} carId={id} />
        ))}
      </div>
    </div>
  );
}
