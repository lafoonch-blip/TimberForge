/**
 * Fundamental forestry constants.
 *
 * Every constant here is a published, checkable value. Nothing in this file is
 * a tuning knob — if a number can legitimately vary by region, crew, or client
 * it does NOT belong here, it belongs in a region profile or cruise config.
 */

/**
 * Foresters' constant. Converts DBH in inches to basal area in square feet.
 *
 *   BA (ft^2) = 0.005454154 * DBH^2
 *
 * Derivation: (pi/4) / 144 = 0.00545415... The area of a circle in square feet
 * given a diameter in inches. Published to 9 decimals in Avery & Burkhart,
 * "Forest Measurements", and used unrounded here so that basal area round-trips
 * cleanly through the expansion factors.
 */
export const FOREST_CONSTANT = 0.005454154;

/** Square feet in one acre. */
export const SQ_FT_PER_ACRE = 43560;

/** Standard log length, in feet, that the classic log rule formulas are stated for. */
export const STANDARD_LOG_FT = 16;

/** Board feet per thousand board feet. */
export const BF_PER_MBF = 1000;

/** Pounds in one (short) ton. Green tons in the US South are short tons. */
export const LB_PER_TON = 2000;
