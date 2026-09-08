import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db.js';
import { addPlot, addStand, markPlotSkipped } from '../db/actions.js';
import type { View } from '../App.js';

/**
 * Stands, and the plots inside them.
 *
 * The plot list shows tree counts and marks empty and skipped points
 * explicitly, because "have I done this one?" is the question a cruiser asks
 * the app most often, and an unvisited plot and a legitimately empty one look
 * identical if the app only counts trees.
 */
export function CruiseScreen({
  cruiseId,
  onNavigate,
}: {
  cruiseId: string;
  onNavigate: (v: View) => void;
}) {
  const cruise = useLiveQuery(() => db.cruise.get(cruiseId), [cruiseId]);
  const stands = useLiveQuery(
    () => db.stand.where('cruiseId').equals(cruiseId).toArray(),
    [cruiseId],
    []
  );
  const plots = useLiveQuery(
    () => db.plot.where('cruiseId').equals(cruiseId).toArray(),
    [cruiseId],
    []
  );
  const trees = useLiveQuery(
    () => db.tree.where('cruiseId').equals(cruiseId).toArray(),
    [cruiseId],
    []
  );

  const [standName, setStandName] = useState('');
  const [standAcres, setStandAcres] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!cruise) return <p className="empty">Loading…</p>;

  const treesByPlot = new Map<string, number>();
  for (const t of trees) treesByPlot.set(t.plotId, (treesByPlot.get(t.plotId) ?? 0) + (t.count ?? 1));

  return (
    <>
      <div className="card">
        <div className="row spread">
          <div>
            <strong>{cruise.name}</strong>
            <div className="small muted">
              {plots.length} plots · {trees.length} trees
            </div>
          </div>
          <button
            className="primary"
            disabled={plots.length === 0}
            onClick={() => onNavigate({ name: 'compile', cruiseId })}
          >
            Compile
          </button>
        </div>
      </div>

      {stands.map((stand) => {
        const standPlots = plots
          .filter((p) => p.standId === stand.id)
          .sort((a, b) => a.number - b.number);
        return (
          <div key={stand.id}>
            <h2>
              {stand.name} · {stand.acres} ac
            </h2>
            {standPlots.length === 0 && <p className="small muted">No plots yet.</p>}
            <ul className="tallylist">
              {standPlots.map((p) => {
                const n = treesByPlot.get(p.id) ?? 0;
                const state = p.isSkipped
                  ? 'skipped'
                  : p.isEmpty
                    ? 'empty (a real zero)'
                    : n === 0
                      ? 'not started'
                      : `${n} trees`;
                return (
                  <li key={p.id}>
                    <span className="seq">{p.number}</span>
                    <span className="grow">
                      {p.method === 'variable_radius' ? `${p.baf} BAF` : `${p.plotAcres} ac`}
                      <span className="muted small"> · {state}</span>
                    </span>
                    <button
                      className="ghost"
                      onClick={() => onNavigate({ name: 'tally', cruiseId, plotId: p.id })}
                    >
                      Tally
                    </button>
                    <button
                      className="ghost"
                      title="Could not be visited — excluded from statistics"
                      onClick={() => void markPlotSkipped(p, !p.isSkipped)}
                    >
                      {p.isSkipped ? 'Unskip' : 'Skip'}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="row" style={{ marginTop: 10 }}>
              <button
                onClick={async () => {
                  try {
                    const p = await addPlot(cruise, stand.id);
                    onNavigate({ name: 'tally', cruiseId, plotId: p.id });
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Add plot
              </button>
            </div>
          </div>
        );
      })}

      <h2>Add stand</h2>
      <div className="card">
        <div className="field">
          <label htmlFor="s-name">Name</label>
          <input id="s-name" value={standName} onChange={(e) => setStandName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="s-acres">Acres</label>
          <input
            id="s-acres"
            inputMode="decimal"
            value={standAcres}
            onChange={(e) => setStandAcres(e.target.value)}
          />
        </div>
        <button
          className="primary"
          disabled={standName.trim() === '' || !(Number(standAcres) > 0)}
          onClick={async () => {
            await addStand(cruiseId, { name: standName.trim(), acres: Number(standAcres) });
            setStandName('');
            setStandAcres('');
          }}
        >
          Add stand
        </button>
      </div>

      {error && <p className="small" style={{ color: 'var(--red)' }}>{error}</p>}
    </>
  );
}
