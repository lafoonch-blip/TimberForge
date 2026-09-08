/**
 * The local database.
 *
 * IndexedDB is the field app's primary store, not a cache. A cruise is created,
 * tallied, compiled and reported entirely offline; the server is where it goes
 * afterwards. That ordering is the reason for every design decision in here.
 *
 * WHY DEXIE
 *
 * Raw IndexedDB is a callback API with transactions that abort if you await the
 * wrong thing. Dexie is a thin promise layer over it — no query language, no
 * ORM, no schema magic — and it keeps transaction semantics honest, which is
 * what matters when a write must not land without its outbox row.
 *
 * THE ONE INVARIANT
 *
 * Every mutation goes through `writeRow` or `deleteRow`. Both write the data
 * and its outbox entry inside a single Dexie transaction. A tally that reached
 * the device but not the outbox would appear on the phone, never reach the
 * server, and be discovered missing weeks later when the report disagreed with
 * the field notes. Writing directly to `db.tree` is the one thing not to do.
 */

import Dexie, { type Table } from 'dexie';
import type {
  LocalCruise,
  LocalPlot,
  LocalStand,
  LocalTree,
  OutboxEntry,
  SyncTable,
} from './schema.js';
import { now } from '../lib/uuid.js';

export class FieldDb extends Dexie {
  cruise!: Table<LocalCruise, string>;
  stand!: Table<LocalStand, string>;
  plot!: Table<LocalPlot, string>;
  tree!: Table<LocalTree, string>;
  outbox!: Table<OutboxEntry, number>;

  constructor(name = 'timberforge-field') {
    super(name);
    // Index only what is queried. Every index is written on every insert, and
    // the tally screen inserts on a tap; on an old Android in the cold that
    // budget is real.
    this.version(1).stores({
      cruise: 'id, updatedAt',
      stand: 'id, cruiseId',
      plot: 'id, standId, cruiseId, [standId+number]',
      tree: 'id, plotId, cruiseId, [plotId+seq]',
      outbox: '++seq, cruiseId, table',
    });
  }
}

export const db = new FieldDb();

/** Maps a table name in the sync log to the Dexie table holding those rows. */
function tableFor(t: SyncTable): Table<{ id: string }, string> {
  switch (t) {
    case 'cruise':
      return db.cruise as unknown as Table<{ id: string }, string>;
    case 'stand':
      return db.stand as unknown as Table<{ id: string }, string>;
    case 'plot':
      return db.plot as unknown as Table<{ id: string }, string>;
    case 'tree':
      return db.tree as unknown as Table<{ id: string }, string>;
  }
}

/**
 * Write a row and queue it for sync, atomically.
 *
 * The row is written as given — callers own their own ids and timestamps, so
 * that a replayed write produces the same row twice rather than two rows.
 */
export async function writeRow<T extends { id: string }>(
  table: SyncTable,
  cruiseId: string,
  row: T
): Promise<T> {
  await db.transaction('rw', tableFor(table), db.outbox, async () => {
    await tableFor(table).put(row);
    await db.outbox.add({
      table,
      op: 'upsert',
      rowId: row.id,
      cruiseId,
      payload: row,
      queuedAt: now(),
      attempts: 0,
    });
  });
  return row;
}

/**
 * Delete a row and queue the deletion.
 *
 * Deletion is queued rather than applied optimistically to the server for the
 * same reason writes are: the device may not see a network for days, and the
 * deletion has to survive the trip home in the same order it was made.
 */
export async function deleteRow(
  table: SyncTable,
  cruiseId: string,
  rowId: string
): Promise<void> {
  await db.transaction('rw', tableFor(table), db.outbox, async () => {
    await tableFor(table).delete(rowId);
    await db.outbox.add({
      table,
      op: 'delete',
      rowId,
      cruiseId,
      payload: null,
      queuedAt: now(),
      attempts: 0,
    });
  });
}

/**
 * Everything belonging to one cruise, in the shape the engine wants.
 *
 * Deliberately reads all four tables rather than accepting partial input: a
 * compile run on a subset of the plots is not a smaller answer, it is a wrong
 * one, because a missing plot biases the mean rather than widening it.
 */
export async function loadCruise(cruiseId: string): Promise<{
  cruise: LocalCruise | undefined;
  stands: LocalStand[];
  plots: LocalPlot[];
  trees: LocalTree[];
}> {
  const [cruise, stands, plots, trees] = await Promise.all([
    db.cruise.get(cruiseId),
    db.stand.where('cruiseId').equals(cruiseId).toArray(),
    db.plot.where('cruiseId').equals(cruiseId).toArray(),
    db.tree.where('cruiseId').equals(cruiseId).toArray(),
  ]);
  return {
    cruise,
    stands: stands.sort((a, b) => a.name.localeCompare(b.name)),
    plots: plots.sort((a, b) => a.number - b.number),
    trees,
  };
}
