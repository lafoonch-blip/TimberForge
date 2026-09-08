/**
 * Cruise compilation.
 *
 * These are the tests that protect the orchestration order, which is where
 * homegrown cruise spreadsheets go wrong:
 *
 *   - statistics computed across PLOTS, never across TREES
 *   - empty plots retained as real zeros, skipped plots excluded
 *   - the tally-count double-count guard in the volume expansion
 *   - QMD derived from BA and TPA, not averaged from diameters
 */

import { describe, expect, it } from 'vitest';
import {
  compileCruise,
  diameterClass,
  FOREST_CONSTANT,
  getRegion,
  type PlotRecord,
  type StandRecord,
  type TreeRecord,
} from '@timberforge/forestry-core';

const region = getRegion('us_south');

const stand = (acres = 40): StandRecord => ({
  id: 's1',
  name: 'Stand 1',
  acres,
});

const point = (n: number, extra: Partial<PlotRecord> = {}): PlotRecord => ({
  id: `p${n}`,
  standId: 's1',
  number: n,
  method: 'variable_radius',
  baf: 10,
  ...extra,
});

let treeSeq = 0;
const lp = (
  plotId: string,
  dbh: number,
  logs = 2,
  extra: Partial<TreeRecord> = {}
): TreeRecord => ({
  id: `t${++treeSeq}`,
  plotId,
  species: 'LP',
  dbh,
  merchHeight: logs,
  merchHeightUnit: 'logs',
  product: 'sawtimber',
  ...extra,
});

describe('diameterClass', () => {
  it('assigns 2-inch classes by midpoint', () => {
    expect(diameterClass(11.0)).toBe(12);
    expect(diameterClass(12.9)).toBe(12);
    expect(diameterClass(13.0)).toBe(14);
    expect(diameterClass(9.5)).toBe(10);
  });

  it('never returns a class below 2', () => {
    expect(diameterClass(0.4)).toBe(2);
    expect(diameterClass(0)).toBe(2);
  });
});

describe('basic compilation', () => {
  it('produces per-acre values as the mean across plots', () => {
    const plots = [point(1), point(2)];
    // Plot 1: one 12" tree. Plot 2: one 12" tree. Both at BAF 10.
    const trees = [lp('p1', 12), lp('p2', 12)];
    const r = compileCruise({ stands: [stand()], plots, trees, region });
    const s = r.stands[0]!;

    // Every VRP tree contributes exactly BAF of basal area per acre, so the
    // stand mean must be exactly 10.
    expect(s.basalAreaPerAcre).toBeCloseTo(10, 10);
    expect(s.plotCount).toBe(2);
    expect(s.treeCount).toBe(2);
  });

  it('scales stand totals by acreage only at the very end', () => {
    const r = compileCruise({
      stands: [stand(100)],
      plots: [point(1), point(2)],
      trees: [lp('p1', 14), lp('p2', 14)],
      region,
    });
    const s = r.stands[0]!;
    expect(s.totalNetBoardFeet).toBeCloseTo(s.netBoardFeetPerAcre * 100, 6);
    expect(s.totalNetMbf).toBeCloseTo(s.totalNetBoardFeet / 1000, 6);
  });

  /**
   * QMD is the diameter of the tree of MEAN BASAL AREA in the expanded stand.
   * On a fixed-area plot every tree carries equal weight, so this is the
   * textbook case where QMD must exceed the arithmetic mean diameter.
   */
  it('exceeds the arithmetic mean diameter on an equally-weighted plot', () => {
    const fixedPlot: PlotRecord = {
      id: 'f1',
      standId: 's1',
      number: 1,
      method: 'fixed_area',
      plotAcres: 0.1,
    };
    const s = compileCruise({
      stands: [stand()],
      plots: [fixedPlot],
      trees: [lp('f1', 6), lp('f1', 24)],
      region,
    }).stands[0]!;

    // Arithmetic mean is 15; QMD is pulled up by the big tree's basal area.
    expect(s.qmd).toBeGreaterThan(15);
    expect(s.qmd).toBeCloseTo(Math.sqrt((36 + 576) / 2), 6);
  });

  /**
   * On a VARIABLE-RADIUS point the same two trees give a much smaller QMD,
   * and that is correct rather than a bug: the 6" tree expands to ~51 trees
   * per acre while the 24" expands to only ~3.2, so the expanded stand really
   * is dominated by small stems. Pinning this protects against someone
   * "fixing" QMD to match tree-list intuition.
   */
  it('reflects expansion weighting on a variable-radius point', () => {
    const s = compileCruise({
      stands: [stand()],
      plots: [point(1)],
      trees: [lp('p1', 6), lp('p1', 24)],
      region,
    }).stands[0]!;

    const tpaSmall = 10 / (FOREST_CONSTANT * 36);
    const tpaBig = 10 / (FOREST_CONSTANT * 576);
    expect(s.treesPerAcre).toBeCloseTo(tpaSmall + tpaBig, 6);
    expect(s.qmd).toBeLessThan(15);

    // The TPA-weighted arithmetic mean diameter is the correct comparison, and
    // QMD must still exceed it.
    const weightedMeanD =
      (tpaSmall * 6 + tpaBig * 24) / (tpaSmall + tpaBig);
    expect(s.qmd).toBeGreaterThan(weightedMeanD);
  });

  it('satisfies the identity BA = 0.005454 * QMD^2 * TPA', () => {
    for (const trees of [
      [lp('p1', 6), lp('p1', 24)],
      [lp('p1', 10), lp('p1', 12), lp('p1', 18)],
      [lp('p1', 14)],
    ]) {
      const s = compileCruise({
        stands: [stand()],
        plots: [point(1)],
        trees,
        region,
      }).stands[0]!;
      expect(FOREST_CONSTANT * s.qmd * s.qmd * s.treesPerAcre).toBeCloseTo(
        s.basalAreaPerAcre,
        8
      );
    }
  });
});

describe('empty and skipped plots', () => {
  /**
   * An empty plot is a measured zero and MUST pull the mean down. A skipped
   * plot was never visited and must not exist in the arithmetic at all.
   * Conflating the two is the difference between an honest cruise and an
   * inflated one.
   */
  it('counts an empty plot as a zero that lowers the stand mean', () => {
    const withEmpty = compileCruise({
      stands: [stand()],
      plots: [point(1), point(2, { isEmpty: true })],
      trees: [lp('p1', 12)],
      region,
    }).stands[0]!;

    const withoutEmpty = compileCruise({
      stands: [stand()],
      plots: [point(1)],
      trees: [lp('p1', 12)],
      region,
    }).stands[0]!;

    expect(withEmpty.basalAreaPerAcre).toBeCloseTo(5, 10); // (10 + 0) / 2
    expect(withoutEmpty.basalAreaPerAcre).toBeCloseTo(10, 10);
    expect(withEmpty.emptyPlotCount).toBe(1);
  });

  it('excludes a skipped plot from the denominator entirely', () => {
    const r = compileCruise({
      stands: [stand()],
      plots: [point(1), point(2, { isSkipped: true })],
      trees: [lp('p1', 12)],
      region,
    }).stands[0]!;

    expect(r.plotCount).toBe(1);
    expect(r.skippedPlotCount).toBe(1);
    // Not diluted by the skipped plot.
    expect(r.basalAreaPerAcre).toBeCloseTo(10, 10);
  });

  it('reports a warning and no statistics when a stand has no plots', () => {
    const r = compileCruise({
      stands: [stand()],
      plots: [],
      trees: [],
      region,
    }).stands[0]!;
    expect(r.plotCount).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/no plots/i);
  });
});

describe('statistics are computed across plots, not trees', () => {
  /**
   * THE CENTRAL STATISTICAL TEST.
   *
   * Two plots, each with three identical trees. Every plot total is identical,
   * so the variance ACROSS PLOTS is exactly zero and the sampling error is 0%.
   *
   * If variance were computed across trees, or if plots were flattened, the
   * degrees of freedom would be wrong (5 instead of 1) even in this degenerate
   * case. Checking df is what actually pins the unit of observation.
   */
  it('uses the plot as the unit of observation', () => {
    const plots = [point(1), point(2)];
    const trees = [
      lp('p1', 12), lp('p1', 12), lp('p1', 12),
      lp('p2', 12), lp('p2', 12), lp('p2', 12),
    ];
    const r = compileCruise({ stands: [stand()], plots, trees, region }).stands[0]!;

    expect(r.treeCount).toBe(6);
    expect(r.statistics.netBoardFeetPerAcre.n).toBe(2);
    expect(r.statistics.netBoardFeetPerAcre.degreesOfFreedom).toBe(1);
    expect(r.statistics.netBoardFeetPerAcre.samplingErrorPct).toBeCloseTo(0, 8);
  });

  it('reports a real sampling error when plots differ', () => {
    const plots = [point(1), point(2), point(3), point(4)];
    const trees = [
      lp('p1', 10),
      lp('p2', 14), lp('p2', 16),
      lp('p3', 12),
      // p4 is empty
    ];
    const r = compileCruise({
      stands: [stand()],
      plots: [...plots.slice(0, 3), point(4, { isEmpty: true })],
      trees,
      region,
    }).stands[0]!;

    expect(r.statistics.netBoardFeetPerAcre.n).toBe(4);
    expect(r.statistics.netBoardFeetPerAcre.samplingErrorPct).toBeGreaterThan(0);
    expect(r.plotValues).toHaveLength(4);
    expect(r.plotValues[3]!.netBoardFeetPerAcre).toBe(0);
  });

  it('answers the plots-needed question when a target is supplied', () => {
    const r = compileCruise({
      stands: [stand()],
      plots: [point(1), point(2), point(3)],
      trees: [lp('p1', 10), lp('p2', 20), lp('p3', 12)],
      region,
      targetSamplingErrorPct: 10,
    }).stands[0]!;

    expect(r.plotsNeeded).not.toBeNull();
    expect(r.plotsNeeded!.targetErrorPct).toBe(10);
  });

  it('returns null for plots-needed when no target was asked for', () => {
    const r = compileCruise({
      stands: [stand()],
      plots: [point(1), point(2)],
      trees: [lp('p1', 12), lp('p2', 12)],
      region,
    }).stands[0]!;
    expect(r.plotsNeeded).toBeNull();
  });
});

describe('tally count double-count guard', () => {
  /**
   * `treeVolume` already multiplies by the tally count internally. The
   * expansion factor also carries count. Applying both would square the count,
   * so a "3 in" tally would report nine trees' worth of volume.
   *
   * This test proves one record of count 3 equals three records of count 1.
   */
  it('makes a tally of 3 identical to three separate trees', () => {
    const tallied = compileCruise({
      stands: [stand()],
      plots: [point(1)],
      trees: [lp('p1', 14, 2, { count: 3 })],
      region,
    }).stands[0]!;

    const separate = compileCruise({
      stands: [stand()],
      plots: [point(1)],
      trees: [lp('p1', 14), lp('p1', 14), lp('p1', 14)],
      region,
    }).stands[0]!;

    expect(tallied.netBoardFeetPerAcre).toBeCloseTo(
      separate.netBoardFeetPerAcre,
      6
    );
    expect(tallied.basalAreaPerAcre).toBeCloseTo(separate.basalAreaPerAcre, 10);
    expect(tallied.treesPerAcre).toBeCloseTo(separate.treesPerAcre, 8);
    expect(tallied.treeCount).toBe(3);
  });
});

describe('defect', () => {
  it('reduces net volume but leaves gross untouched', () => {
    const r = compileCruise({
      stands: [stand()],
      plots: [point(1)],
      trees: [lp('p1', 16, 2, { defectPct: 25 })],
      region,
    }).stands[0]!;

    expect(r.netBoardFeetPerAcre).toBeCloseTo(
      r.grossBoardFeetPerAcre * 0.75,
      6
    );
  });

  it('zeroes net volume at 100% defect', () => {
    const r = compileCruise({
      stands: [stand()],
      plots: [point(1)],
      trees: [lp('p1', 16, 2, { defectPct: 100 })],
      region,
    }).stands[0]!;
    expect(r.netBoardFeetPerAcre).toBeCloseTo(0, 10);
    expect(r.grossBoardFeetPerAcre).toBeGreaterThan(0);
  });
});

describe('missing measurements are never invented', () => {
  it('contributes zero volume and warns when merchantable height is absent', () => {
    const r = compileCruise({
      stands: [stand()],
      plots: [point(1)],
      trees: [
        { id: 'x1', plotId: 'p1', species: 'LP', dbh: 16 }, // no height
      ],
      region,
    }).stands[0]!;

    expect(r.netBoardFeetPerAcre).toBe(0);
    // Basal area does NOT need height, so it is still counted. Reporting BA
    // while reporting zero volume is the honest outcome.
    expect(r.basalAreaPerAcre).toBeCloseTo(10, 10);
    expect(r.warnings.join(' ')).toMatch(/merchantable height/i);
  });

  it('warns and skips a tree whose species is not in the region profile', () => {
    const r = compileCruise({
      stands: [stand()],
      plots: [point(1)],
      trees: [
        { id: 'x1', plotId: 'p1', species: 'ZZZ', dbh: 16, merchHeight: 2, merchHeightUnit: 'logs' },
      ],
      region,
    }).stands[0]!;
    expect(r.warnings.join(' ')).toMatch(/ZZZ/);
    expect(r.netBoardFeetPerAcre).toBe(0);
  });
});

describe('composition tables', () => {
  it('reports species composition on a basal area basis summing to 100%', () => {
    const r = compileCruise({
      stands: [stand()],
      plots: [point(1)],
      trees: [
        lp('p1', 14),
        { ...lp('p1', 12), species: 'WO' },
        { ...lp('p1', 10), species: 'YP' },
      ],
      region,
    }).stands[0]!;

    expect(r.speciesComposition).toHaveLength(3);
    const total = r.speciesComposition.reduce((s, c) => s + c.basalAreaPct, 0);
    expect(total).toBeCloseTo(100, 6);
    // Sorted descending by share; at equal BAF contribution all are equal, so
    // just assert the ordering invariant holds.
    for (let i = 1; i < r.speciesComposition.length; i++) {
      expect(r.speciesComposition[i - 1]!.basalAreaPct).toBeGreaterThanOrEqual(
        r.speciesComposition[i]!.basalAreaPct - 1e-9
      );
    }
  });

  it('buckets the diameter distribution into ascending 2-inch classes', () => {
    const r = compileCruise({
      stands: [stand()],
      plots: [point(1)],
      trees: [lp('p1', 8), lp('p1', 12), lp('p1', 12.5), lp('p1', 20)],
      region,
    }).stands[0]!;

    const classes = r.diameterDistribution.map((d) => d.dbhClass);
    expect(classes).toEqual([...classes].sort((a, b) => a - b));
    expect(classes).toContain(12);
    expect(classes).toContain(20);
  });

  it('separates product classes and flags unassigned volume', () => {
    const r = compileCruise({
      stands: [stand()],
      plots: [point(1)],
      trees: [
        lp('p1', 16, 2, { product: 'sawtimber' }),
        lp('p1', 7, 1, { product: 'pulpwood' }),
        lp('p1', 10, 2, { product: undefined }),
      ],
      region,
    }).stands[0]!;

    const products = r.productMix.map((p) => p.product);
    expect(products).toContain('sawtimber');
    expect(products).toContain('unassigned');
  });
});

describe('fixed-area plots', () => {
  it('compiles fixed-area plots to the same per-acre shape', () => {
    const fixedPlot: PlotRecord = {
      id: 'f1',
      standId: 's1',
      number: 1,
      method: 'fixed_area',
      plotAcres: 0.1,
    };
    const r = compileCruise({
      stands: [stand()],
      plots: [fixedPlot],
      trees: [lp('f1', 12), lp('f1', 12)],
      region,
    }).stands[0]!;

    // Two trees on a 1/10-acre plot = 20 trees per acre.
    expect(r.treesPerAcre).toBeCloseTo(20, 8);
    expect(r.basalAreaPerAcre).toBeCloseTo(
      FOREST_CONSTANT * 144 * 20,
      8
    );
  });
});

describe('cruise totals and stamp', () => {
  it('acre-weights across stands', () => {
    const r = compileCruise({
      stands: [
        { id: 's1', name: 'A', acres: 100 },
        { id: 's2', name: 'B', acres: 300 },
      ],
      plots: [
        point(1),
        { id: 'p2', standId: 's2', number: 1, method: 'variable_radius', baf: 20 },
      ],
      trees: [lp('p1', 12), lp('p2', 12)],
      region,
    });

    expect(r.totals.acres).toBe(400);
    // BA per acre: stand A is 10, stand B is 20, weighted (100*10 + 300*20)/400.
    expect(r.totals.weightedBasalAreaPerAcre).toBeCloseTo(17.5, 8);
    expect(r.totals.totalNetBoardFeet).toBeCloseTo(
      r.stands[0]!.totalNetBoardFeet + r.stands[1]!.totalNetBoardFeet,
      6
    );
  });

  it('stamps the engine version, log rule, region and volume method', () => {
    const r = compileCruise({
      stands: [stand()],
      plots: [point(1)],
      trees: [lp('p1', 14)],
      region,
    });
    expect(r.stamp.calcEngine).toMatch(/^tf-calc-/);
    expect(r.stamp.logRule).toBe('doyle');
    expect(r.stamp.regionProfile).toBe('us_south');
    expect(r.stamp.volumeMethod).toMatch(/form class/i);
    expect(() => new Date(r.stamp.computedAt).toISOString()).not.toThrow();
  });

  it('honours a log rule override against the region default', () => {
    const base = { stands: [stand()], plots: [point(1)], trees: [lp('p1', 16)], region };
    const doyleRun = compileCruise(base);
    const intlRun = compileCruise({ ...base, logRule: 'international_quarter' });

    expect(doyleRun.stamp.logRule).toBe('doyle');
    expect(intlRun.stamp.logRule).toBe('international_quarter');
    // International scales small-to-mid logs higher than Doyle.
    expect(intlRun.stands[0]!.netBoardFeetPerAcre).toBeGreaterThan(
      doyleRun.stands[0]!.netBoardFeetPerAcre
    );
  });
});
