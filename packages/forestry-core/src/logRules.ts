/**
 * Board-foot log rules.
 *
 * IMPORTANT — read before trusting these in front of a client.
 *
 * Doyle, Scribner and International are *diagram* and *table* rules by origin,
 * not formulas. The formulas below are the standard published algebraic
 * approximations of those rules. Doyle is exact (it was defined as a formula).
 * International reproduces its table closely because the segment construction
 * below IS the rule's definition. Scribner is the problem child: it was drawn,
 * not derived, and the common 0.79D^2 - 2D - 4 formula diverges from published
 * Scribner Decimal C tables by a meaningful margin at some diameters.
 *
 * Consequence for TimberForge: a cruiser in a Scribner region who checks our
 * output against their Scribner table WILL find disagreement, and will not
 * trust anything else we produce afterward. Before any Scribner-region beta,
 * `scribner` must be swapped for a lookup table via `registerLogRule`. The
 * registry below exists precisely so that swap is a one-line change and does
 * not require touching volume, metrics, or reporting code.
 */

import { STANDARD_LOG_FT } from './constants.js';
import type { LogRuleName } from './types.js';

/**
 * A log rule computes gross board feet for one log, given the scaling diameter
 * (diameter inside bark at the small end, in inches) and log length in feet.
 */
export type LogRule = (scalingDiameterIn: number, logLengthFt: number) => number;

/**
 * Doyle log rule.
 *
 *   BF = ((D - 4) / 4)^2 * L
 *
 * For the standard 16-ft log this reduces to exactly (D - 4)^2, which is why
 * a 12" x 16' log scales 64 BF in every published Doyle table.
 *
 * Doyle severely under-scales small logs (a 6" log scales 1 BF) and is
 * generous on large ones. It is nonetheless the dominant rule in the US South,
 * so it is the default for that region — accuracy to the *market* matters more
 * than accuracy to cubic reality when the mill is paying on Doyle.
 */
export const doyle: LogRule = (d, length) => {
  if (d <= 4) return 0;
  return Math.pow((d - 4) / 4, 2) * length;
};

/**
 * Scribner Decimal C.
 *
 *   BF = (0.79 D^2 - 2 D - 4) * (L / 16), rounded to the nearest 10 BF.
 *
 * "Decimal C" means volumes are expressed in tens of board feet, so the
 * rounding is part of the rule, not a display choice.
 *
 * See the file header: this formula is an approximation of a diagram rule and
 * should be replaced with a table before Scribner-region use.
 */
export const scribner: LogRule = (d, length) => {
  if (d <= 5) return 0;
  const sixteenFoot = 0.79 * d * d - 2 * d - 4;
  if (sixteenFoot <= 0) return 0;
  const scaled = sixteenFoot * (length / STANDARD_LOG_FT);
  return Math.round(scaled / 10) * 10;
};

/**
 * International 1/4-inch rule.
 *
 * Unlike the other two this is genuinely constructive: the log is divided into
 * 4-foot segments, each segment is scaled from its own small-end diameter, and
 * a 1/2-inch taper allowance is added per 4 feet moving toward the butt.
 *
 *   segment BF = 0.22 d^2 - 0.71 d      (d = that segment's small-end DIB)
 *
 * The 1/4-inch in the name is the assumed saw kerf, which is already baked
 * into those coefficients. This rule is the closest of the three to true cubic
 * content, which is why it is the standard for research and for FIA work.
 *
 * Odd trailing footage (a length not divisible by 4) is scaled proportionally
 * rather than discarded.
 */
export const internationalQuarter: LogRule = (d, length) => {
  if (d <= 0 || length <= 0) return 0;
  let total = 0;
  const wholeSegments = Math.floor(length / 4);
  for (let i = 0; i < wholeSegments; i++) {
    // Taper allowance: each 4-ft segment toward the butt is 1/2" larger.
    const segDib = d + 0.5 * i;
    const seg = 0.22 * segDib * segDib - 0.71 * segDib;
    if (seg > 0) total += seg;
  }
  const remainder = length - wholeSegments * 4;
  if (remainder > 0) {
    const segDib = d + 0.5 * wholeSegments;
    const seg = 0.22 * segDib * segDib - 0.71 * segDib;
    if (seg > 0) total += seg * (remainder / 4);
  }
  return total;
};

const registry = new Map<string, LogRule>([
  ['doyle', doyle],
  ['scribner', scribner],
  ['international_quarter', internationalQuarter],
]);

/**
 * Replace or add a log rule implementation at runtime.
 *
 * This is the seam described in the file header. Swapping `scribner` for a
 * table-backed implementation is:
 *
 *   registerLogRule('scribner', makeTableRule(scribnerDecimalCTable));
 *
 * Nothing downstream needs to change, because everything resolves the rule
 * through `getLogRule` rather than importing an implementation directly.
 */
export function registerLogRule(name: string, rule: LogRule): void {
  registry.set(name, rule);
}

export function getLogRule(name: LogRuleName | string): LogRule {
  const rule = registry.get(name);
  if (!rule) {
    throw new Error(
      `Unknown log rule "${name}". Registered rules: ${[...registry.keys()].join(', ')}`
    );
  }
  return rule;
}

/**
 * Build a log rule backed by a lookup table, interpolating between listed
 * diameters. Provided so that replacing the Scribner approximation with real
 * published values requires no new code, only data.
 *
 * @param table Map of scaling diameter (inches) to BF for a 16-ft log.
 */
export function makeTableRule(table: Map<number, number>): LogRule {
  const diameters = [...table.keys()].sort((a, b) => a - b);
  return (d, length) => {
    if (diameters.length === 0) return 0;
    const first = diameters[0]!;
    const last = diameters[diameters.length - 1]!;
    let bf16: number;
    if (d <= first) {
      bf16 = table.get(first)!;
    } else if (d >= last) {
      bf16 = table.get(last)!;
    } else {
      let lo = first;
      let hi = last;
      for (let i = 0; i < diameters.length - 1; i++) {
        const a = diameters[i]!;
        const b = diameters[i + 1]!;
        if (d >= a && d <= b) {
          lo = a;
          hi = b;
          break;
        }
      }
      const loVal = table.get(lo)!;
      const hiVal = table.get(hi)!;
      bf16 = hi === lo ? loVal : loVal + ((d - lo) / (hi - lo)) * (hiVal - loVal);
    }
    return bf16 * (length / STANDARD_LOG_FT);
  };
}
