/**
 * Expansion factors — how one tallied tree becomes per-acre numbers.
 *
 * This is the single place where cruise methodology enters the arithmetic.
 * Everything downstream (metrics, volume, statistics) works on already-expanded
 * per-acre values and is therefore methodology-agnostic. Adding 3P or sample-tree
 * later means adding a case here, not rewriting the engine.
 */

import { FOREST_CONSTANT } from './constants.js';
import type { PlotRecord, TreeRecord } from './types.js';

/** Basal area of a single tree, square feet, from DBH in inches. */
export function basalArea(dbhIn: number): number {
  if (dbhIn <= 0) return 0;
  return FOREST_CONSTANT * dbhIn * dbhIn;
}

/**
 * Trees-per-acre represented by ONE tallied tree on ONE plot.
 *
 * Variable-radius (point sampling): the elegant property of angle-gauge
 * sampling is that every tallied tree contributes exactly BAF square feet of
 * basal area per acre regardless of its size. Its tree count contribution,
 * however, is inversely proportional to its basal area — big trees represent
 * few trees per acre, small trees represent many:
 *
 *   TPA = BAF / (0.005454154 * DBH^2)
 *
 * Fixed-area: every tree in the plot represents 1/plotAcres trees per acre,
 * regardless of size.
 *
 *   TPA = 1 / plotAcres
 */
export function treesPerAcreFactor(tree: TreeRecord, plot: PlotRecord): number {
  const count = tree.count ?? 1;
  if (plot.method === 'variable_radius') {
    const baf = plot.baf;
    if (baf === undefined || baf <= 0) {
      throw new Error(
        `Plot ${plot.number} (${plot.id}) is variable_radius but has no positive BAF.`
      );
    }
    const ba = basalArea(tree.dbh);
    if (ba <= 0) return 0;
    return (baf / ba) * count;
  }
  const acres = plot.plotAcres;
  if (acres === undefined || acres <= 0) {
    throw new Error(
      `Plot ${plot.number} (${plot.id}) is fixed_area but has no positive plotAcres.`
    );
  }
  return (1 / acres) * count;
}

/**
 * Basal-area-per-acre represented by ONE tallied tree on ONE plot.
 *
 * For variable-radius this is simply the BAF (times the tally count) — the
 * defining property of the method. For fixed-area it is the tree's own basal
 * area expanded by the plot factor.
 */
export function basalAreaPerAcreFactor(tree: TreeRecord, plot: PlotRecord): number {
  const count = tree.count ?? 1;
  if (plot.method === 'variable_radius') {
    const baf = plot.baf;
    if (baf === undefined || baf <= 0) {
      throw new Error(
        `Plot ${plot.number} (${plot.id}) is variable_radius but has no positive BAF.`
      );
    }
    return baf * count;
  }
  const acres = plot.plotAcres;
  if (acres === undefined || acres <= 0) {
    throw new Error(
      `Plot ${plot.number} (${plot.id}) is fixed_area but has no positive plotAcres.`
    );
  }
  return (basalArea(tree.dbh) / acres) * count;
}

/**
 * Limiting distance for a variable-radius plot: the maximum horizontal distance
 * at which a tree of the given DBH is still "in" for this BAF.
 *
 *   PRF (plot radius factor) = 8.696 / sqrt(BAF)   feet per inch of DBH
 *   limiting distance        = PRF * DBH
 *
 * 8.696 is the standard constant derived from the angle-gauge geometry. This is
 * what a cruiser needs when a tree is borderline and has to be checked with a
 * tape rather than eyeballed — the most common source of avoidable point-sample
 * bias in the field, and therefore worth exposing directly in the UI.
 */
export function limitingDistanceFt(dbhIn: number, baf: number): number {
  if (baf <= 0) throw new Error('BAF must be positive.');
  if (dbhIn <= 0) return 0;
  return (8.696 / Math.sqrt(baf)) * dbhIn;
}

/**
 * Radius, in feet, of a circular fixed-area plot of the given size in acres.
 * Used to render the plot on the field map and to check borderline trees.
 */
export function fixedPlotRadiusFt(plotAcres: number): number {
  if (plotAcres <= 0) throw new Error('plotAcres must be positive.');
  return Math.sqrt((plotAcres * 43560) / Math.PI);
}
