import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db.js';
import { markPlotEmpty, tallyTree, untallyTree } from '../db/actions.js';
import { getRegion } from '@timberforge/forestry-core';
import type { View } from '../App.js';

/**
 * The tally screen.
 *
 * This is the screen that decides whether the app is usable. A cruiser tallies
 * a tree every few seconds while holding a prism, and every extra tap is a tap
 * repeated a thousand times a day. So:
 *
 *   * Species is a row of buttons, not a dropdown. It stays on the last species
 *     used, because stands are rarely mixed tree to tree.
 *   * DBH is a keypad of the two-inch classes actually encountered, not a text
 *     field. Typing a number requires looking at the screen; a big button does
 *     not.
 *   * One tap on a DBH button records the tree. Height is optional and applies
 *     to the next tree only if the cruiser sets it — most cruises measure
 *     height on a subsample, and forcing it on every tree produces invented
 *     numbers, which are worse than missing ones.
 *   * The tally list is newest-first and every row can be undone, because the
 *     correction a cruiser needs is almost always to the tree just recorded.
 */
export function TallyScreen({
  cruiseId,
  plotId,
  onNavigate,
}: {
  cruiseId: string;
  plotId: string;
  onNavigate: (v: View) => void;
}) {
  const cruise = useLiveQuery(() => db.cruise.get(cruiseId), [cruiseId]);
  const plot = useLiveQuery(() => db.plot.get(plotId), [plotId]);
  const trees = useLiveQuery(
    () => db.tree.where('plotId').equals(plotId).toArray(),
    [plotId],
    []
  );

  const [species, setSpecies] = useState<string | null>(null);
  const [heightFt, setHeightFt] = useState('');
  const [logs, setLogs] = useState('');

  if (!cruise || !plot) return <p className="empty">Loading…</p>;

  const region = getRegion(cruise.regionId);
  const active = species ?? region.species[0]?.code ?? '';

  // The classes offered run from the region's pulpwood minimum up to 30 inches.
  // Below the minimum the tree is not merchantable and does not belong in the
  // tally; above 30 is rare enough that a prompt is better than a button.
  const minClass = Math.max(2, Math.round(region.pulpwoodMinDbh / 2) * 2);
  const classes: number[] = [];
  for (let d = minClass; d <= 30; d += 2) classes.push(d);

  const sorted = [...trees].sort((a, b) => b.seq - a.seq);

  return (
    <>
      <div className="card">
        <div className="row spread">
          <div>
            <strong>Plot {plot.number}</strong>
            <div className="small muted">
              {plot.method === 'variable_radius' ? `${plot.baf} BAF` : `${plot.plotAcres} acre`} ·{' '}
              {trees.length} trees
            </div>
          </div>
          <button
            className={plot.isEmpty ? 'primary' : 'ghost'}
            disabled={trees.length > 0}
            title={
              trees.length > 0
                ? 'A plot with trees on it is not empty.'
                : 'Visited, nothing in — counted as a real zero.'
            }
            onClick={() => void markPlotEmpty(plot, !plot.isEmpty)}
          >
            {plot.isEmpty ? 'Empty ✓' : 'Mark empty'}
          </button>
        </div>
      </div>

      <h2>Species</h2>
      <div className="keypad">
        {region.species.map((s) => (
          <button
            key={s.code}
            className={s.code === active ? 'on' : ''}
            title={s.commonName}
            onClick={() => setSpecies(s.code)}
          >
            {s.code}
          </button>
        ))}
      </div>

      <h2>Height for next tree (optional)</h2>
      <div className="row">
        <div className="grow">
          <label htmlFor="t-ht">Total height (ft)</label>
          <input
            id="t-ht"
            inputMode="numeric"
            value={heightFt}
            onChange={(e) => setHeightFt(e.target.value)}
          />
        </div>
        <div className="grow">
          <label htmlFor="t-logs">Merch. 16-ft logs</label>
          <input
            id="t-logs"
            inputMode="decimal"
            value={logs}
            onChange={(e) => setLogs(e.target.value)}
          />
        </div>
      </div>

      <h2>DBH — tap to tally</h2>
      <div className="keypad">
        {classes.map((d) => (
          <button
            key={d}
            onClick={async () => {
              await tallyTree(plot, {
                species: active,
                dbh: d,
                totalHeightFt: heightFt === '' ? undefined : Number(heightFt),
                merchHeight: logs === '' ? undefined : Number(logs),
                merchHeightUnit: logs === '' ? undefined : 'logs',
              });
              // Heights are cleared after use. Carrying a height forward would
              // silently attach one tree's measurement to the next, which is
              // the kind of error that survives all the way to the report.
              setHeightFt('');
              setLogs('');
            }}
          >
            {d}
          </button>
        ))}
      </div>

      <h2>Tally ({trees.length})</h2>
      {sorted.length === 0 ? (
        <p className="small muted">Nothing tallied on this plot yet.</p>
      ) : (
        <ul className="tallylist">
          {sorted.map((t) => (
            <li key={t.id}>
              <span className="seq">{t.seq}</span>
              <span className="grow mono">
                {t.species} · {t.dbh}"
                {t.totalHeightFt ? ` · ${t.totalHeightFt} ft` : ''}
                {t.merchHeight ? ` · ${t.merchHeight} logs` : ''}
              </span>
              <button className="danger ghost" onClick={() => void untallyTree(t)}>
                Undo
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        <button
          className="primary grow"
          onClick={() => onNavigate({ name: 'cruise', cruiseId })}
        >
          Done with this plot
        </button>
      </div>
    </>
  );
}
