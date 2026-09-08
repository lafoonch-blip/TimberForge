/**
 * Cruise compilation — the orchestrator.
 *
 * Takes raw field records and produces the per-acre and per-stand numbers that
 * go into the report, the valuation, and (eventually) the LandForge feed.
 *
 * The processing order is deliberate and is the part most homegrown
 * spreadsheets get wrong:
 *
 *   1. Expand each TREE to per-acre values using its own PLOT's method.
 *   2. Accumulate those into a per-PLOT total.
 *   3. Compute statistics ACROSS PLOTS.
 *   4. Only then multiply by stand acres to get stand totals.
 *
 * Statistics never touch individual trees, because trees inside one plot are
 * not independent observations. See statistics.ts.
 */

import { basalAreaPerAcreFactor, treesPerAcreFactor } from './expansion.js';
import { FOREST_CONSTANT, BF_PER_MBF } from './constants.js';
import { findSpecies } from './regions.js';
import {
  plotsNeeded,
  sampleStatistics,
  type PlotsNeededResult,
  type SampleStatistics,
} from './statistics.js';
import { linearTaper, treeVolume, type TaperModel } from './volume.js';
import type {
  LogRuleName,
  PlotRecord,
  ProductClass,
  RegionProfile,
  StandRecord,
  TreeRecord,
} from './types.js';
import { CALC_ENGINE_VERSION, type EngineStamp } from './version.js';

export interface CompileInput {
  stands: StandRecord[];
  plots: PlotRecord[];
  trees: TreeRecord[];
  region: RegionProfile;
  /** Overrides the region's default log rule (e.g. a client requires Doyle). */
  logRule?: LogRuleName;
  /** Target sampling error, percent. Drives the "can I go home yet" answer. */
  targetSamplingErrorPct?: number;
  confidence?: 0.9 | 0.95;
  taper?: TaperModel;
}

export interface SpeciesShare {
  species: string;
  commonName: string;
  treesPerAcre: number;
  basalAreaPerAcre: number;
  netBoardFeetPerAcre: number;
  netGreenTonsPerAcre: number;
  /** Share of stand basal area, percent. The forestry-standard composition basis. */
  basalAreaPct: number;
}

export interface DiameterClassRow {
  /** Midpoint of the 2-inch class, e.g. 12 covers 11.0-12.9. */
  dbhClass: number;
  treesPerAcre: number;
  basalAreaPerAcre: number;
  netBoardFeetPerAcre: number;
  netGreenTonsPerAcre: number;
}

export interface ProductRow {
  product: ProductClass | 'unassigned';
  treesPerAcre: number;
  netBoardFeetPerAcre: number;
  netGreenTonsPerAcre: number;
}

export interface StandResult {
  standId: string;
  standName: string;
  acres: number;

  plotCount: number;
  emptyPlotCount: number;
  skippedPlotCount: number;
  treeCount: number;

  treesPerAcre: number;
  basalAreaPerAcre: number;
  /** Quadratic mean diameter, inches. */
  qmd: number;

  grossBoardFeetPerAcre: number;
  netBoardFeetPerAcre: number;
  netMbfPerAcre: number;
  netCubicFeetPerAcre: number;
  netGreenTonsPerAcre: number;

  totalNetBoardFeet: number;
  totalNetMbf: number;
  totalNetGreenTons: number;

  speciesComposition: SpeciesShare[];
  diameterDistribution: DiameterClassRow[];
  productMix: ProductRow[];

  statistics: {
    netBoardFeetPerAcre: SampleStatistics;
    basalAreaPerAcre: SampleStatistics;
    netGreenTonsPerAcre: SampleStatistics;
  };
  plotsNeeded: PlotsNeededResult | null;

  /** Per-plot expanded values, retained so the report can show the raw basis. */
  plotValues: {
    plotId: string;
    plotNumber: number;
    treesPerAcre: number;
    basalAreaPerAcre: number;
    netBoardFeetPerAcre: number;
    netGreenTonsPerAcre: number;
  }[];

  warnings: string[];
}

export interface CruiseResult {
  stands: StandResult[];
  totals: {
    acres: number;
    totalNetBoardFeet: number;
    totalNetMbf: number;
    totalNetGreenTons: number;
    weightedNetBoardFeetPerAcre: number;
    weightedNetMbfPerAcre: number;
    weightedBasalAreaPerAcre: number;
    weightedTreesPerAcre: number;
  };
  stamp: EngineStamp;
  warnings: string[];
}

/** Accumulator for one plot. */
interface PlotAccumulator {
  tpa: number;
  ba: number;
  grossBf: number;
  netBf: number;
  netCuFt: number;
  netTons: number;
}

const emptyAcc = (): PlotAccumulator => ({
  tpa: 0,
  ba: 0,
  grossBf: 0,
  netBf: 0,
  netCuFt: 0,
  netTons: 0,
});

/** 2-inch diameter class midpoint. 11.0-12.9 -> 12. */
export function diameterClass(dbh: number): number {
  return Math.max(2, Math.round(dbh / 2) * 2);
}

export function compileCruise(input: CompileInput): CruiseResult {
  const {
    stands,
    plots,
    trees,
    region,
    targetSamplingErrorPct,
    confidence = 0.95,
  } = input;
  const logRule = input.logRule ?? region.logRule;
  const taper = input.taper ?? linearTaper();
  const globalWarnings: string[] = [];

  const treesByPlot = new Map<string, TreeRecord[]>();
  for (const tree of trees) {
    const list = treesByPlot.get(tree.plotId);
    if (list) list.push(tree);
    else treesByPlot.set(tree.plotId, [tree]);
  }

  const plotsByStand = new Map<string, PlotRecord[]>();
  for (const plot of plots) {
    const list = plotsByStand.get(plot.standId);
    if (list) list.push(plot);
    else plotsByStand.set(plot.standId, [plot]);
  }

  const standResults: StandResult[] = [];
  let volumeMethodNote = '';

  for (const stand of stands) {
    const warnings: string[] = [];
    const allStandPlots = plotsByStand.get(stand.id) ?? [];
    const skipped = allStandPlots.filter((p) => p.isSkipped);
    // Skipped plots are excluded entirely; empty plots are kept as real zeros.
    const activePlots = allStandPlots.filter((p) => !p.isSkipped);

    if (activePlots.length === 0) {
      standResults.push(emptyStandResult(stand, skipped.length, [
        'No plots have been measured in this stand.',
      ]));
      continue;
    }

    const perPlot: PlotAccumulator[] = [];
    const plotValues: StandResult['plotValues'] = [];
    const speciesAcc = new Map<string, PlotAccumulator>();
    const dbhAcc = new Map<number, PlotAccumulator>();
    const productAcc = new Map<string, PlotAccumulator>();
    let treeCount = 0;
    let emptyPlots = 0;
    let missingHeightTrees = 0;

    for (const plot of activePlots) {
      const acc = emptyAcc();
      const plotTrees = treesByPlot.get(plot.id) ?? [];
      if (plotTrees.length === 0) emptyPlots++;

      for (const tree of plotTrees) {
        treeCount += tree.count ?? 1;
        const species = findSpecies(region, tree.species);
        if (!species) {
          warnings.push(
            `Species code "${tree.species}" is not in the ${region.name} species list; ` +
              `its volume could not be computed.`
          );
          continue;
        }

        const tpa = treesPerAcreFactor(tree, plot);
        const ba = basalAreaPerAcreFactor(tree, plot);

        if (tree.merchHeight === undefined || tree.merchHeight <= 0) {
          missingHeightTrees++;
        }

        const vol = treeVolume(tree, {
          logRule,
          species,
          taper,
          sawTopDib: region.sawTopDib,
        });
        if (!volumeMethodNote) volumeMethodNote = vol.method;

        // Per-tree volume is already multiplied by the tally count inside
        // treeVolume, so the expansion factor here must NOT re-apply count.
        const perTreeExpansion = tpa / (tree.count ?? 1);

        const grossBf = vol.grossBoardFeet * perTreeExpansion;
        const netBf = vol.netBoardFeet * perTreeExpansion;
        const netCuFt = vol.netCubicFeet * perTreeExpansion;
        const netTons = vol.netGreenTons * perTreeExpansion;

        acc.tpa += tpa;
        acc.ba += ba;
        acc.grossBf += grossBf;
        acc.netBf += netBf;
        acc.netCuFt += netCuFt;
        acc.netTons += netTons;

        addTo(speciesAcc, tree.species, { tpa, ba, grossBf, netBf, netCuFt, netTons });
        addTo(dbhAcc, diameterClass(tree.dbh), {
          tpa, ba, grossBf, netBf, netCuFt, netTons,
        });
        addTo(productAcc, tree.product ?? 'unassigned', {
          tpa, ba, grossBf, netBf, netCuFt, netTons,
        });
      }

      perPlot.push(acc);
      plotValues.push({
        plotId: plot.id,
        plotNumber: plot.number,
        treesPerAcre: acc.tpa,
        basalAreaPerAcre: acc.ba,
        netBoardFeetPerAcre: acc.netBf,
        netGreenTonsPerAcre: acc.netTons,
      });
    }

    const n = perPlot.length;
    const mean = (pick: (a: PlotAccumulator) => number) =>
      perPlot.reduce((s, a) => s + pick(a), 0) / n;

    const tpa = mean((a) => a.tpa);
    const ba = mean((a) => a.ba);
    const grossBf = mean((a) => a.grossBf);
    const netBf = mean((a) => a.netBf);
    const netCuFt = mean((a) => a.netCuFt);
    const netTons = mean((a) => a.netTons);

    // QMD is the diameter of the tree of average basal area. Deriving it from
    // BA and TPA (rather than averaging diameters) is what makes it consistent
    // with the expanded stand, and is why it always exceeds the arithmetic mean.
    const qmd = tpa > 0 ? Math.sqrt(ba / (FOREST_CONSTANT * tpa)) : 0;

    const bfStats = sampleStatistics(perPlot.map((a) => a.netBf), confidence);
    const baStats = sampleStatistics(perPlot.map((a) => a.ba), confidence);
    const tonStats = sampleStatistics(perPlot.map((a) => a.netTons), confidence);

    const needed =
      targetSamplingErrorPct !== undefined
        ? plotsNeeded(bfStats, targetSamplingErrorPct, confidence)
        : null;

    if (missingHeightTrees > 0) {
      warnings.push(
        `${missingHeightTrees} tree(s) had no merchantable height and contributed ` +
          `zero volume. Measure a height subsample and impute, or volume will be ` +
          `understated.`
      );
    }
    if (stand.acres <= 0) {
      warnings.push('Stand acreage is zero or missing; stand totals cannot be scaled.');
    }
    if (n < 2) {
      warnings.push(
        'Only one plot measured; no sampling error can be computed for this stand.'
      );
    }

    const totalBa = ba;
    const speciesComposition: SpeciesShare[] = [...speciesAcc.entries()]
      .map(([code, a]) => {
        const cfg = findSpecies(region, code);
        return {
          species: code,
          commonName: cfg?.commonName ?? code,
          treesPerAcre: a.tpa / n,
          basalAreaPerAcre: a.ba / n,
          netBoardFeetPerAcre: a.netBf / n,
          netGreenTonsPerAcre: a.netTons / n,
          basalAreaPct: totalBa > 0 ? (a.ba / n / totalBa) * 100 : 0,
        };
      })
      .sort((x, y) => y.basalAreaPct - x.basalAreaPct);

    const diameterDistribution: DiameterClassRow[] = [...dbhAcc.entries()]
      .map(([cls, a]) => ({
        dbhClass: cls,
        treesPerAcre: a.tpa / n,
        basalAreaPerAcre: a.ba / n,
        netBoardFeetPerAcre: a.netBf / n,
        netGreenTonsPerAcre: a.netTons / n,
      }))
      .sort((x, y) => x.dbhClass - y.dbhClass);

    const productMix: ProductRow[] = [...productAcc.entries()]
      .map(([product, a]) => ({
        product: product as ProductClass | 'unassigned',
        treesPerAcre: a.tpa / n,
        netBoardFeetPerAcre: a.netBf / n,
        netGreenTonsPerAcre: a.netTons / n,
      }))
      .sort((x, y) => y.netBoardFeetPerAcre - x.netBoardFeetPerAcre);

    standResults.push({
      standId: stand.id,
      standName: stand.name,
      acres: stand.acres,
      plotCount: n,
      emptyPlotCount: emptyPlots,
      skippedPlotCount: skipped.length,
      treeCount,
      treesPerAcre: tpa,
      basalAreaPerAcre: ba,
      qmd,
      grossBoardFeetPerAcre: grossBf,
      netBoardFeetPerAcre: netBf,
      netMbfPerAcre: netBf / BF_PER_MBF,
      netCubicFeetPerAcre: netCuFt,
      netGreenTonsPerAcre: netTons,
      totalNetBoardFeet: netBf * stand.acres,
      totalNetMbf: (netBf * stand.acres) / BF_PER_MBF,
      totalNetGreenTons: netTons * stand.acres,
      speciesComposition,
      diameterDistribution,
      productMix,
      statistics: {
        netBoardFeetPerAcre: bfStats,
        basalAreaPerAcre: baStats,
        netGreenTonsPerAcre: tonStats,
      },
      plotsNeeded: needed,
      plotValues,
      warnings,
    });
  }

  const acres = standResults.reduce((s, r) => s + r.acres, 0);
  const totalNetBf = standResults.reduce((s, r) => s + r.totalNetBoardFeet, 0);
  const totalTons = standResults.reduce((s, r) => s + r.totalNetGreenTons, 0);
  const weightedBa =
    acres > 0
      ? standResults.reduce((s, r) => s + r.basalAreaPerAcre * r.acres, 0) / acres
      : 0;
  const weightedTpa =
    acres > 0
      ? standResults.reduce((s, r) => s + r.treesPerAcre * r.acres, 0) / acres
      : 0;

  return {
    stands: standResults,
    totals: {
      acres,
      totalNetBoardFeet: totalNetBf,
      totalNetMbf: totalNetBf / BF_PER_MBF,
      totalNetGreenTons: totalTons,
      weightedNetBoardFeetPerAcre: acres > 0 ? totalNetBf / acres : 0,
      weightedNetMbfPerAcre: acres > 0 ? totalNetBf / acres / BF_PER_MBF : 0,
      weightedBasalAreaPerAcre: weightedBa,
      weightedTreesPerAcre: weightedTpa,
    },
    stamp: {
      calcEngine: CALC_ENGINE_VERSION,
      logRule,
      regionProfile: region.id,
      volumeMethod: volumeMethodNote || 'no volume computed',
      computedAt: new Date().toISOString(),
    },
    warnings: globalWarnings,
  };
}

function addTo<K>(
  map: Map<K, PlotAccumulator>,
  key: K,
  add: PlotAccumulator
): void {
  const cur = map.get(key) ?? emptyAcc();
  cur.tpa += add.tpa;
  cur.ba += add.ba;
  cur.grossBf += add.grossBf;
  cur.netBf += add.netBf;
  cur.netCuFt += add.netCuFt;
  cur.netTons += add.netTons;
  map.set(key, cur);
}

function emptyStandResult(
  stand: StandRecord,
  skippedCount: number,
  warnings: string[]
): StandResult {
  const zeroStats = sampleStatistics([]);
  return {
    standId: stand.id,
    standName: stand.name,
    acres: stand.acres,
    plotCount: 0,
    emptyPlotCount: 0,
    skippedPlotCount: skippedCount,
    treeCount: 0,
    treesPerAcre: 0,
    basalAreaPerAcre: 0,
    qmd: 0,
    grossBoardFeetPerAcre: 0,
    netBoardFeetPerAcre: 0,
    netMbfPerAcre: 0,
    netCubicFeetPerAcre: 0,
    netGreenTonsPerAcre: 0,
    totalNetBoardFeet: 0,
    totalNetMbf: 0,
    totalNetGreenTons: 0,
    speciesComposition: [],
    diameterDistribution: [],
    productMix: [],
    statistics: {
      netBoardFeetPerAcre: zeroStats,
      basalAreaPerAcre: zeroStats,
      netGreenTonsPerAcre: zeroStats,
    },
    plotsNeeded: null,
    plotValues: [],
    warnings,
  };
}
