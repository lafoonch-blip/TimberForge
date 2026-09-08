/**
 * The shapes stored in IndexedDB.
 *
 * These extend the engine's record types rather than redefining them. The
 * engine types are the contract; the local additions are bookkeeping the engine
 * has no business knowing about — which cruise a row belongs to, when it was
 * written, whether it has been synced.
 *
 * Two rules hold this together:
 *
 *   1. Every row carries `cruiseId`, even where the engine would infer it via
 *      plotId -> standId. Denormalised on purpose: the field app queries "all
 *      trees in this cruise" constantly and IndexedDB has no joins.
 *   2. Ids are UUIDs generated on the device, never sequence numbers from a
 *      server. Two cruisers offline in the same block must be able to create
 *      rows that will not collide when they both sync on the drive home.
 */

import type {
  CruiseMethod,
  LogRuleName,
  PlotRecord,
  StandRecord,
  TreeRecord,
} from '@timberforge/forestry-core';

/** ISO-8601 timestamps everywhere. Strings, because IndexedDB and JSON agree on them. */
export type Iso = string;

export interface LocalCruise {
  id: string;
  name: string;
  /** Region profile id, e.g. 'us_south'. Chosen once, drives species and defaults. */
  regionId: string;
  /** Overrides the region default when a client insists on a particular rule. */
  logRule?: LogRuleName;
  /** Default method for new plots. Individual plots may still differ. */
  defaultMethod: CruiseMethod;
  /** Default BAF for new variable-radius plots. */
  defaultBaf?: number;
  /** Default plot size for new fixed-area plots, acres. */
  defaultPlotAcres?: number;
  targetSamplingErrorPct?: number;
  /** LandForge parcel this cruise describes, when it came from one. */
  landforgeParcelId?: string;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface LocalStand extends StandRecord {
  cruiseId: string;
  updatedAt: Iso;
}

export interface LocalPlot extends PlotRecord {
  cruiseId: string;
  updatedAt: Iso;
}

export interface LocalTree extends TreeRecord {
  cruiseId: string;
  /** Tally order within the plot. Cruisers read their tally back in sequence. */
  seq: number;
  updatedAt: Iso;
}

/** Tables the outbox can carry. Kept as a union so a typo is a type error. */
export type SyncTable = 'cruise' | 'stand' | 'plot' | 'tree';

export type SyncOp = 'upsert' | 'delete';

/**
 * One pending change.
 *
 * The outbox is an intent log, not a diff. Every local write appends a row in
 * the same transaction that changes the data, so "what does the server not know
 * yet" is answered by reading a table rather than by comparing two datasets and
 * hoping. Sync then replays the log in order.
 *
 * `payload` is the whole row, not a patch. Patches need the server and the
 * device to agree on a base version, and after four days offline they will not.
 * A whole row is idempotent: replaying it twice is the same as once.
 */
export interface OutboxEntry {
  /** Auto-incremented by Dexie. Order of intent, and the only ordering sync uses. */
  seq?: number;
  table: SyncTable;
  op: SyncOp;
  rowId: string;
  cruiseId: string;
  payload: unknown;
  queuedAt: Iso;
  attempts: number;
  lastError?: string;
}
