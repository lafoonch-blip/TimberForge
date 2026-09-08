/**
 * Standing-tree volume.
 *
 * HONEST SCOPE NOTE. This module implements a *form-class taper* approach:
 * Girard form class fixes the diameter at the top of the first 16-ft log, and
 * a linear taper carries diameter up the stem from there. That is a real,
 * teachable, defensible method — it is how Mesavage & Girard volume tables were
 * constructed and it is what a great many consulting cruises still run on.
 *
 * It is NOT a species-specific regional volume equation. Production TimberForge
 * should ultimately resolve a fitted equation per species per region (Clark,
 * Amateis-Burkhart, Wiley, FIA NSVB, etc.). `VolumeEquation` below is the seam
 * for that: `formClassVolume` is one implementation of the interface, and a
 * region profile can supply another without any caller changing.
 *
 * Being explicit about this matters more than it might seem. A cruiser who
 * discovers unannounced that we used a generic taper where they expected a
 * local equation stops trusting the whole report. Stating the method in the
 * output (see `VolumeResult.method`) is a product requirement, not a nicety.
 */

import { FOREST_CONSTANT, LB_PER_TON, STANDARD_LOG_FT } from './constants.js';
import { getLogRule, type LogRule } from './logRules.js';
import type { LogRuleName, SpeciesConfig, TreeRecord } from './types.js';

export interface VolumeResult {
  /** Gross board feet, before defect deduction. */
  grossBoardFeet: number;
  /** Net board feet, after the tree's defect percentage. */
  netBoardFeet: number;
  /** Gross merchantable cubic feet. */
  grossCubicFeet: number;
  /** Net merchantable cubic feet. */
  netCubicFeet: number;
  /** Net green weight, short tons. */
  netGreenTons: number;
  /** Number of 16-ft logs used, including any fractional top log. */
  logs: number;
  /** Human-readable statement of exactly how this was computed. */
  method: string;
}

export interface TaperModel {
  /**
   * Diameter inside bark, inches, at a given height in 16-ft logs above the
   * top of the stump. `logsUp` of 0 means the top of the first log.
   */
  dibAtLog(dbhIn: number, formClass: number, logsUp: number): number;
  readonly description: string;
}

/**
 * Linear form-class taper.
 *
 * Diameter at the top of the first log is fixed by form class:
 *   DIB(first log top) = formClass% * DBH
 * Above that, diameter falls by a constant amount per additional 16-ft log.
 *
 * `taperInPerLog` defaults are conventional working values, not fitted
 * constants: softwoods hold form better than hardwoods, so they taper less.
 * A region profile should override these once local data exists.
 */
export function linearTaper(taperInPerLog = 1.6): TaperModel {
  return {
    description: `linear form-class taper, ${taperInPerLog} in per 16-ft log above the first`,
    dibAtLog(dbhIn: number, formClass: number, logsUp: number): number {
      const firstLogTop = (formClass / 100) * dbhIn;
      return firstLogTop - taperInPerLog * Math.max(0, logsUp);
    },
  };
}

export interface VolumeOptions {
  logRule: LogRuleName | string;
  species: SpeciesConfig;
  taper?: TaperModel;
  /** Merchantable top DIB for sawtimber, inches. Below this, stop scaling. */
  sawTopDib?: number;
  /** Override the species form class for this tree. */
  formClass?: number;
}

/**
 * Compute volume for a single standing tree.
 *
 * Requires a merchantable height. A tree with no merchantable height cannot be
 * volumed and returns zeros rather than a guess — silently inventing a height
 * would be exactly the kind of fabrication the product principles forbid. The
 * caller is responsible for height imputation (regressing merch height on DBH
 * from the measured subsample) and for marking such heights as `estimated`.
 */
export function treeVolume(tree: TreeRecord, opts: VolumeOptions): VolumeResult {
  const taper = opts.taper ?? linearTaper();
  const formClass = tree.formClass ?? opts.formClass ?? opts.species.formClass;
  const rule: LogRule = getLogRule(opts.logRule);
  const sawTop = opts.sawTopDib ?? 6;
  const method =
    `${opts.logRule} log rule; Girard form class ${formClass}; ${taper.description}; ` +
    `merch top DIB ${sawTop} in; cubic by Smalian on 16-ft sections`;

  const empty: VolumeResult = {
    grossBoardFeet: 0,
    netBoardFeet: 0,
    grossCubicFeet: 0,
    netCubicFeet: 0,
    netGreenTons: 0,
    logs: 0,
    method,
  };

  if (tree.merchHeight === undefined || tree.merchHeight <= 0) return empty;
  if (tree.dbh <= 0) return empty;

  const totalLogs =
    tree.merchHeightUnit === 'feet'
      ? tree.merchHeight / STANDARD_LOG_FT
      : tree.merchHeight;
  if (totalLogs <= 0) return empty;

  const count = tree.count ?? 1;
  const defect = Math.min(Math.max(tree.defectPct ?? 0, 0), 100);

  let grossBf = 0;
  let grossCuFt = 0;
  let logsScaled = 0;

  const wholeLogs = Math.floor(totalLogs);
  const fraction = totalLogs - wholeLogs;

  for (let i = 0; i < wholeLogs; i++) {
    // Small end (top) of log i is `i` logs above the first log top when i>0.
    const topDib = taper.dibAtLog(tree.dbh, formClass, i);
    const buttDib = i === 0 ? tree.dbh : taper.dibAtLog(tree.dbh, formClass, i - 1);
    if (topDib < sawTop) break;
    grossBf += rule(topDib, STANDARD_LOG_FT);
    grossCuFt += smalianCubicFeet(topDib, buttDib, STANDARD_LOG_FT);
    logsScaled += 1;
  }

  if (fraction > 0) {
    const partialLen = fraction * STANDARD_LOG_FT;
    const topDib = taper.dibAtLog(tree.dbh, formClass, wholeLogs - 1 + fraction);
    const buttDib =
      wholeLogs === 0 ? tree.dbh : taper.dibAtLog(tree.dbh, formClass, wholeLogs - 1);
    if (topDib >= sawTop) {
      grossBf += rule(topDib, partialLen);
      grossCuFt += smalianCubicFeet(topDib, buttDib, partialLen);
      logsScaled += fraction;
    }
  }

  grossBf *= count;
  grossCuFt *= count;

  const netFactor = 1 - defect / 100;
  const netBf = grossBf * netFactor;
  const netCuFt = grossCuFt * netFactor;
  const netTons = (netCuFt * opts.species.greenLbPerCuFt) / LB_PER_TON;

  return {
    grossBoardFeet: grossBf,
    netBoardFeet: netBf,
    grossCubicFeet: grossCuFt,
    netCubicFeet: netCuFt,
    netGreenTons: netTons,
    logs: logsScaled * count,
    method,
  };
}

/**
 * Smalian's formula for the cubic volume of a log section.
 *
 *   V = (A_small + A_large) / 2 * L
 *
 * Cross-sectional area in square feet from a diameter in inches is the same
 * foresters' constant used for basal area. Smalian slightly overestimates for
 * strongly tapered sections; over 16-ft bolts on merchantable stems the error
 * is small and it is the standard field method.
 */
export function smalianCubicFeet(
  smallEndDibIn: number,
  largeEndDibIn: number,
  lengthFt: number
): number {
  if (smallEndDibIn <= 0 || largeEndDibIn <= 0 || lengthFt <= 0) return 0;
  const aSmall = FOREST_CONSTANT * smallEndDibIn * smallEndDibIn;
  const aLarge = FOREST_CONSTANT * largeEndDibIn * largeEndDibIn;
  return ((aSmall + aLarge) / 2) * lengthFt;
}
