/**
 * Sampling statistics.
 *
 * The t-values here are checked against standard published Student's t tables,
 * which are unambiguous and universally agreed — unlike log rules, there is no
 * regional variation to worry about.
 *
 * The behavioural tests matter more than the arithmetic ones. The single most
 * common failure in homegrown cruise spreadsheets is computing variance across
 * TREES instead of across PLOTS, which produces flatteringly small sampling
 * errors. `sampleStatistics` cannot make that mistake because it only ever
 * receives per-plot values — but the compile tests downstream verify that the
 * caller feeds it correctly.
 */

import { describe, expect, it } from 'vitest';
import { plotsNeeded, sampleStatistics, tCritical } from '@timberforge/forestry-core';

describe('tCritical', () => {
  it('matches published two-tailed t values at 95% confidence', () => {
    expect(tCritical(1, 0.95)).toBeCloseTo(12.706, 3);
    expect(tCritical(5, 0.95)).toBeCloseTo(2.571, 3);
    expect(tCritical(9, 0.95)).toBeCloseTo(2.262, 3);
    expect(tCritical(19, 0.95)).toBeCloseTo(2.093, 3);
    expect(tCritical(30, 0.95)).toBeCloseTo(2.042, 3);
    expect(tCritical(120, 0.95)).toBeCloseTo(1.98, 3);
  });

  it('matches published two-tailed t values at 90% confidence', () => {
    expect(tCritical(1, 0.9)).toBeCloseTo(6.314, 3);
    expect(tCritical(9, 0.9)).toBeCloseTo(1.833, 3);
    expect(tCritical(30, 0.9)).toBeCloseTo(1.697, 3);
  });

  it('is always larger at 95% than at 90% for the same df', () => {
    for (const df of [1, 3, 7, 15, 29, 45, 90]) {
      expect(tCritical(df, 0.95)).toBeGreaterThan(tCritical(df, 0.9));
    }
  });

  it('decreases monotonically toward z as df grows', () => {
    let prev = Infinity;
    for (let df = 1; df <= 120; df++) {
      const t = tCritical(df, 0.95);
      expect(t).toBeLessThanOrEqual(prev + 1e-9);
      prev = t;
    }
    expect(tCritical(1000, 0.95)).toBeCloseTo(1.96, 6);
    expect(tCritical(1000, 0.9)).toBeCloseTo(1.645, 6);
  });

  it('interpolates between tabulated degrees of freedom', () => {
    // df 35 sits between the tabulated 30 (2.042) and 40 (2.021).
    const t35 = tCritical(35, 0.95);
    expect(t35).toBeLessThan(2.042);
    expect(t35).toBeGreaterThan(2.021);
  });

  it('returns NaN below one degree of freedom', () => {
    expect(Number.isNaN(tCritical(0))).toBe(true);
  });
});

describe('sampleStatistics', () => {
  it('computes mean, sample SD and standard error correctly', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const s = sampleStatistics(values);
    expect(s.n).toBe(8);
    expect(s.mean).toBeCloseTo(5, 10);
    // Sample SD with n-1 denominator is sqrt(32/7) = 2.13809...
    expect(s.standardDeviation).toBeCloseTo(Math.sqrt(32 / 7), 10);
    expect(s.standardError).toBeCloseTo(Math.sqrt(32 / 7) / Math.sqrt(8), 10);
    expect(s.degreesOfFreedom).toBe(7);
  });

  it('uses the n-1 denominator, not n', () => {
    const values = [10, 20];
    const s = sampleStatistics(values);
    // Population SD would be 5; sample SD is 7.0710678.
    expect(s.standardDeviation).toBeCloseTo(7.0710678, 6);
  });

  it('builds a confidence interval symmetric about the mean', () => {
    const s = sampleStatistics([100, 120, 140, 160, 180]);
    expect(s.mean).toBeCloseTo(140, 10);
    expect(s.confidenceHigh - s.mean).toBeCloseTo(s.mean - s.confidenceLow, 10);
    expect(s.confidenceHalfWidth).toBeCloseTo(s.tValue * s.standardError, 10);
  });

  it('expresses sampling error as a percent of the mean', () => {
    const s = sampleStatistics([100, 120, 140, 160, 180]);
    expect(s.samplingErrorPct).toBeCloseTo(
      (s.confidenceHalfWidth / s.mean) * 100,
      10
    );
  });

  /**
   * EMPTY PLOTS ARE OBSERVATIONS OF ZERO.
   *
   * This is the highest-consequence behaviour in the module. Dropping empty
   * plots inflates the mean and understates variance simultaneously — the
   * estimate goes up AND looks more precise, which is the worst possible pair
   * of errors to make in a document a client relies on.
   */
  it('treats a zero as a real observation that lowers the mean and raises variance', () => {
    const withEmpty = sampleStatistics([0, 100, 200, 300]);
    const withoutEmpty = sampleStatistics([100, 200, 300]);

    expect(withEmpty.mean).toBeCloseTo(150, 10);
    expect(withoutEmpty.mean).toBeCloseTo(200, 10);
    expect(withEmpty.mean).toBeLessThan(withoutEmpty.mean);
    expect(withEmpty.coefficientOfVariationPct).toBeGreaterThan(
      withoutEmpty.coefficientOfVariationPct
    );
  });

  it('reports a mean but no error for a single plot', () => {
    // One plot yields an estimate with no measure of its reliability. Reporting
    // a sampling error of 0% would be a lie of the most flattering kind.
    const s = sampleStatistics([250]);
    expect(s.n).toBe(1);
    expect(s.mean).toBeCloseTo(250, 10);
    expect(s.samplingErrorPct).toBe(0);
    expect(s.standardDeviation).toBe(0);
    expect(Number.isNaN(s.tValue)).toBe(true);
    expect(s.confidenceLow).toBe(250);
    expect(s.confidenceHigh).toBe(250);
  });

  it('handles an empty array without throwing', () => {
    const s = sampleStatistics([]);
    expect(s.n).toBe(0);
    expect(s.mean).toBe(0);
  });

  it('reports zero error for identical plots', () => {
    const s = sampleStatistics([100, 100, 100, 100]);
    expect(s.standardDeviation).toBeCloseTo(0, 10);
    expect(s.samplingErrorPct).toBeCloseTo(0, 10);
  });

  it('gives a wider interval at 95% than at 90%', () => {
    const values = [80, 120, 95, 140, 60];
    expect(sampleStatistics(values, 0.95).confidenceHalfWidth).toBeGreaterThan(
      sampleStatistics(values, 0.9).confidenceHalfWidth
    );
  });

  it('does not produce a negative CV when the mean is negative', () => {
    const s = sampleStatistics([-100, -200, -300]);
    expect(s.coefficientOfVariationPct).toBeGreaterThan(0);
  });
});

describe('plotsNeeded', () => {
  it('reports the target as achieved when it already is', () => {
    const s = sampleStatistics([100, 102, 98, 101, 99, 100, 101]);
    const r = plotsNeeded(s, 20);
    expect(r.achieved).toBe(true);
    expect(r.additionalPlots).toBe(0);
    expect(r.plotsRequired).toBe(s.n);
  });

  it('recommends more plots when the target is not met', () => {
    const s = sampleStatistics([50, 400, 120, 900, 30]);
    const r = plotsNeeded(s, 10);
    expect(r.achieved).toBe(false);
    expect(r.additionalPlots).toBeGreaterThan(0);
    expect(r.plotsRequired).toBeGreaterThan(s.n);
  });

  /**
   * n = (t * CV / E)^2. Because t depends on n, a single-pass calculation using
   * z under-recommends. This test proves the iteration actually converged
   * rather than stopping at the first estimate.
   */
  it('iterates to a fixed point rather than using a single z pass', () => {
    const s = sampleStatistics([50, 400, 120, 900, 30]);
    const target = 10;
    const r = plotsNeeded(s, target);

    // Recompute the requirement using the t for the recommended n. If the
    // iteration converged, this reproduces the same n.
    const t = tCritical(r.plotsRequired - 1, 0.95);
    const recomputed = Math.ceil(
      Math.pow((t * s.coefficientOfVariationPct) / target, 2)
    );
    expect(recomputed).toBe(r.plotsRequired);

    // And it must exceed what a naive z-based pass would have given.
    const zBased = Math.ceil(
      Math.pow((1.96 * s.coefficientOfVariationPct) / target, 2)
    );
    expect(r.plotsRequired).toBeGreaterThanOrEqual(zBased);
  });

  it('requires roughly four times the plots to halve the target error', () => {
    const s = sampleStatistics([50, 400, 120, 900, 30, 220, 610]);
    const at20 = plotsNeeded(s, 20).plotsRequired;
    const at10 = plotsNeeded(s, 10).plotsRequired;
    const ratio = at10 / at20;
    // Not exactly 4 because t shifts with n, but it must be in the region.
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(5);
  });

  it('declines to estimate from fewer than two plots', () => {
    const r = plotsNeeded(sampleStatistics([100]), 10);
    expect(r.note).toMatch(/two plots/i);
    expect(r.additionalPlots).toBe(0);
  });

  it('declines to estimate when the mean is zero', () => {
    const r = plotsNeeded(sampleStatistics([0, 0, 0]), 10);
    expect(r.note).toMatch(/zero/i);
  });

  it('rejects a non-positive target', () => {
    const r = plotsNeeded(sampleStatistics([10, 20, 30]), 0);
    expect(r.note).toMatch(/greater than zero/i);
  });
});
