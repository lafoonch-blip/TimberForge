/**
 * Field QA.
 *
 * Two properties matter more than any individual rule:
 *
 *   1. QA NEVER MUTATES. Clean data in must produce clean data out, untouched.
 *   2. SEVERITY MEANS CONSEQUENCE. Only `error` blocks release, so anything
 *      promoted to `error` must genuinely make the output wrong or missing.
 */

import { describe, expect, it } from 'vitest';
import {
  getRegion,
  groupBySeverity,
  qaTree,
  runQa,
  type PlotRecord,
  type StandRecord,
  type TreeRecord,
} from '@timberforge/forestry-core';

const region = getRegion('us_south');
const stands: StandRecord[] = [{ id: 's1', name: 'Stand 1', acres: 40 }];

const goodPlot: PlotRecord = {
  id: 'p1',
  standId: 's1',
  number: 1,
  method: 'variable_radius',
  baf: 10,
  latitude: 33.5,
  longitude: -84.4,
};

const goodTree = (over: Partial<TreeRecord> = {}): TreeRecord => ({
  id: 't1',
  plotId: 'p1',
  species: 'LP',
  dbh: 14,
  merchHeight: 2,
  merchHeightUnit: 'logs',
  product: 'sawtimber',
  defectPct: 5,
  ...over,
});

const codes = (r: { findings: { code: string }[] }) => r.findings.map((f) => f.code);

describe('a clean cruise', () => {
  it('produces no errors and passes for release', () => {
    const r = runQa({
      stands,
      plots: [goodPlot, { ...goodPlot, id: 'p2', number: 2 }],
      trees: [goodTree(), goodTree({ id: 't2', plotId: 'p2', dbh: 12 })],
      region,
    });
    expect(r.errorCount).toBe(0);
    expect(r.passesForRelease).toBe(true);
  });

  it('does not mutate the records it inspects', () => {
    const tree = goodTree();
    const plot = { ...goodPlot };
    const snapshotTree = JSON.stringify(tree);
    const snapshotPlot = JSON.stringify(plot);

    runQa({ stands, plots: [plot], trees: [tree], region });

    expect(JSON.stringify(tree)).toBe(snapshotTree);
    expect(JSON.stringify(plot)).toBe(snapshotPlot);
  });
});

describe('method integrity', () => {
  it('errors when a variable-radius point has no BAF', () => {
    const r = runQa({
      stands,
      plots: [{ id: 'p1', standId: 's1', number: 1, method: 'variable_radius' }],
      trees: [goodTree()],
      region,
    });
    expect(codes(r)).toContain('PLOT_MISSING_BAF');
    expect(r.passesForRelease).toBe(false);
  });

  it('errors when a fixed-area plot has no plot size', () => {
    const r = runQa({
      stands,
      plots: [{ id: 'p1', standId: 's1', number: 1, method: 'fixed_area' }],
      trees: [goodTree()],
      region,
    });
    expect(codes(r)).toContain('PLOT_MISSING_AREA');
  });

  it('flags mixed methods within one stand as a warning, not an error', () => {
    // Expansion still works per plot, so the numbers are right — but the stand
    // no longer has a single sampling design.
    const r = runQa({
      stands,
      plots: [
        goodPlot,
        { id: 'p2', standId: 's1', number: 2, method: 'fixed_area', plotAcres: 0.1 },
      ],
      trees: [goodTree(), goodTree({ id: 't2', plotId: 'p2' })],
      region,
    });
    const finding = r.findings.find((f) => f.code === 'STAND_MIXED_METHODS');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('warning');
  });

  it('flags more than one BAF in a stand', () => {
    const r = runQa({
      stands,
      plots: [goodPlot, { ...goodPlot, id: 'p2', number: 2, baf: 20 }],
      trees: [goodTree(), goodTree({ id: 't2', plotId: 'p2' })],
      region,
    });
    expect(codes(r)).toContain('STAND_MIXED_BAF');
  });
});

describe('empty vs skipped', () => {
  it('errors when a plot is marked both empty and skipped', () => {
    const r = runQa({
      stands,
      plots: [{ ...goodPlot, isEmpty: true, isSkipped: true }],
      trees: [],
      region,
    });
    expect(codes(r)).toContain('PLOT_EMPTY_AND_SKIPPED');
  });

  it('errors when an empty plot has trees on it', () => {
    const r = runQa({
      stands,
      plots: [{ ...goodPlot, isEmpty: true }],
      trees: [goodTree()],
      region,
    });
    expect(codes(r)).toContain('PLOT_EMPTY_WITH_TREES');
  });

  it('warns when a plot has no trees and was not marked empty', () => {
    // An unmarked zero is indistinguishable from a plot somebody forgot.
    const r = runQa({
      stands,
      plots: [goodPlot, { ...goodPlot, id: 'p2', number: 2 }],
      trees: [goodTree()],
      region,
    });
    expect(codes(r)).toContain('PLOT_NO_TREES_NOT_MARKED_EMPTY');
  });

  it('accepts a properly marked empty plot without complaint', () => {
    const r = runQa({
      stands,
      plots: [goodPlot, { ...goodPlot, id: 'p2', number: 2, isEmpty: true }],
      trees: [goodTree()],
      region,
    });
    expect(codes(r)).not.toContain('PLOT_NO_TREES_NOT_MARKED_EMPTY');
    expect(r.errorCount).toBe(0);
  });
});

describe('measurement plausibility', () => {
  it('errors on a non-positive DBH', () => {
    const r = runQa({ stands, plots: [goodPlot], trees: [goodTree({ dbh: 0 })], region });
    expect(codes(r)).toContain('TREE_INVALID_DBH');
  });

  it('warns on an unusually large DBH without rejecting it', () => {
    // A 52" legacy yard tree is real. Flag it; never delete it.
    const r = runQa({ stands, plots: [goodPlot], trees: [goodTree({ dbh: 52 })], region });
    const f = r.findings.find((x) => x.code === 'TREE_DBH_ABOVE_RANGE');
    expect(f?.severity).toBe('warning');
    expect(r.passesForRelease).toBe(true);
  });

  /**
   * The single most valuable rule in the module. A height entered in feet where
   * 16-ft logs were expected is a 16x error that looks entirely ordinary in a
   * table — 40 becomes 40 logs, or 640 feet, on a 14" stem.
   */
  it('catches a height entered in the wrong unit via the taper check', () => {
    const r = runQa({
      stands,
      plots: [goodPlot],
      trees: [goodTree({ dbh: 14, merchHeight: 40, merchHeightUnit: 'logs' })],
      region,
    });
    expect(codes(r)).toContain('TREE_IMPLAUSIBLE_TAPER');
  });

  it('errors when a merchantable height carries no unit at all', () => {
    const r = runQa({
      stands,
      plots: [goodPlot],
      trees: [{ id: 't1', plotId: 'p1', species: 'LP', dbh: 14, merchHeight: 3 }],
      region,
    });
    expect(codes(r)).toContain('TREE_HEIGHT_UNIT_MISSING');
    expect(r.passesForRelease).toBe(false);
  });

  it('errors when merchantable height exceeds total height', () => {
    const r = runQa({
      stands,
      plots: [goodPlot],
      trees: [goodTree({ totalHeightFt: 60, merchHeight: 5, merchHeightUnit: 'logs' })],
      region,
    });
    expect(codes(r)).toContain('TREE_MERCH_EXCEEDS_TOTAL');
  });

  it('errors on a defect percentage outside 0-100', () => {
    const r = runQa({ stands, plots: [goodPlot], trees: [goodTree({ defectPct: 140 })], region });
    expect(codes(r)).toContain('TREE_DEFECT_OUT_OF_RANGE');
  });

  it('errors on a fractional or zero tally count', () => {
    const r = runQa({ stands, plots: [goodPlot], trees: [goodTree({ count: 2.5 })], region });
    expect(codes(r)).toContain('TREE_INVALID_COUNT');
  });

  it('errors on an unknown species code', () => {
    // Unknown species contribute zero volume, so this genuinely breaks output.
    const r = runQa({ stands, plots: [goodPlot], trees: [goodTree({ species: 'ZZZ' })], region });
    expect(codes(r)).toContain('TREE_UNKNOWN_SPECIES');
    expect(r.passesForRelease).toBe(false);
  });

  it('warns when a product conflicts with the region size minimums', () => {
    const r = runQa({
      stands,
      plots: [goodPlot],
      trees: [goodTree({ dbh: 7, product: 'sawtimber' })],
      region,
    });
    expect(codes(r)).toContain('TREE_PRODUCT_SIZE_CONFLICT');
  });
});

describe('structural integrity', () => {
  it('errors on duplicate tree ids', () => {
    const r = runQa({
      stands,
      plots: [goodPlot],
      trees: [goodTree(), goodTree()],
      region,
    });
    expect(codes(r)).toContain('TREE_DUPLICATE_ID');
  });

  it('errors on a tree pointing at a plot that does not exist', () => {
    const r = runQa({
      stands,
      plots: [goodPlot],
      trees: [goodTree({ id: 't9', plotId: 'nope' })],
      region,
    });
    expect(codes(r)).toContain('TREE_ORPHANED');
  });

  it('errors on plots belonging to no stand', () => {
    const r = runQa({
      stands,
      plots: [{ ...goodPlot, id: 'px', standId: 'ghost' }],
      trees: [],
      region,
    });
    expect(codes(r)).toContain('PLOT_ORPHANED');
    expect(codes(r)).toContain('CRUISE_ORPHANED_PLOTS');
  });

  it('warns on duplicate plot numbers within a stand', () => {
    const r = runQa({
      stands,
      plots: [goodPlot, { ...goodPlot, id: 'p2' }],
      trees: [goodTree(), goodTree({ id: 't2', plotId: 'p2' })],
      region,
    });
    expect(codes(r)).toContain('PLOT_DUPLICATE_NUMBER');
  });
});

describe('stand-level rules', () => {
  it('errors when a stand has no acreage', () => {
    const r = runQa({
      stands: [{ id: 's1', name: 'Stand 1', acres: 0 }],
      plots: [goodPlot],
      trees: [goodTree()],
      region,
    });
    expect(codes(r)).toContain('STAND_NO_ACRES');
  });

  it('warns when a stand has only one plot', () => {
    const r = runQa({ stands, plots: [goodPlot], trees: [goodTree()], region });
    expect(codes(r)).toContain('STAND_SINGLE_PLOT');
  });

  it('escalates mostly-missing heights to an error at the stand level', () => {
    // One missing height is a warning. A stand that is mostly missing heights
    // has understated volume by construction, which is a wrong number.
    const r = runQa({
      stands,
      plots: [goodPlot, { ...goodPlot, id: 'p2', number: 2 }],
      trees: [
        { id: 'a', plotId: 'p1', species: 'LP', dbh: 12 },
        { id: 'b', plotId: 'p1', species: 'LP', dbh: 14 },
        { id: 'c', plotId: 'p2', species: 'LP', dbh: 16 },
        goodTree({ id: 'd', plotId: 'p2' }),
      ],
      region,
    });
    const f = r.findings.find((x) => x.code === 'STAND_HEIGHTS_MOSTLY_MISSING');
    expect(f?.severity).toBe('error');
  });

  it('errors when a stand has no measured plots at all', () => {
    const r = runQa({ stands, plots: [], trees: [], region });
    expect(codes(r)).toContain('STAND_NO_PLOTS');
  });
});

describe('plot volume outliers', () => {
  /**
   * REGRESSION GUARD.
   *
   * This originally used a mean/SD z-score with a 3-sigma threshold, and it
   * never fired. The ceiling on a z-score for a sample of size n is
   * (n-1)/sqrt(n) — only 1.79 at n=5 — so the outlier inflated the standard
   * deviation enough to mask itself, and the rule was inert for every cruise
   * smaller than about eleven plots.
   *
   * The five-plot case below is exactly the one that used to slip through.
   */
  it('flags a divergent plot in a small cruise, where a 3-sigma rule cannot', () => {
    const plots: PlotRecord[] = [1, 2, 3, 4, 5].map((n) => ({
      ...goodPlot,
      id: `p${n}`,
      number: n,
    }));
    const r = runQa({
      stands,
      plots,
      trees: plots.map((p, i) => goodTree({ id: `t${i}`, plotId: p.id })),
      region,
      plotVolumes: { p1: 1000, p2: 1010, p3: 990, p4: 1005, p5: 9000 },
    });
    const f = r.findings.find((x) => x.code === 'PLOT_VOLUME_OUTLIER');
    expect(f).toBeDefined();
    expect(f!.plotId).toBe('p5');
    // Timber is genuinely patchy, so a high plot is usually real. This must
    // never block a report.
    expect(f!.severity).toBe('info');
    expect(r.passesForRelease).toBe(true);

    // Confirm the masking effect that motivated the change: a classic z-score
    // on this data cannot reach 3, so the old rule was structurally incapable
    // of firing here.
    const vals = [1000, 1010, 990, 1005, 9000];
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(
      vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (vals.length - 1)
    );
    expect(Math.abs(9000 - mean) / sd).toBeLessThan(3);
  });

  it('does not flag a merely patchy stand', () => {
    // Real timber varies two-to-one plot to plot without anything being wrong.
    const plots: PlotRecord[] = [1, 2, 3, 4, 5, 6].map((n) => ({
      ...goodPlot,
      id: `p${n}`,
      number: n,
    }));
    const r = runQa({
      stands,
      plots,
      trees: plots.map((p, i) => goodTree({ id: `t${i}`, plotId: p.id })),
      region,
      plotVolumes: { p1: 800, p2: 1200, p3: 950, p4: 1400, p5: 700, p6: 1100 },
    });
    expect(codes(r)).not.toContain('PLOT_VOLUME_OUTLIER');
  });

  it('does not attempt outlier detection with too few plots', () => {
    const r = runQa({
      stands,
      plots: [goodPlot, { ...goodPlot, id: 'p2', number: 2 }],
      trees: [goodTree(), goodTree({ id: 't2', plotId: 'p2' })],
      region,
      plotVolumes: { p1: 100, p2: 100000 },
    });
    expect(codes(r)).not.toContain('PLOT_VOLUME_OUTLIER');
  });
});

describe('helpers', () => {
  it('qaTree returns only tree-scoped findings for live validation', () => {
    const findings = qaTree(goodTree({ dbh: 60 }), goodPlot, region);
    expect(findings.every((f) => f.scope === 'tree')).toBe(true);
    expect(findings.map((f) => f.code)).toContain('TREE_DBH_ABOVE_RANGE');
  });

  it('groupBySeverity partitions findings without loss', () => {
    const r = runQa({
      stands,
      plots: [{ id: 'p1', standId: 's1', number: 1, method: 'variable_radius' }],
      trees: [goodTree({ dbh: 60 })],
      region,
    });
    const g = groupBySeverity(r.findings);
    expect(g.error.length + g.warning.length + g.info.length).toBe(
      r.findings.length
    );
    expect(g.error.length).toBe(r.errorCount);
  });

  it('honours threshold overrides', () => {
    const strict = runQa({
      stands,
      plots: [goodPlot],
      trees: [goodTree({ dbh: 20 })],
      region,
      thresholds: { maxPlausibleDbh: 16 },
    });
    expect(codes(strict)).toContain('TREE_DBH_ABOVE_RANGE');
  });
});
