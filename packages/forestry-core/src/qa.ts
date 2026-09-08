/**
 * Field data quality control.
 *
 * These rules exist because a timber cruise is a professional work product. The
 * expensive failure is not a crash — it is a plausible-looking number that is
 * wrong, delivered to a client, discovered months later.
 *
 * Two design rules govern this module:
 *
 * 1. QA NEVER MUTATES DATA. It flags. A cruiser looking at a 42-inch loblolly
 *    is the only one who knows whether that is a mis-key or a legacy yard tree.
 *    Silently "correcting" it would destroy the exact ground truth TimberForge
 *    exists to collect.
 *
 * 2. SEVERITY IS ABOUT CONSEQUENCE, NOT CONFIDENCE. `error` means the number
 *    that comes out is wrong or missing. `warning` means it is probably wrong.
 *    `info` means a human should look. Only `error` should block a report from
 *    being marked final.
 *
 * Thresholds below are deliberately loose. A QA system that cries wolf gets
 * ignored, and an ignored QA system is worse than none because it manufactures
 * false assurance.
 */

import { limitingDistanceFt } from './expansion.js';
import { findSpecies } from './regions.js';
import type {
  PlotRecord,
  RegionProfile,
  StandRecord,
  TreeRecord,
} from './types.js';

export type QaSeverity = 'error' | 'warning' | 'info';

export interface QaFinding {
  /** Stable machine code, e.g. 'TREE_MISSING_HEIGHT'. Safe to filter/suppress on. */
  code: string;
  severity: QaSeverity;
  /** What is wrong, in language a cruiser would use. */
  message: string;
  /** What to do about it. Omitted only when the fix is obvious from the message. */
  remedy?: string;
  scope: 'tree' | 'plot' | 'stand' | 'cruise';
  treeId?: string;
  plotId?: string;
  standId?: string;
  /** The offending value, for display next to the message. */
  value?: number | string;
}

export interface QaThresholds {
  /** DBH below this is almost certainly a mis-key. Inches. */
  minPlausibleDbh: number;
  /** DBH above this warrants a look. Inches. */
  maxPlausibleDbh: number;
  /** Merch height above this warrants a look. Feet. */
  maxPlausibleMerchHeightFt: number;
  /** Merch logs above this warrants a look. 16-ft logs. */
  maxPlausibleLogs: number;
  /** Height:DBH ratio above this is implausibly slender (ft per inch). */
  maxHeightToDbhRatio: number;
  /** Defect percent at or above this is a cull call, not a deduction. */
  highDefectPct: number;
  /** Trees on a single VRP point above this suggests a wrong BAF. */
  maxTreesPerPoint: number;
  /**
   * Modified z-score above which a plot's per-acre volume is flagged.
   *
   * NOT a standard-deviation multiple. A classic mean/SD z-score CANNOT work
   * here, and the reason is worth recording because it is a trap:
   *
   *   For a sample of size n, the largest possible z-score is (n-1)/sqrt(n).
   *   At n=5 that ceiling is 1.79; at n=10 it is 2.85.
   *
   * So a "flag anything beyond 3 sigma" rule is silently INERT for every cruise
   * with fewer than about 11 plots — which is most consulting cruises. The
   * single outlier inflates the standard deviation enough to hide itself. This
   * is the textbook masking effect.
   *
   * We therefore use the Iglewicz-Hoaglin modified z-score, built on the median
   * and the median absolute deviation, which no single point can inflate:
   *
   *   modified z = 0.6745 * (x - median) / MAD
   *
   * 3.5 is their conventional threshold and is loose enough to respect the fact
   * that timber is genuinely patchy.
   */
  plotOutlierModifiedZ: number;
  /** Fraction of trees allowed to lack merch height before it is an error. */
  maxMissingHeightFraction: number;
}

export const DEFAULT_THRESHOLDS: QaThresholds = {
  minPlausibleDbh: 1,
  maxPlausibleDbh: 48,
  maxPlausibleMerchHeightFt: 120,
  maxPlausibleLogs: 7,
  maxHeightToDbhRatio: 12,
  highDefectPct: 90,
  maxTreesPerPoint: 25,
  plotOutlierModifiedZ: 3.5,
  maxMissingHeightFraction: 0.5,
};

export interface QaInput {
  stands: StandRecord[];
  plots: PlotRecord[];
  trees: TreeRecord[];
  region: RegionProfile;
  thresholds?: Partial<QaThresholds>;
  /**
   * Per-plot net board feet per acre, keyed by plot id. Supply the values from
   * a CruiseResult to enable plot-divergence checks. Optional — every other
   * rule works on raw field data alone, which is what the field app has.
   */
  plotVolumes?: Record<string, number>;
}

export interface QaReport {
  findings: QaFinding[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  /** True when nothing is severity 'error'. The gate for finalizing a report. */
  passesForRelease: boolean;
}

export function runQa(input: QaInput): QaReport {
  const t = { ...DEFAULT_THRESHOLDS, ...(input.thresholds ?? {}) };
  const { stands, plots, trees, region } = input;
  const findings: QaFinding[] = [];
  const add = (f: QaFinding) => findings.push(f);

  const plotById = new Map(plots.map((p) => [p.id, p]));
  const standById = new Map(stands.map((s) => [s.id, s]));

  // ---------------------------------------------------------------- structure

  const seenTreeIds = new Set<string>();
  for (const tree of trees) {
    if (seenTreeIds.has(tree.id)) {
      add({
        code: 'TREE_DUPLICATE_ID',
        severity: 'error',
        scope: 'tree',
        treeId: tree.id,
        message: `Tree id "${tree.id}" appears more than once.`,
        remedy:
          'Duplicate ids usually mean a sync replayed. Delete the copy or re-key it.',
      });
    }
    seenTreeIds.add(tree.id);

    if (!plotById.has(tree.plotId)) {
      add({
        code: 'TREE_ORPHANED',
        severity: 'error',
        scope: 'tree',
        treeId: tree.id,
        plotId: tree.plotId,
        message: `Tree references plot "${tree.plotId}", which does not exist.`,
        remedy: 'This tree will not be counted anywhere until it is reassigned.',
      });
    }
  }

  const seenPlotIds = new Set<string>();
  const plotNumbersByStand = new Map<string, Set<number>>();
  for (const plot of plots) {
    if (seenPlotIds.has(plot.id)) {
      add({
        code: 'PLOT_DUPLICATE_ID',
        severity: 'error',
        scope: 'plot',
        plotId: plot.id,
        message: `Plot id "${plot.id}" appears more than once.`,
      });
    }
    seenPlotIds.add(plot.id);

    if (!standById.has(plot.standId)) {
      add({
        code: 'PLOT_ORPHANED',
        severity: 'error',
        scope: 'plot',
        plotId: plot.id,
        standId: plot.standId,
        message: `Plot ${plot.number} references stand "${plot.standId}", which does not exist.`,
      });
    }

    const nums = plotNumbersByStand.get(plot.standId) ?? new Set<number>();
    if (nums.has(plot.number)) {
      add({
        code: 'PLOT_DUPLICATE_NUMBER',
        severity: 'warning',
        scope: 'plot',
        plotId: plot.id,
        standId: plot.standId,
        value: plot.number,
        message: `Two plots in this stand are both numbered ${plot.number}.`,
        remedy:
          'Renumber one. Duplicate plot numbers make the report impossible to audit against the field sheet.',
      });
    }
    nums.add(plot.number);
    plotNumbersByStand.set(plot.standId, nums);

    // ------------------------------------------------------- method integrity
    if (plot.method === 'variable_radius') {
      if (plot.baf === undefined || plot.baf <= 0) {
        add({
          code: 'PLOT_MISSING_BAF',
          severity: 'error',
          scope: 'plot',
          plotId: plot.id,
          standId: plot.standId,
          message: `Plot ${plot.number} is a variable-radius point with no BAF.`,
          remedy:
            'Every tree on this point expands by BAF/(0.005454·DBH²). Without a BAF there is no volume.',
        });
      }
      if (plot.plotAcres !== undefined) {
        add({
          code: 'PLOT_METHOD_MIXED_FIELDS',
          severity: 'info',
          scope: 'plot',
          plotId: plot.id,
          message: `Plot ${plot.number} is variable-radius but also carries a plot size in acres, which is ignored.`,
        });
      }
    } else {
      if (plot.plotAcres === undefined || plot.plotAcres <= 0) {
        add({
          code: 'PLOT_MISSING_AREA',
          severity: 'error',
          scope: 'plot',
          plotId: plot.id,
          standId: plot.standId,
          message: `Plot ${plot.number} is a fixed-area plot with no plot size.`,
          remedy: 'Expansion is 1/acres per tree; without acres there is no volume.',
        });
      }
      if (plot.baf !== undefined) {
        add({
          code: 'PLOT_METHOD_MIXED_FIELDS',
          severity: 'info',
          scope: 'plot',
          plotId: plot.id,
          message: `Plot ${plot.number} is fixed-area but also carries a BAF, which is ignored.`,
        });
      }
    }

    if (plot.isEmpty && plot.isSkipped) {
      add({
        code: 'PLOT_EMPTY_AND_SKIPPED',
        severity: 'error',
        scope: 'plot',
        plotId: plot.id,
        message: `Plot ${plot.number} is marked both empty and skipped.`,
        remedy:
          'These mean opposite things. Empty is a measured zero and counts; skipped was never visited and does not.',
      });
    }

    const plotTrees = trees.filter((tr) => tr.plotId === plot.id);
    if (plot.isEmpty && plotTrees.length > 0) {
      add({
        code: 'PLOT_EMPTY_WITH_TREES',
        severity: 'error',
        scope: 'plot',
        plotId: plot.id,
        value: plotTrees.length,
        message: `Plot ${plot.number} is marked empty but has ${plotTrees.length} tallied tree(s).`,
      });
    }
    if (plot.isSkipped && plotTrees.length > 0) {
      add({
        code: 'PLOT_SKIPPED_WITH_TREES',
        severity: 'error',
        scope: 'plot',
        plotId: plot.id,
        value: plotTrees.length,
        message: `Plot ${plot.number} is marked skipped but has ${plotTrees.length} tallied tree(s), which will be discarded.`,
      });
    }
    if (!plot.isEmpty && !plot.isSkipped && plotTrees.length === 0) {
      add({
        code: 'PLOT_NO_TREES_NOT_MARKED_EMPTY',
        severity: 'warning',
        scope: 'plot',
        plotId: plot.id,
        message: `Plot ${plot.number} has no trees but is not marked empty.`,
        remedy:
          'Mark it empty if you stood there and nothing was in. An unmarked zero is indistinguishable from a plot you forgot to enter.',
      });
    }

    if (
      !plot.isSkipped &&
      (plot.latitude === undefined || plot.longitude === undefined)
    ) {
      add({
        code: 'PLOT_NO_LOCATION',
        severity: 'info',
        scope: 'plot',
        plotId: plot.id,
        message: `Plot ${plot.number} has no GPS location.`,
        remedy:
          'Plot locations are what make a cruise re-checkable and are required by most cruise contracts.',
      });
    }

    if (plotTrees.length > t.maxTreesPerPoint && plot.method === 'variable_radius') {
      add({
        code: 'PLOT_HIGH_TALLY',
        severity: 'warning',
        scope: 'plot',
        plotId: plot.id,
        value: plotTrees.length,
        message: `Plot ${plot.number} tallied ${plotTrees.length} trees on one point.`,
        remedy:
          'A point that busy usually means the BAF is too low for this stand. Check the prism factor.',
      });
    }
  }

  // -------------------------------------------------------------------- trees

  for (const tree of trees) {
    const plot = plotById.get(tree.plotId);
    const where = plot ? `plot ${plot.number}` : `plot ${tree.plotId}`;

    if (!Number.isFinite(tree.dbh) || tree.dbh <= 0) {
      add({
        code: 'TREE_INVALID_DBH',
        severity: 'error',
        scope: 'tree',
        treeId: tree.id,
        plotId: tree.plotId,
        value: tree.dbh,
        message: `Tree on ${where} has a DBH of ${tree.dbh}.`,
      });
    } else {
      if (tree.dbh < t.minPlausibleDbh) {
        add({
          code: 'TREE_DBH_BELOW_RANGE',
          severity: 'warning',
          scope: 'tree',
          treeId: tree.id,
          plotId: tree.plotId,
          value: tree.dbh,
          message: `DBH of ${tree.dbh}" on ${where} is below the plausible range.`,
        });
      }
      if (tree.dbh > t.maxPlausibleDbh) {
        add({
          code: 'TREE_DBH_ABOVE_RANGE',
          severity: 'warning',
          scope: 'tree',
          treeId: tree.id,
          plotId: tree.plotId,
          value: tree.dbh,
          message: `DBH of ${tree.dbh}" on ${where} is unusually large.`,
          remedy:
            'Confirm it is not a transposed entry. Large trees carry disproportionate volume, so one mis-key moves the stand.',
        });
      }
    }

    const species = findSpecies(region, tree.species);
    if (!species) {
      add({
        code: 'TREE_UNKNOWN_SPECIES',
        severity: 'error',
        scope: 'tree',
        treeId: tree.id,
        plotId: tree.plotId,
        value: tree.species,
        message: `Species code "${tree.species}" is not in the ${region.name} species list.`,
        remedy:
          'Add it to the region profile or correct the code. Unknown species contribute zero volume.',
      });
    }

    if (tree.merchHeight === undefined || tree.merchHeight <= 0) {
      if (tree.product !== 'cull') {
        add({
          code: 'TREE_MISSING_HEIGHT',
          severity: 'warning',
          scope: 'tree',
          treeId: tree.id,
          plotId: tree.plotId,
          message: `Tree on ${where} has no merchantable height and will contribute zero volume.`,
          remedy:
            'Measure a height subsample and impute heights from DBH, or enter a height.',
        });
      }
    } else {
      const heightFt =
        tree.merchHeightUnit === 'logs'
          ? tree.merchHeight * 16
          : tree.merchHeight;
      if (tree.merchHeightUnit === 'logs' && tree.merchHeight > t.maxPlausibleLogs) {
        add({
          code: 'TREE_HEIGHT_ABOVE_RANGE',
          severity: 'warning',
          scope: 'tree',
          treeId: tree.id,
          plotId: tree.plotId,
          value: tree.merchHeight,
          message: `${tree.merchHeight} merchantable logs on ${where} is unusually tall.`,
        });
      } else if (
        tree.merchHeightUnit !== 'logs' &&
        heightFt > t.maxPlausibleMerchHeightFt
      ) {
        add({
          code: 'TREE_HEIGHT_ABOVE_RANGE',
          severity: 'warning',
          scope: 'tree',
          treeId: tree.id,
          plotId: tree.plotId,
          value: heightFt,
          message: `Merchantable height of ${heightFt} ft on ${where} is unusually tall.`,
        });
      }

      // A stem far taller than its diameter supports is the classic symptom of
      // a DBH entered in the wrong column or a height entered in feet where
      // logs were expected.
      if (tree.dbh > 0 && heightFt / tree.dbh > t.maxHeightToDbhRatio) {
        add({
          code: 'TREE_IMPLAUSIBLE_TAPER',
          severity: 'warning',
          scope: 'tree',
          treeId: tree.id,
          plotId: tree.plotId,
          value: Number((heightFt / tree.dbh).toFixed(1)),
          message:
            `Tree on ${where} is ${heightFt} ft merchantable on a ${tree.dbh}" stem — ` +
            `too slender to stand.`,
          remedy:
            'Usually a height entered in feet where logs were meant, or a transposed DBH.',
        });
      }
    }

    if (
      tree.merchHeight !== undefined &&
      tree.merchHeight > 0 &&
      tree.merchHeightUnit === undefined
    ) {
      add({
        code: 'TREE_HEIGHT_UNIT_MISSING',
        severity: 'error',
        scope: 'tree',
        treeId: tree.id,
        plotId: tree.plotId,
        value: tree.merchHeight,
        message: `Tree on ${where} has a merchantable height of ${tree.merchHeight} with no unit.`,
        remedy:
          'Feet vs. 16-ft logs is a 16x difference. This must be explicit, never guessed.',
      });
    }

    if (tree.totalHeightFt !== undefined && tree.merchHeight !== undefined) {
      const merchFt =
        tree.merchHeightUnit === 'logs' ? tree.merchHeight * 16 : tree.merchHeight;
      if (merchFt > tree.totalHeightFt) {
        add({
          code: 'TREE_MERCH_EXCEEDS_TOTAL',
          severity: 'error',
          scope: 'tree',
          treeId: tree.id,
          plotId: tree.plotId,
          value: merchFt,
          message: `Merchantable height (${merchFt} ft) exceeds total height (${tree.totalHeightFt} ft) on ${where}.`,
        });
      }
    }

    if (tree.defectPct !== undefined) {
      if (tree.defectPct < 0 || tree.defectPct > 100) {
        add({
          code: 'TREE_DEFECT_OUT_OF_RANGE',
          severity: 'error',
          scope: 'tree',
          treeId: tree.id,
          plotId: tree.plotId,
          value: tree.defectPct,
          message: `Defect of ${tree.defectPct}% on ${where} is outside 0-100.`,
        });
      } else if (tree.defectPct >= t.highDefectPct && tree.product !== 'cull') {
        add({
          code: 'TREE_HIGH_DEFECT_NOT_CULL',
          severity: 'info',
          scope: 'tree',
          treeId: tree.id,
          plotId: tree.plotId,
          value: tree.defectPct,
          message: `Tree on ${where} is ${tree.defectPct}% defect but is not classed as cull.`,
        });
      }
    }

    if (tree.count !== undefined && (!Number.isInteger(tree.count) || tree.count < 1)) {
      add({
        code: 'TREE_INVALID_COUNT',
        severity: 'error',
        scope: 'tree',
        treeId: tree.id,
        plotId: tree.plotId,
        value: tree.count,
        message: `Tally count of ${tree.count} on ${where} must be a positive whole number.`,
      });
    }

    if (tree.formClass !== undefined && (tree.formClass < 55 || tree.formClass > 95)) {
      add({
        code: 'TREE_FORM_CLASS_OUT_OF_RANGE',
        severity: 'warning',
        scope: 'tree',
        treeId: tree.id,
        plotId: tree.plotId,
        value: tree.formClass,
        message: `Form class ${tree.formClass} on ${where} is outside the usual 55-95 range.`,
      });
    }

    // --------------------------------------------- product vs. size coherence
    if (tree.product === 'sawtimber' && tree.dbh > 0 && tree.dbh < region.sawtimberMinDbh) {
      add({
        code: 'TREE_PRODUCT_SIZE_CONFLICT',
        severity: 'warning',
        scope: 'tree',
        treeId: tree.id,
        plotId: tree.plotId,
        value: tree.dbh,
        message:
          `Tree on ${where} is called sawtimber at ${tree.dbh}", below the ` +
          `${region.name} sawtimber minimum of ${region.sawtimberMinDbh}".`,
      });
    }
    if (tree.product === 'pulpwood' && tree.dbh > 0 && tree.dbh < region.pulpwoodMinDbh) {
      add({
        code: 'TREE_PRODUCT_SIZE_CONFLICT',
        severity: 'warning',
        scope: 'tree',
        treeId: tree.id,
        plotId: tree.plotId,
        value: tree.dbh,
        message:
          `Tree on ${where} is called pulpwood at ${tree.dbh}", below the ` +
          `${region.name} pulpwood minimum of ${region.pulpwoodMinDbh}".`,
      });
    }

    // --------------------------------------------------- borderline VRP trees
    // A tree near the limiting distance is the one an audit will re-measure.
    // We cannot know the actual distance unless it was recorded, so this is
    // purely informational guidance surfaced on the largest stems.
    if (plot?.method === 'variable_radius' && plot.baf && tree.dbh > 0) {
      const ld = limitingDistanceFt(tree.dbh, plot.baf);
      if (!Number.isFinite(ld) || ld <= 0) {
        add({
          code: 'TREE_LIMITING_DISTANCE_UNDEFINED',
          severity: 'warning',
          scope: 'tree',
          treeId: tree.id,
          plotId: tree.plotId,
          message: `Limiting distance could not be computed for the tree on ${where}.`,
        });
      }
    }
  }

  // ------------------------------------------------------------------- stands

  const treesByPlot = new Map<string, TreeRecord[]>();
  for (const tree of trees) {
    const list = treesByPlot.get(tree.plotId);
    if (list) list.push(tree);
    else treesByPlot.set(tree.plotId, [tree]);
  }

  for (const stand of stands) {
    const standPlots = plots.filter((p) => p.standId === stand.id);
    const active = standPlots.filter((p) => !p.isSkipped);

    if (stand.acres <= 0) {
      add({
        code: 'STAND_NO_ACRES',
        severity: 'error',
        scope: 'stand',
        standId: stand.id,
        value: stand.acres,
        message: `Stand "${stand.name}" has no acreage, so nothing can be scaled to a total.`,
      });
    }

    if (active.length === 0) {
      add({
        code: 'STAND_NO_PLOTS',
        severity: 'error',
        scope: 'stand',
        standId: stand.id,
        message: `Stand "${stand.name}" has no measured plots.`,
      });
      continue;
    }

    if (active.length === 1) {
      add({
        code: 'STAND_SINGLE_PLOT',
        severity: 'warning',
        scope: 'stand',
        standId: stand.id,
        message: `Stand "${stand.name}" has only one plot, so no sampling error can be reported.`,
        remedy:
          'A cruise without a reported sampling error is not a defensible work product. Install at least two plots.',
      });
    }

    // Mixed methods within one stand are not arithmetically wrong — each tree
    // expands by its own plot's rule — but they break the assumption of a
    // single sampling design, and most cruise contracts forbid it.
    const methods = new Set(active.map((p) => p.method));
    if (methods.size > 1) {
      add({
        code: 'STAND_MIXED_METHODS',
        severity: 'warning',
        scope: 'stand',
        standId: stand.id,
        message: `Stand "${stand.name}" mixes ${[...methods].join(' and ')} plots.`,
        remedy:
          'Expansion still works per plot, but the stand no longer has one sampling design. Split it into strata.',
      });
    }

    const bafs = new Set(
      active
        .filter((p) => p.method === 'variable_radius')
        .map((p) => p.baf)
        .filter((b): b is number => b !== undefined)
    );
    if (bafs.size > 1) {
      add({
        code: 'STAND_MIXED_BAF',
        severity: 'warning',
        scope: 'stand',
        standId: stand.id,
        value: [...bafs].join(', '),
        message: `Stand "${stand.name}" uses more than one BAF (${[...bafs].join(', ')}).`,
        remedy:
          'Changing prisms mid-stand changes the sampling probability. Confirm this was intentional.',
      });
    }

    // Missing heights, at the stand level, become an error rather than noise.
    const standTrees = active.flatMap((p) => treesByPlot.get(p.id) ?? []);
    const noHeight = standTrees.filter(
      (tr) => tr.merchHeight === undefined || tr.merchHeight <= 0
    );
    if (standTrees.length > 0) {
      const frac = noHeight.length / standTrees.length;
      if (frac > t.maxMissingHeightFraction) {
        add({
          code: 'STAND_HEIGHTS_MOSTLY_MISSING',
          severity: 'error',
          scope: 'stand',
          standId: stand.id,
          value: Number((frac * 100).toFixed(0)),
          message:
            `${noHeight.length} of ${standTrees.length} trees in "${stand.name}" ` +
            `(${(frac * 100).toFixed(0)}%) have no merchantable height.`,
          remedy:
            'Volume for this stand is understated by construction. Impute heights from a measured subsample before reporting.',
        });
      }
    }

    // Basal area sanity, only where it can be computed without the compiler.
    const vrpPlots = active.filter((p) => p.method === 'variable_radius' && p.baf);
    for (const plot of vrpPlots) {
      const pt = treesByPlot.get(plot.id) ?? [];
      const baPerAcre = pt.reduce((s, tr) => s + (plot.baf ?? 0) * (tr.count ?? 1), 0);
      if (baPerAcre > 400) {
        add({
          code: 'PLOT_IMPLAUSIBLE_BASAL_AREA',
          severity: 'warning',
          scope: 'plot',
          plotId: plot.id,
          standId: stand.id,
          value: baPerAcre,
          message: `Plot ${plot.number} expands to ${baPerAcre} sq ft/ac of basal area.`,
          remedy:
            'Even a fully stocked stand rarely exceeds 200 sq ft/ac. Check the BAF and the tally.',
        });
      }
    }

    // ------------------------------------------------- plot-level divergence
    if (input.plotVolumes) {
      const vals = active
        .map((p) => input.plotVolumes?.[p.id])
        .filter((v): v is number => typeof v === 'number');
      if (vals.length >= 4) {
        const med = median(vals);
        const mad = median(vals.map((v) => Math.abs(v - med)));
        for (const plot of active) {
          const v = input.plotVolumes[plot.id];
          if (typeof v !== 'number') continue;

          // MAD of zero means more than half the plots share one value. Any
          // departure from it is then categorically unusual, so fall back to a
          // simple inequality rather than dividing by zero.
          const z =
            mad > 0
              ? Math.abs((0.6745 * (v - med)) / mad)
              : v === med
                ? 0
                : Infinity;

          if (z > t.plotOutlierModifiedZ) {
            add({
              code: 'PLOT_VOLUME_OUTLIER',
              severity: 'info',
              scope: 'plot',
              plotId: plot.id,
              standId: stand.id,
              value: Number(v.toFixed(0)),
              message:
                `Plot ${plot.number} diverges sharply from the rest of the stand ` +
                `(${v.toFixed(0)} bf/ac against a median of ${med.toFixed(0)}).`,
              remedy:
                'Often legitimate — timber is patchy. Worth confirming the tally before it drives the estimate.',
            });
          }
        }
      }
    }
  }

  // Cruise-level: plots that exist with no stand at all.
  const standlessPlots = plots.filter((p) => !standById.has(p.standId));
  if (standlessPlots.length > 0) {
    add({
      code: 'CRUISE_ORPHANED_PLOTS',
      severity: 'error',
      scope: 'cruise',
      value: standlessPlots.length,
      message: `${standlessPlots.length} plot(s) belong to no stand and will not appear in any total.`,
    });
  }

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  const infoCount = findings.filter((f) => f.severity === 'info').length;

  return {
    findings,
    errorCount,
    warningCount,
    infoCount,
    passesForRelease: errorCount === 0,
  };
}

/**
 * A single tree's checks, for live validation as the cruiser types. Same rules,
 * no cross-record context — so it is cheap enough to run on every keystroke.
 */
export function qaTree(
  tree: TreeRecord,
  plot: PlotRecord,
  region: RegionProfile,
  thresholds?: Partial<QaThresholds>
): QaFinding[] {
  return runQa({
    stands: [{ id: plot.standId, name: 'stand', acres: 1 }],
    plots: [plot],
    trees: [tree],
    region,
    thresholds,
  }).findings.filter((f) => f.scope === 'tree');
}

/** Median of a numeric array. Returns 0 for an empty array. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/** Group findings by severity for display. */
export function groupBySeverity(
  findings: QaFinding[]
): Record<QaSeverity, QaFinding[]> {
  return {
    error: findings.filter((f) => f.severity === 'error'),
    warning: findings.filter((f) => f.severity === 'warning'),
    info: findings.filter((f) => f.severity === 'info'),
  };
}
