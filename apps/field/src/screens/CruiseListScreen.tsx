import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db.js';
import { createCruise } from '../db/actions.js';
import { REGIONS } from '@timberforge/forestry-core';
import type { CruiseMethod } from '@timberforge/forestry-core';
import type { View } from '../App.js';

export function CruiseListScreen({ onOpen }: { onOpen: (v: View) => void }) {
  const cruises = useLiveQuery(() => db.cruise.orderBy('updatedAt').reverse().toArray(), [], []);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <h2>Cruises</h2>
      {cruises.length === 0 && !creating && (
        <p className="empty">No cruises yet.</p>
      )}
      {cruises.map((c) => (
        <div key={c.id} className="card">
          <div className="row spread">
            <div>
              <strong>{c.name}</strong>
              <div className="small muted">
                {REGIONS[c.regionId]?.name ?? c.regionId} ·{' '}
                {c.defaultMethod === 'variable_radius'
                  ? `${c.defaultBaf} BAF prism`
                  : `${c.defaultPlotAcres} ac plots`}
              </div>
            </div>
            <button className="primary" onClick={() => onOpen({ name: 'cruise', cruiseId: c.id })}>
              Open
            </button>
          </div>
        </div>
      ))}

      {creating ? (
        <NewCruiseForm
          onCancel={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            onOpen({ name: 'cruise', cruiseId: id });
          }}
        />
      ) : (
        <button className="primary" onClick={() => setCreating(true)}>
          New cruise
        </button>
      )}
    </>
  );
}

function NewCruiseForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [regionId, setRegionId] = useState('us_south');
  const [method, setMethod] = useState<CruiseMethod>('variable_radius');
  const [baf, setBaf] = useState('10');
  const [plotAcres, setPlotAcres] = useState('0.1');
  const [error, setError] = useState<string | null>(null);

  // The region is fixed at creation and not offered again later. Changing it
  // mid-cruise would change the species list and the log rule underneath tally
  // data already collected, which is not an edit — it is a different cruise.
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>New cruise</h2>
      <div className="field">
        <label htmlFor="c-name">Name</label>
        <input
          id="c-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ridge Tract"
        />
      </div>
      <div className="field">
        <label htmlFor="c-region">Region</label>
        <select id="c-region" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
          {Object.values(REGIONS).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.logRule.replace(/_/g, ' ')})
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="c-method">Method</label>
        <select
          id="c-method"
          value={method}
          onChange={(e) => setMethod(e.target.value as CruiseMethod)}
        >
          <option value="variable_radius">Variable radius (prism / angle gauge)</option>
          <option value="fixed_area">Fixed area plots</option>
        </select>
      </div>
      {method === 'variable_radius' ? (
        <div className="field">
          <label htmlFor="c-baf">Basal area factor</label>
          <input
            id="c-baf"
            inputMode="decimal"
            value={baf}
            onChange={(e) => setBaf(e.target.value)}
          />
        </div>
      ) : (
        <div className="field">
          <label htmlFor="c-acres">Plot size (acres)</label>
          <input
            id="c-acres"
            inputMode="decimal"
            value={plotAcres}
            onChange={(e) => setPlotAcres(e.target.value)}
          />
        </div>
      )}
      {error && <p className="small" style={{ color: 'var(--red)' }}>{error}</p>}
      <div className="row">
        <button
          className="primary grow"
          disabled={name.trim() === ''}
          onClick={async () => {
            try {
              const c = await createCruise({
                name: name.trim(),
                regionId,
                defaultMethod: method,
                defaultBaf: method === 'variable_radius' ? Number(baf) : undefined,
                defaultPlotAcres: method === 'fixed_area' ? Number(plotAcres) : undefined,
              });
              onCreated(c.id);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Create
        </button>
        <button className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
