/**
 * Expansion factors.
 *
 * These are testable to the digit because they follow from geometry and from
 * the definition of angle-gauge sampling, not from a table. If any of these
 * fail, every volume number in the product is wrong.
 */

import { describe, expect, it } from 'vitest';
import {
  basalArea,
  basalAreaPerAcreFactor,
  FOREST_CONSTANT,
  fixedPlotRadiusFt,
  limitingDistanceFt,
  treesPerAcreFactor,
  type PlotRecord,
  type TreeRecord,
} from '@timberforge/forestry-core';

const vrp = (baf: number): PlotRecord => ({
  id: 'p1',
  standId: 's1',
  number: 1,
  method: 'variable_radius',
  baf,
});

const fixed = (acres: number): PlotRecord => ({
  id: 'p2',
  standId: 's1',
  number: 2,
  method: 'fixed_area',
  plotAcres: acres,
});

const tree = (dbh: number, count?: number): TreeRecord => ({
  id: 't1',
  plotId: 'p1',
  species: 'LP',
  dbh,
  ...(count === undefined ? {} : { count }),
});

describe('basal area', () => {
  it('uses the foresters constant 0.005454154', () => {
    expect(FOREST_CONSTANT).toBeCloseTo(0.005454154, 9);
  });

  /**
   * The constant is pi/(4*144): the area of a circle in square FEET from a
   * diameter in INCHES. Deriving it here proves it is not a typo, which matters
   * because a transposed digit would be invisible in every downstream number.
   */
  it('equals pi / (4 * 144), the inches-to-square-feet conversion', () => {
    expect(FOREST_CONSTANT).toBeCloseTo(Math.PI / (4 * 144), 9);
  });

  it('gives the textbook basal area for common diameters', () => {
    // A 10-inch tree is very close to 0.5454 sq ft.
    expect(basalArea(10)).toBeCloseTo(0.5454154, 7);
    // A 20-inch tree has four times the basal area of a 10-inch tree.
    expect(basalArea(20)).toBeCloseTo(basalArea(10) * 4, 10);
    expect(basalArea(12)).toBeCloseTo(0.7854, 4);
  });

  it('returns zero for non-positive diameters', () => {
    expect(basalArea(0)).toBe(0);
    expect(basalArea(-4)).toBe(0);
  });
});

describe('variable-radius expansion', () => {
  /**
   * THE defining property of angle-gauge sampling: every tallied tree
   * contributes exactly BAF square feet of basal area per acre, regardless of
   * its diameter. If this ever stops being true, the method is broken.
   */
  it('contributes exactly BAF of basal area per acre for every tree size', () => {
    for (const dbh of [6, 10, 14, 20, 28, 36]) {
      expect(basalAreaPerAcreFactor(tree(dbh), vrp(10))).toBeCloseTo(10, 10);
      expect(basalAreaPerAcreFactor(tree(dbh), vrp(20))).toBeCloseTo(20, 10);
    }
  });

  it('computes TPA as BAF / basal area', () => {
    // 10 BAF, 10" tree: 10 / 0.5454154 = 18.335...
    expect(treesPerAcreFactor(tree(10), vrp(10))).toBeCloseTo(
      10 / (FOREST_CONSTANT * 100),
      8
    );
    expect(treesPerAcreFactor(tree(10), vrp(10))).toBeCloseTo(18.3346, 3);
  });

  /**
   * The inverse relationship is the whole reason point sampling works: big
   * trees are easy to hit and therefore represent few per acre.
   */
  it('makes a tree of twice the diameter represent a quarter the trees per acre', () => {
    const small = treesPerAcreFactor(tree(10), vrp(10));
    const big = treesPerAcreFactor(tree(20), vrp(10));
    expect(big).toBeCloseTo(small / 4, 8);
  });

  it('multiplies by the tally count', () => {
    expect(treesPerAcreFactor(tree(10, 3), vrp(10))).toBeCloseTo(
      treesPerAcreFactor(tree(10), vrp(10)) * 3,
      8
    );
    expect(basalAreaPerAcreFactor(tree(10, 3), vrp(10))).toBeCloseTo(30, 10);
  });

  it('throws rather than guessing when the BAF is missing', () => {
    const noBaf: PlotRecord = {
      id: 'p9',
      standId: 's1',
      number: 9,
      method: 'variable_radius',
    };
    expect(() => treesPerAcreFactor(tree(10), noBaf)).toThrow(/BAF/);
    expect(() => basalAreaPerAcreFactor(tree(10), noBaf)).toThrow(/BAF/);
  });
});

describe('fixed-area expansion', () => {
  it('expands every tree by 1 / plotAcres regardless of size', () => {
    // A 1/10-acre plot: each tree represents 10 trees per acre.
    expect(treesPerAcreFactor(tree(8), fixed(0.1))).toBeCloseTo(10, 10);
    expect(treesPerAcreFactor(tree(24), fixed(0.1))).toBeCloseTo(10, 10);
    // A 1/5-acre plot: each tree represents 5.
    expect(treesPerAcreFactor(tree(12), fixed(0.2))).toBeCloseTo(5, 10);
  });

  it('expands basal area by the tree BA times the plot factor', () => {
    expect(basalAreaPerAcreFactor(tree(10), fixed(0.1))).toBeCloseTo(
      basalArea(10) * 10,
      10
    );
  });

  it('throws rather than guessing when the plot size is missing', () => {
    const noArea: PlotRecord = {
      id: 'p9',
      standId: 's1',
      number: 9,
      method: 'fixed_area',
    };
    expect(() => treesPerAcreFactor(tree(10), noArea)).toThrow(/plotAcres/);
  });
});

describe('limiting distance', () => {
  /**
   * PRF = 8.696 / sqrt(BAF), feet of limiting distance per inch of DBH.
   * This is what a cruiser pulls a tape against when a tree is borderline, so
   * it has to be right to the tenth of a foot.
   */
  it('uses the standard plot radius factor', () => {
    // BAF 10: PRF = 8.696 / sqrt(10) = 2.7500...
    expect(limitingDistanceFt(1, 10)).toBeCloseTo(2.75, 2);
    // A 12-inch tree at BAF 10 is in out to 33.0 ft.
    expect(limitingDistanceFt(12, 10)).toBeCloseTo(33.0, 1);
    // BAF 20 halves the reach relative to BAF 5.
    expect(limitingDistanceFt(12, 20)).toBeCloseTo(
      limitingDistanceFt(12, 5) / 2,
      6
    );
  });

  it('scales linearly with DBH', () => {
    expect(limitingDistanceFt(20, 10)).toBeCloseTo(
      limitingDistanceFt(10, 10) * 2,
      8
    );
  });

  it('returns zero for a zero-diameter tree and throws on a bad BAF', () => {
    expect(limitingDistanceFt(0, 10)).toBe(0);
    expect(() => limitingDistanceFt(12, 0)).toThrow();
  });
});

describe('fixed plot radius', () => {
  it('gives the standard radii for common plot sizes', () => {
    // 1/10 acre = 37.2 ft radius; 1/5 acre = 52.7 ft; 1 acre = 117.75 ft.
    expect(fixedPlotRadiusFt(0.1)).toBeCloseTo(37.24, 2);
    expect(fixedPlotRadiusFt(0.2)).toBeCloseTo(52.66, 2);
    expect(fixedPlotRadiusFt(1)).toBeCloseTo(117.75, 2);
  });

  it('round-trips back to the plot area', () => {
    for (const acres of [0.05, 0.1, 0.25, 0.5, 1]) {
      const r = fixedPlotRadiusFt(acres);
      expect((Math.PI * r * r) / 43560).toBeCloseTo(acres, 10);
    }
  });

  it('throws on a non-positive area', () => {
    expect(() => fixedPlotRadiusFt(0)).toThrow();
  });
});
