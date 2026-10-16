import { useRaceStore } from './store/raceStore';
import { ResultScreen } from './ui/ResultScreen';
import { SetupScreen } from './ui/SetupScreen';
import { SessionScreen } from './ui/session/SessionScreen';

export function App() {
  const phase = useRaceStore((s) => s.phase);
  if (phase === 'race') return <SessionScreen />;
  if (phase === 'result') return <ResultScreen />;
  return <SetupScreen />;
}
