/**
 * Sampling statistics.
 *
 * The unit of observation in a timber cruise is the PLOT, not the tree. Trees
 * within a plot are not independent, so every statistic here is computed across
 * per-plot expanded values. Computing variance across trees is the single most
 * common statistical error in homegrown cruise spreadsheets and it produces
 * sampling errors that are wildly, flatteringly too low.
 *
 * Empty plots are observations of zero and MUST be in the array. Dropping them
 * inflates the mean and understates variance.
 */

/** Two-tailed Student's t at alpha = 0.05, indexed by degrees of freedom. */
const T_95: Record<number, number> = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
  6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.16, 14: 2.145, 15: 2.131,
  16: 2.12, 17: 2.11, 18: 2.101, 19: 2.093, 20: 2.086,
  21: 2.08, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.06,
  26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
  40: 2.021, 50: 2.009, 60: 2.0, 80: 1.99, 100: 1.984, 120: 1.98,
};

/** Two-tailed Student's t at alpha = 0.10 (90% confidence). */
const T_90: Record<number, number> = {
  1: 6.314, 2: 2.92, 3: 2.353, 4: 2.132, 5: 2.015,
  6: 1.943, 7: 1.895, 8: 1.86, 9: 1.833, 10: 1.812,
  11: 1.796, 12: 1.782, 13: 1.771, 14: 1.761, 15: 1.753,
  16: 1.746, 17: 1.74, 18: 1.734, 19: 1.729, 20: 1.725,
  21: 1.721, 22: 1.717, 23: 1.714, 24: 1.711, 25: 1.708,
  26: 1.706, 27: 1.703, 28: 1.701, 29: 1.699, 30: 1.697,
  40: 1.684, 50: 1.676, 60: 1.671, 80: 1.664, 100: 1.66, 120: 1.658,
};

const Z_95 = 1.96;
const Z_90 = 1.645;

/**
 * Critical t value for the given degrees of freedom and confidence level.
 * Interpolates between tabulated df and falls back to the normal z for large
 * samples. Only 90% and 95% are supported because those are the levels
 * cruise contracts actually specify.
 */
export function tCritical(df: number, confidence: 0.9 | 0.95 = 0.95): number {
  const table = confidence === 0.95 ? T_95 : T_90;
  const z = confidence === 0.95 ? Z_95 : Z_90;
  if (df < 1) return NaN;
  const exact = table[df];
  if (exact !== undefined) return exact;
  const keys = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  const max = keys[keys.length - 1]!;
  if (df > max) return z;
  let lo = keys[0]!;
  let hi = max;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (df > a && df < b) {
      lo = a;
      hi = b;
      break;
    }
  }
  const loVal = table[lo]!;
  const hiVal = table[hi]!;
  return loVal + ((df - lo) / (hi - lo)) * (hiVal - loVal);
}

export interface SampleStatistics {
  /** Number of plots (including empty plots). */
  n: number;
  mean: number;
  /** Sample standard deviation (n-1 denominator). */
  standardDeviation: number;
  /** Standard error of the mean. */
  standardError: number;
  /** Coefficient of variation, percent. */
  coefficientOfVariationPct: number;
  /** Sampling error as a percent of the mean, at the requested confidence. */
  samplingErrorPct: number;
  /** Absolute half-width of the confidence interval, in the value's units. */
  confidenceHalfWidth: number;
  confidenceLow: number;
  confidenceHigh: number;
  confidenceLevel: number;
  tValue: number;
  degreesOfFreedom: number;
}

/**
 * Compute cruise sampling statistics from per-plot expanded values.
 *
 * @param plotValues One value per plot — e.g. net board feet per acre at each
 *   plot. Include zeros for empty plots.
 */
export function sampleStatistics(
  plotValues: number[],
  confidence: 0.9 | 0.95 = 0.95
): SampleStatistics {
  const n = plotValues.length;
  const base: SampleStatistics = {
    n,
    mean: 0,
    standardDeviation: 0,
    standardError: 0,
    coefficientOfVariationPct: 0,
    samplingErrorPct: 0,
    confidenceHalfWidth: 0,
    confidenceLow: 0,
    confidenceHigh: 0,
    confidenceLevel: confidence,
    tValue: NaN,
    degreesOfFreedom: Math.max(0, n - 1),
  };
  if (n === 0) return base;

  const mean = plotValues.reduce((a, b) => a + b, 0) / n;
  base.mean = mean;

  // A single plot yields an estimate but no measure of its reliability. Report
  // the mean and leave the error undefined rather than implying precision.
  if (n === 1) {
    base.confidenceLow = mean;
    base.confidenceHigh = mean;
    return base;
  }

  const variance =
    plotValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1);
  const sd = Math.sqrt(variance);
  const se = sd / Math.sqrt(n);
  const df = n - 1;
  const t = tCritical(df, confidence);
  const halfWidth = t * se;

  base.standardDeviation = sd;
  base.standardError = se;
  base.coefficientOfVariationPct = mean !== 0 ? (sd / Math.abs(mean)) * 100 : 0;
  base.samplingErrorPct = mean !== 0 ? (halfWidth / Math.abs(mean)) * 100 : 0;
  base.confidenceHalfWidth = halfWidth;
  base.confidenceLow = mean - halfWidth;
  base.confidenceHigh = mean + halfWidth;
  base.tValue = t;
  base.degreesOfFreedom = df;
  return base;
}

export interface PlotsNeededResult {
  /** Total plots required to hit the target, including those already taken. */
  plotsRequired: number;
  /** How many more to install right now. Zero if the target is already met. */
  additionalPlots: number;
  targetErrorPct: number;
  currentErrorPct: number;
  achieved: boolean;
  /** Set when the estimate cannot be made (too few plots, or a zero mean). */
  note?: string;
}

/**
 * How many plots are needed to reach a target sampling error.
 *
 *   n = ( t * CV / E )^2
 *
 * Because t itself depends on n, this iterates to a fixed point rather than
 * using a single-pass z approximation — the difference is material at the small
 * plot counts typical of consulting cruises, where using z instead of t can
 * under-recommend by several plots.
 *
 * This answers the question the cruiser actually has while standing in the
 * woods: "can I go home yet?"
 */
export function plotsNeeded(
  stats: SampleStatistics,
  targetErrorPct: number,
  confidence: 0.9 | 0.95 = 0.95
): PlotsNeededResult {
  const result: PlotsNeededResult = {
    plotsRequired: stats.n,
    additionalPlots: 0,
    targetErrorPct,
    currentErrorPct: stats.samplingErrorPct,
    achieved: false,
  };

  if (stats.n < 2) {
    result.note =
      'At least two plots are required before variability can be estimated.';
    return result;
  }
  if (stats.mean === 0) {
    result.note = 'Mean is zero; a percent sampling error is undefined.';
    return result;
  }
  if (targetErrorPct <= 0) {
    result.note = 'Target sampling error must be greater than zero.';
    return result;
  }

  if (stats.samplingErrorPct <= targetErrorPct) {
    result.achieved = true;
    result.plotsRequired = stats.n;
    return result;
  }

  const cv = stats.coefficientOfVariationPct;
  let n = stats.n;
  for (let i = 0; i < 100; i++) {
    const t = tCritical(Math.max(1, n - 1), confidence);
    const next = Math.ceil(Math.pow((t * cv) / targetErrorPct, 2));
    if (next === n) break;
    n = next;
  }

  result.plotsRequired = Math.max(n, stats.n);
  result.additionalPlots = Math.max(0, result.plotsRequired - stats.n);
  return result;
}
