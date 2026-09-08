/**
 * Log rules.
 *
 * A NOTE ON WHAT THESE TESTS DO AND DO NOT PROVE.
 *
 * The only meaningful definition of "correct" for a log rule is "agrees with
 * the table the mill scales from." That means the gold-standard test is a
 * comparison against printed published tables.
 *
 * We do not have those tables in this repository yet. So rather than assert
 * against half-remembered table values — which would manufacture false
 * authority and, worse, would let a wrong implementation pass because the
 * "expected" number was also wrong — these tests assert only what can be
 * derived from each rule's published DEFINITION, plus structural properties
 * that any board-foot rule must satisfy.
 *
 * The table cross-checks are written below as `it.todo`. They are the
 * acceptance gate for regional beta, and leaving them visibly unfinished is
 * deliberate: a missing test should look missing.
 */

import { describe, expect, it } from 'vitest';
import {
  doyle,
  getLogRule,
  internationalQuarter,
  makeTableRule,
  registerLogRule,
  scribner,
} from '@timberforge/forestry-core';

describe('Doyle log rule', () => {
  /**
   * Doyle is the one rule we can test to the digit without a table, because
   * Doyle was DEFINED as a formula rather than drawn as a diagram:
   *
   *   BF = ((D - 4) / 4)^2 * L
   *
   * Every published Doyle table is a rendering of that expression, so agreement
   * with the formula is agreement with the table.
   */
  it('matches its defining formula exactly', () => {
    expect(doyle(12, 16)).toBeCloseTo(64, 10); // ((12-4)/4)^2 * 16
    expect(doyle(16, 16)).toBeCloseTo(144, 10);
    expect(doyle(20, 16)).toBeCloseTo(256, 10);
    expect(doyle(8, 16)).toBeCloseTo(16, 10);
    expect(doyle(24, 16)).toBeCloseTo(400, 10);
  });

  it('reduces to (D-4)^2 for the standard 16-foot log', () => {
    for (const d of [6, 8, 10, 14, 18, 22, 30]) {
      expect(doyle(d, 16)).toBeCloseTo(Math.pow(d - 4, 2), 10);
    }
  });

  it('returns zero at and below the 4-inch pivot rather than going negative', () => {
    expect(doyle(4, 16)).toBe(0);
    expect(doyle(3, 16)).toBe(0);
    expect(doyle(0, 16)).toBe(0);
    expect(doyle(-5, 16)).toBe(0);
  });

  /**
   * Doyle's severe under-scaling of small logs is a property of the RULE, not a
   * bug in our implementation. This test exists to stop a well-meaning future
   * contributor from "correcting" it.
   */
  it('under-scales small logs relative to International, as Doyle is known to', () => {
    expect(doyle(10, 16)).toBeLessThan(internationalQuarter(10, 16) * 0.7);
    expect(doyle(8, 16)).toBeLessThan(internationalQuarter(8, 16) * 0.5);
  });

  it('scales linearly with length', () => {
    expect(doyle(16, 32)).toBeCloseTo(doyle(16, 16) * 2, 10);
    expect(doyle(16, 8)).toBeCloseTo(doyle(16, 16) / 2, 10);
  });
});

describe('International 1/4-inch log rule', () => {
  /**
   * International is constructive: the rule IS the segment procedure, so
   * reproducing the procedure is reproducing the rule. Its defining segment
   * expression, for a 4-foot segment of small-end diameter d:
   *
   *   segment BF = 0.22 d^2 - 0.71 d
   *
   * with a 1/2-inch taper allowance added per 4-foot segment moving buttward.
   */
  const segment = (d: number) => 0.22 * d * d - 0.71 * d;

  it('reproduces the defining segment expression for a single 4-ft segment', () => {
    expect(internationalQuarter(12, 4)).toBeCloseTo(segment(12), 10);
    expect(internationalQuarter(16, 4)).toBeCloseTo(segment(16), 10);
  });

  it('applies the 1/2-inch-per-4-foot taper allowance', () => {
    // A 16-ft log is four segments at d, d+0.5, d+1.0, d+1.5.
    const expected12 =
      segment(12) + segment(12.5) + segment(13) + segment(13.5);
    expect(internationalQuarter(12, 16)).toBeCloseTo(expected12, 10);

    // Without taper it would be 4 * segment(12); taper must make it larger.
    expect(internationalQuarter(12, 16)).toBeGreaterThan(segment(12) * 4);
  });

  it('scales odd trailing footage proportionally instead of discarding it', () => {
    const sixteen = internationalQuarter(12, 16);
    const eighteen = internationalQuarter(12, 18);
    expect(eighteen).toBeGreaterThan(sixteen);
    // The extra 2 ft is half of a 4-ft segment at the next taper step.
    expect(eighteen - sixteen).toBeCloseTo(segment(14) * 0.5, 10);
  });

  it('increases monotonically with diameter', () => {
    let prev = 0;
    for (let d = 6; d <= 30; d += 1) {
      const v = internationalQuarter(d, 16);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });

  it('returns zero for non-positive inputs', () => {
    expect(internationalQuarter(0, 16)).toBe(0);
    expect(internationalQuarter(12, 0)).toBe(0);
    expect(internationalQuarter(-3, 16)).toBe(0);
  });

  it.todo(
    'agrees with the published International 1/4-inch table within 3% ' +
      '(BLOCKED: needs the printed table digitized into the repo)'
  );
});

describe('Scribner log rule', () => {
  /**
   * KNOWN DIVERGENCE. DO NOT RESOLVE THIS BY LOOSENING THE TEST.
   *
   * Scribner is a diagram rule — it was drawn on paper, not derived — so no
   * closed-form expression reproduces it exactly. What is implemented is the
   * widely-cited approximation 0.79D^2 - 2D - 4, with Decimal C rounding to the
   * nearest 10 board feet.
   *
   * This test pins the APPROXIMATION's own arithmetic. It deliberately does not
   * claim agreement with any published Scribner table, because there is none in
   * this repo to check against and the approximation is understood to run high.
   *
   * Shipping a Scribner-region cruise on this is not acceptable. The lookup
   * table must be installed first — see `makeTableRule` below, which exists for
   * exactly that swap.
   */
  it('computes the documented approximation, including Decimal C rounding', () => {
    // 0.79*144 - 24 - 4 = 85.76, rounded to the nearest 10 -> 90
    expect(scribner(12, 16)).toBe(90);
    // 0.79*256 - 32 - 4 = 166.24 -> 170
    expect(scribner(16, 16)).toBe(170);
  });

  it('rounds to tens, because Decimal C is defined in tens of board feet', () => {
    for (const d of [8, 10, 12, 14, 16, 18, 20, 24]) {
      expect(scribner(d, 16) % 10).toBe(0);
    }
  });

  it('returns zero below the 5-inch floor', () => {
    expect(scribner(5, 16)).toBe(0);
    expect(scribner(4, 16)).toBe(0);
  });

  it.todo(
    'is replaced by a digitized Scribner Decimal C table and agrees with it ' +
      'exactly (BLOCKING for any Pacific Northwest beta)'
  );
});

describe('makeTableRule — the swap seam', () => {
  // ILLUSTRATIVE DATA, NOT A PUBLISHED TABLE. These values exist to exercise
  // interpolation and scaling. Do not copy them into production.
  const illustrative = new Map<number, number>([
    [10, 50],
    [12, 80],
    [14, 120],
    [16, 160],
  ]);

  it('returns tabulated values exactly at tabulated diameters', () => {
    const rule = makeTableRule(illustrative);
    expect(rule(12, 16)).toBeCloseTo(80, 10);
    expect(rule(16, 16)).toBeCloseTo(160, 10);
  });

  it('interpolates linearly between tabulated diameters', () => {
    const rule = makeTableRule(illustrative);
    // Midway between 12 (80) and 14 (120) is 100.
    expect(rule(13, 16)).toBeCloseTo(100, 10);
  });

  it('clamps outside the tabulated range rather than extrapolating', () => {
    // Extrapolating a diagram rule past its table is exactly how you generate a
    // confident number with nothing behind it.
    const rule = makeTableRule(illustrative);
    expect(rule(4, 16)).toBeCloseTo(50, 10);
    expect(rule(40, 16)).toBeCloseTo(160, 10);
  });

  it('scales off the 16-foot basis by length', () => {
    const rule = makeTableRule(illustrative);
    expect(rule(12, 8)).toBeCloseTo(40, 10);
    expect(rule(12, 32)).toBeCloseTo(160, 10);
  });

  it('returns zero for an empty table', () => {
    expect(makeTableRule(new Map())(12, 16)).toBe(0);
  });
});

describe('log rule registry', () => {
  it('resolves the three built-in rules by name', () => {
    expect(getLogRule('doyle')(12, 16)).toBeCloseTo(64, 10);
    expect(getLogRule('international_quarter')(12, 16)).toBeGreaterThan(0);
    expect(getLogRule('scribner')(12, 16)).toBeGreaterThan(0);
  });

  it('throws on an unknown rule rather than silently picking a default', () => {
    // Silently defaulting would produce a number under the wrong rule — the
    // exact species of quiet wrongness this codebase is built to prevent.
    expect(() => getLogRule('nonexistent_rule')).toThrow(/Unknown log rule/);
  });

  it('accepts a registered custom rule, which is how Scribner gets fixed', () => {
    registerLogRule('test_flat', (_dib, len) => len * 10);
    expect(getLogRule('test_flat')(12, 16)).toBe(160);
  });
});
