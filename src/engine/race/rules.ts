import type { Compound, ResultRow } from '../types';

/** Dry-weather rule: at least two different dry compounds must be used. (Plan 4 adds the wet-tyre exemption.) */
export function violatesCompoundRule(used: Compound[]): boolean {
  return new Set(used).size < 2;
}

/** Classification order: non-dsq before dsq; laps desc; finish time asc (no time last). Positions renumbered. */
export function sortResults(rows: ResultRow[]): ResultRow[] {
  const sorted = [...rows].sort((a, b) => {
    const dsq = Number(a.status === 'dsq') - Number(b.status === 'dsq');
    if (dsq !== 0) return dsq;
    if (a.laps !== b.laps) return b.laps - a.laps;
    const ta = a.time ?? Infinity;
    const tb = b.time ?? Infinity;
    if (ta !== tb) return ta - tb;
    return 0;
  });
  return sorted.map((r, i) => ({ ...r, position: i + 1 }));
}
