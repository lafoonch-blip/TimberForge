/**
 * LandForge modeled defaults, mirrored.
 *
 * WHY THIS FILE EXISTS
 *
 * LandForge, when it has no real timber data for a parcel, fills in modeled
 * defaults so the scoring engine can still produce a number. Its scoring manual
 * calls these out explicitly, and §7.4 of that manual uses them to decide how
 * much to trust the timber side of a deal:
 *
 *   "Net stumpage / MBF-per-acre present AND NOT EQUAL TO the modeled defaults"
 *
 * That is a value-equality test. It is how LandForge distinguishes "somebody
 * actually knows what is on this land" from "we made it up."
 *
 * THE LATENT BUG THIS FILE GUARDS AGAINST
 *
 * A value-equality test cannot tell a default from a real measurement that
 * happens to land on the default. A genuine, cruised, boots-on-the-ground
 * 4.5 MBF/ac is indistinguishable from the placeholder 4.5 MBF/ac. When that
 * collision happens, LandForge silently demotes a professionally cruised parcel
 * back to "modeled," which:
 *
 *   - drops the inventory confidence tier,
 *   - weakens UQS and therefore the Harvest+Resell strategy confidence
 *     (timberConf x 0.50 + UQS x 0.24 + millScore x 0.26),
 *   - and adds 3.5 points to reservePct via the (timber < 55) penalty.
 *
 * So the parcel gets scored as riskier precisely because the cruise agreed with
 * the model. 4.5 MBF/ac is an entirely ordinary young-pine figure; this is not
 * a hypothetical collision.
 *
 * TIMBERFORGE'S POSITION
 *
 * We do not fight this from the outside by nudging numbers. Perturbing a real
 * measurement to dodge a sentinel would be fabricating data, which the product
 * principles forbid outright, and it would corrupt the ground truth that is the
 * entire reason TimberForge exists.
 *
 * Instead:
 *
 *   1. Every value TimberForge sends carries an EXPLICIT provenance field.
 *      LandForge should read provenance and stop inferring it. That is the real
 *      fix and it belongs in LandForge.
 *   2. Until LandForge is changed, `detectSentinelCollisions()` flags the
 *      collision on our side so the payload can carry a loud, machine-readable
 *      warning rather than being quietly downgraded.
 *
 * MAINTENANCE
 *
 * These constants are a MIRROR of values owned by LandForge. If LandForge
 * changes a default, this file is wrong until someone updates it, and the
 * collision guard will silently stop working. `ASSUMPTIONS_SOURCE` records
 * where they came from so that is auditable.
 */

export const ASSUMPTIONS_SOURCE =
  'LandForge Scoring Engine Manual, modeled-default sentinels and §7.4 inventory confidence ladder';

/**
 * The modeled defaults LandForge substitutes when real timber data is absent.
 * Mirrored, not authoritative. LandForge owns these.
 */
export const LF_ASSUMPTIONS = {
  /** Years. Modeled stand age when none is known. */
  defaultStandAge: 24,
  /** MBF per acre. Modeled standing volume when none is known. */
  defaultMbfPerAcre: 4.5,
  /** Miles. Modeled haul distance to the nearest mill. */
  defaultMillDistanceMi: 45,
  /** Site index, base age per LandForge's convention. */
  defaultSiteIndex: 70,
} as const;

export type LfAssumptionKey = keyof typeof LF_ASSUMPTIONS;

/** Which outbound field each sentinel is compared against. */
export const SENTINEL_FIELD_MAP: Record<LfAssumptionKey, string> = {
  defaultStandAge: 'standAgeYears',
  defaultMbfPerAcre: 'mbfPerAcre',
  defaultMillDistanceMi: 'millDistanceMi',
  defaultSiteIndex: 'siteIndex',
};

/**
 * Floating-point tolerance for the collision test.
 *
 * This deliberately mirrors what a strict `===` in LandForge would do, plus a
 * hair of slack for the fact that our value arrives through JSON and a numeric
 * column. A cruise producing 4.500001 MBF/ac would compare unequal in
 * LandForge and thus NOT collide — but it is close enough that a later rounding
 * change on either side could flip the outcome, so we flag it anyway. Better a
 * warning that turns out to be moot than a downgrade nobody noticed.
 */
export const SENTINEL_TOLERANCE = 1e-6;

export interface SentinelCollision {
  assumption: LfAssumptionKey;
  field: string;
  /** The real, measured value TimberForge is sending. */
  value: number;
  /** The LandForge default it collides with. */
  sentinel: number;
  /** True when the values are bit-equal and LandForge's `===` will definitely fire. */
  exact: boolean;
  message: string;
}

/**
 * Flag any outbound value that equals a LandForge modeled default.
 *
 * Call this on every payload before sending. A non-empty result does NOT mean
 * the data is wrong — it means LandForge will misclassify correct data, and the
 * payload should carry the warning so the downgrade is visible rather than
 * silent.
 */
export function detectSentinelCollisions(values: {
  standAgeYears?: number | undefined;
  mbfPerAcre?: number | undefined;
  millDistanceMi?: number | undefined;
  siteIndex?: number | undefined;
}): SentinelCollision[] {
  const checks: [LfAssumptionKey, number | undefined][] = [
    ['defaultStandAge', values.standAgeYears],
    ['defaultMbfPerAcre', values.mbfPerAcre],
    ['defaultMillDistanceMi', values.millDistanceMi],
    ['defaultSiteIndex', values.siteIndex],
  ];

  const collisions: SentinelCollision[] = [];
  for (const [key, value] of checks) {
    if (value === undefined || !Number.isFinite(value)) continue;
    const sentinel = LF_ASSUMPTIONS[key];
    if (Math.abs(value - sentinel) > SENTINEL_TOLERANCE) continue;
    const field = SENTINEL_FIELD_MAP[key];
    collisions.push({
      assumption: key,
      field,
      value,
      sentinel,
      exact: value === sentinel,
      message:
        `Measured ${field} of ${value} equals the LandForge modeled default ` +
        `(${sentinel}). LandForge's §7.4 ladder identifies sourced data by ` +
        `value inequality, so this real measurement will be classified as ` +
        `modeled unless LandForge reads the explicit provenance field instead.`,
    });
  }
  return collisions;
}

/**
 * True when a value would be read by LandForge as "still the default."
 * Exposed separately because the field app wants a cheap boolean for a badge.
 */
export function collidesWithSentinel(
  key: LfAssumptionKey,
  value: number | undefined
): boolean {
  if (value === undefined || !Number.isFinite(value)) return false;
  return Math.abs(value - LF_ASSUMPTIONS[key]) <= SENTINEL_TOLERANCE;
}
