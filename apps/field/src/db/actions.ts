/**
 * The things a cruiser can do, expressed once.
 *
 * The screens call these; they never touch Dexie directly. That keeps two rules
 * in one place instead of scattered across components: every write is queued
 * for sync, and every plot is created with a method whose parameters actually
 * match it — a variable-radius plot with a BAF and no plot size, a fixed-area
 * plot with a size and no BAF. The database enforces the same rule in
 * `plot_method_parameters_match_method`; enforcing it here too means the field
 * app fails at the tap rather than at the sync, which is the difference between
 * a correction and a lost afternoon.
 */

import { db, writeRow, deleteRow } from './db.js';
import type { LocalCruise, LocalPlot, LocalStand, LocalTree } from './schema.js';
import { uuid, now } from '../lib/uuid.js';
import type { CruiseMethod, ProductClass } from '@timberforge/forestry-core';

export async function createCruise(input: {
  name: string;
  regionId: string;
  defaultMethod: CruiseMethod;
  defaultBaf?: number;
  defaultPlotAcres?: number;
  targetSamplingErrorPct?: number;
}): Promise<LocalCruise> {
  const ts = now();
  const cruise: LocalCruise = {
    id: uuid(),
    name: input.name,
    regionId: input.regionId,
    defaultMethod: input.defaultMethod,
    defaultBaf: input.defaultBaf,
    defaultPlotAcres: input.defaultPlotAcres,
    targetSamplingErrorPct: input.targetSamplingErrorPct ?? 10,
    createdAt: ts,
    updatedAt: ts,
  };
  return writeRow('cruise', cruise.id, cruise);
}

export async function addStand(
  cruiseId: string,
  input: { name: string; acres: number }
): Promise<LocalStand> {
  const stand: LocalStand = {
    id: uuid(),
    cruiseId,
    name: input.name,
    acres: input.acres,
    updatedAt: now(),
  };
  return writeRow('stand', cruiseId, stand);
}

/**
 * Next plot number for a stand.
 *
 * Numbers are per-stand and monotonic, because that is how a cruiser refers to
 * them out loud ("plot 7 in the north block"). Derived by reading the maximum
 * rather than by counting, so that deleting plot 7 does not cause the next plot
 * to also be called 7.
 */
export async function nextPlotNumber(standId: string): Promise<number> {
  const plots = await db.plot.where('standId').equals(standId).toArray();
  return plots.reduce((max, p) => Math.max(max, p.number), 0) + 1;
}

export async function addPlot(
  cruise: LocalCruise,
  standId: string,
  overrides: Partial<Pick<LocalPlot, 'method' | 'baf' | 'plotAcres' | 'latitude' | 'longitude'>> = {}
): Promise<LocalPlot> {
  const method: CruiseMethod = overrides.method ?? cruise.defaultMethod;

  // The method decides which parameter is present, and the other must be
  // absent rather than merely ignored. A plot carrying both a BAF and an acreage
  // is a plot nobody can compile a year later without guessing which was meant.
  const baf = method === 'variable_radius' ? (overrides.baf ?? cruise.defaultBaf) : undefined;
  const plotAcres =
    method === 'fixed_area' ? (overrides.plotAcres ?? cruise.defaultPlotAcres) : undefined;

  if (method === 'variable_radius' && !baf) {
    throw new Error('A variable-radius plot needs a basal area factor.');
  }
  if (method === 'fixed_area' && !plotAcres) {
    throw new Error('A fixed-area plot needs a plot size in acres.');
  }

  const plot: LocalPlot = {
    id: uuid(),
    cruiseId: cruise.id,
    standId,
    number: await nextPlotNumber(standId),
    method,
    baf,
    plotAcres,
    latitude: overrides.latitude,
    longitude: overrides.longitude,
    measuredAt: now(),
    updatedAt: now(),
  };
  return writeRow('plot', cruise.id, plot);
}

/**
 * Record that a plot was visited and held no tally trees.
 *
 * This is the single most under-appreciated button in a cruising app. An empty
 * point is an observation of zero, and dropping it inflates every per-acre
 * figure the cruise produces. Marking it explicitly is also what distinguishes
 * it from a plot the cruiser has not reached yet.
 */
export async function markPlotEmpty(plot: LocalPlot, isEmpty: boolean): Promise<LocalPlot> {
  const updated: LocalPlot = {
    ...plot,
    isEmpty,
    isSkipped: isEmpty ? false : plot.isSkipped,
    updatedAt: now(),
  };
  return writeRow('plot', plot.cruiseId, updated);
}

/** Plot could not be visited — access denied, hazard, water. Excluded from statistics. */
export async function markPlotSkipped(plot: LocalPlot, isSkipped: boolean): Promise<LocalPlot> {
  const updated: LocalPlot = {
    ...plot,
    isSkipped,
    isEmpty: isSkipped ? false : plot.isEmpty,
    updatedAt: now(),
  };
  return writeRow('plot', plot.cruiseId, updated);
}

export async function nextTreeSeq(plotId: string): Promise<number> {
  const trees = await db.tree.where('plotId').equals(plotId).toArray();
  return trees.reduce((max, t) => Math.max(max, t.seq), 0) + 1;
}

export async function tallyTree(
  plot: LocalPlot,
  input: {
    species: string;
    dbh: number;
    totalHeightFt?: number;
    merchHeight?: number;
    merchHeightUnit?: 'feet' | 'logs';
    product?: ProductClass;
    defectPct?: number;
    count?: number;
    formClass?: number;
    notes?: string;
  }
): Promise<LocalTree> {
  const tree: LocalTree = {
    id: uuid(),
    cruiseId: plot.cruiseId,
    plotId: plot.id,
    seq: await nextTreeSeq(plot.id),
    species: input.species,
    dbh: input.dbh,
    totalHeightFt: input.totalHeightFt,
    merchHeight: input.merchHeight,
    merchHeightUnit: input.merchHeightUnit,
    product: input.product,
    defectPct: input.defectPct,
    count: input.count,
    formClass: input.formClass,
    notes: input.notes,
    // Everything entered on the tally screen was measured or judged in front of
    // the tree. The engine's other provenance tiers are for values that arrive
    // later — imputed heights, defaulted form class — and are set there.
    provenance: 'measured',
    updatedAt: now(),
  };

  // A plot with a tree on it is by definition not empty. Fixing this here means
  // the flag cannot be left stale by a cruiser who marked the point empty and
  // then spotted a tree in.
  if (plot.isEmpty || plot.isSkipped) {
    await writeRow('plot', plot.cruiseId, {
      ...plot,
      isEmpty: false,
      isSkipped: false,
      updatedAt: now(),
    });
  }

  return writeRow('tree', plot.cruiseId, tree);
}

export async function untallyTree(tree: LocalTree): Promise<void> {
  await deleteRow('tree', tree.cruiseId, tree.id);
}
