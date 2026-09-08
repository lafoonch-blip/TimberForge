/**
 * A local replica of LandForge's inventory confidence ladder (§7.4) and the
 * downstream terms a timber feed moves.
 *
 * WHY REPLICATE SOMETHING WE DO NOT OWN
 *
 * Because the most valuable thing TimberForge can tell a forester is not
 * "here is your volume." It is:
 *
 *   "Delivering this cruise moves this parcel from Low inventory confidence to
 *    High, raises Harvest+Resell strategy confidence by ~14 points, and drops
 *    the reserve requirement by 3.5%."
 *
 * That sentence is the commercial bridge between the two products, and it can
 * only be produced by knowing what LandForge will do with the payload before
 * sending it.
 *
 * THIS IS A PREDICTION, NOT AN AUTHORITY
 *
 * LandForge computes the real score. Everything here is a forecast of what it
 * will compute, and it is only as current as the manual it was read from.
 * `LADDER_REPLICA_VERSION` exists so a mismatch is detectable: when LandForge
 * returns its own score, compare, and if they disagree, THIS FILE is wrong.
 *
 * Nothing in here may ever be written back to a cruise record as if it were a
 * measurement. It is an estimate of another system's behaviour.
 */

import {
  detectSentinelCollisions,
  type SentinelCollision,
} from './assumptions.js';

/**
 * Bump when this replica is re-derived from a newer LandForge manual. Persist
 * it alongside any predicted score so a stale prediction is identifiable.
 */
export const LADDER_REPLICA_VERSION = 'lf-ladder-replica-v1-from-lfs-v3';

/** Engine stamps this replica was derived against, for drift detection. */
export const DERIVED_FROM_ENGINES = [
  'lfs-v3-profit-quality-risk-penalty',
  'hbu-v1',
  'v18-valuation-coherence',
] as const;

export type InventoryTier = 'none' | 'low' | 'medium' | 'high';

/**
 * Inputs the ladder reads. Named for what they mean, not for LandForge's
 * column names — `adapter.ts` owns that translation.
 */
export interface LadderInputs {
  /** Standing volume, MBF per acre. */
  mbfPerAcre?: number | undefined;
  /** Net stumpage value, dollars per acre. */
  netStumpagePerAcre?: number | undefined;
  standAgeYears?: number | undefined;
  siteIndex?: number | undefined;
  millDistanceMi?: number | undefined;
  /**
   * TimberForge's explicit statement of where the numbers came from. LandForge
   * does not read this today — that is the change we are asking for. Supplying
   * it lets this replica predict both the current behaviour and the corrected
   * behaviour, which is exactly the argument for making the change.
   */
  provenance?: 'measured' | 'estimated' | 'predicted' | 'computed' | 'defaulted';
  /** Sampling error percent from the cruise. Lower is better. */
  samplingErrorPct?: number | undefined;
  /** Number of plots behind the estimate. */
  plotCount?: number | undefined;
}

export interface TierAssessment {
  tier: InventoryTier;
  /** 0-100 timber confidence contribution, the `timberConf` term. */
  timberConfidence: number;
  /** Plain-language reasons, in the order the ladder evaluated them. */
  reasons: string[];
  /** Collisions that will cause LandForge to under-read this data. */
  collisions: SentinelCollision[];
  /**
   * What the tier WOULD be if LandForge read the explicit provenance field
   * instead of testing value inequality. When this differs from `tier`, the
   * sentinel bug is actively costing this parcel.
   */
  tierIfProvenanceHonored: InventoryTier;
}

/**
 * Timber confidence points per tier.
 *
 * VERIFY AGAINST LANDFORGE. The manual states the ladder's TRIGGERS precisely;
 * these point values are the working figures used to reproduce observed
 * behaviour, notably that the `timber < 55` reserve penalty fires below the
 * medium tier and not at or above it. Replace with LandForge's literal values
 * as soon as index.html is available.
 */
export const TIER_CONFIDENCE: Record<InventoryTier, number> = {
  none: 25,
  low: 45,
  medium: 65,
  high: 85,
};

/**
 * Classify a parcel's timber inventory the way LandForge §7.4 does.
 *
 * The ladder, as documented: the medium tier is reached when net stumpage or
 * MBF-per-acre is present AND NOT EQUAL TO the modeled defaults. Presence
 * alone, still sitting on a default, is the low tier. Nothing at all is `none`.
 * The high tier is reserved for data that additionally carries a measured
 * sampling design — which, until now, LandForge had no way to receive. That is
 * the tier TimberForge exists to unlock.
 */
export function assessInventoryTier(input: LadderInputs): TierAssessment {
  const reasons: string[] = [];
  const collisions = detectSentinelCollisions({
    standAgeYears: input.standAgeYears,
    mbfPerAcre: input.mbfPerAcre,
    millDistanceMi: input.millDistanceMi,
    siteIndex: input.siteIndex,
  });

  const hasVolume =
    typeof input.mbfPerAcre === 'number' && Number.isFinite(input.mbfPerAcre);
  const hasStumpage =
    typeof input.netStumpagePerAcre === 'number' &&
    Number.isFinite(input.netStumpagePerAcre);

  if (!hasVolume && !hasStumpage) {
    return {
      tier: 'none',
      timberConfidence: TIER_CONFIDENCE.none,
      reasons: ['No standing volume or net stumpage is present for this parcel.'],
      collisions,
      tierIfProvenanceHonored: 'none',
    };
  }

  const volumeCollides = collisions.some((c) => c.field === 'mbfPerAcre');

  // --- what LandForge will actually do, today, with a value-equality test ---
  let tier: InventoryTier;
  if (hasStumpage && !volumeCollides) {
    tier = 'medium';
    reasons.push(
      'Net stumpage is present and standing volume does not sit on a modeled default.'
    );
  } else if (hasVolume && !volumeCollides) {
    tier = 'medium';
    reasons.push(
      `Standing volume of ${input.mbfPerAcre} MBF/ac differs from the modeled default.`
    );
  } else {
    tier = 'low';
    reasons.push(
      'Timber values are present but indistinguishable from LandForge\u2019s modeled defaults.'
    );
  }

  // The high tier requires evidence of an actual sampling design, not just a
  // number. This is the part that only a cruise can supply.
  const measured = input.provenance === 'measured';
  const wellSampled =
    typeof input.plotCount === 'number' &&
    input.plotCount >= 2 &&
    typeof input.samplingErrorPct === 'number' &&
    input.samplingErrorPct > 0 &&
    input.samplingErrorPct <= 20;

  if (tier === 'medium' && measured && wellSampled) {
    tier = 'high';
    reasons.push(
      `Backed by a field cruise: ${input.plotCount} plots at ` +
        `${input.samplingErrorPct?.toFixed(1)}% sampling error.`
    );
  } else if (measured && !wellSampled) {
    reasons.push(
      'Cruise data is present but the sampling design does not yet support the ' +
        'highest tier — at least two plots and a sampling error of 20% or better are needed.'
    );
  }

  // --- what it SHOULD be if provenance were read explicitly ---
  let corrected: InventoryTier = tier;
  if (measured) {
    corrected = wellSampled ? 'high' : 'medium';
    if (corrected !== tier) {
      reasons.push(
        'This parcel is being under-rated: the values are measured, but one of ' +
          'them collides with a modeled default and LandForge infers provenance ' +
          'from value inequality.'
      );
    }
  }

  return {
    tier,
    timberConfidence: TIER_CONFIDENCE[tier],
    reasons,
    collisions,
    tierIfProvenanceHonored: corrected,
  };
}

/**
 * LandForge's mill proximity score.
 *
 *   millScore = clamp(100 - max(0, mill - 20) * 1.4, 15, 95)
 *
 * Reproduced verbatim from the scoring manual. The first 20 miles are free;
 * beyond that each mile costs 1.4 points, floored at 15 and capped at 95.
 */
export function millScore(millDistanceMi: number): number {
  const raw = 100 - Math.max(0, millDistanceMi - 20) * 1.4;
  return Math.min(95, Math.max(15, raw));
}

/**
 * Harvest + Resell strategy confidence.
 *
 *   timberConf * 0.50 + UQS * 0.24 + millScore * 0.26
 *
 * Reproduced verbatim. Note the weighting: timber confidence is half the
 * strategy's credibility, which is why a silent tier downgrade is expensive.
 */
export function harvestResellConfidence(
  timberConf: number,
  uqs: number,
  mill: number
): number {
  return timberConf * 0.5 + uqs * 0.24 + millScore(mill) * 0.26;
}

/**
 * The timber component of LandForge's reserve requirement.
 *
 * The manual's `reservePct` includes the term `(timber < 55 ? 3.5 : 0)`. A
 * parcel whose timber confidence falls below 55 is required to hold an extra
 * 3.5% in reserve. With the tier values above, that threshold sits exactly
 * between the low tier (45) and the medium tier (65) — so the sentinel
 * collision does not merely shade a number, it flips this penalty on.
 */
export function timberReservePenaltyPct(timberConf: number): number {
  return timberConf < 55 ? 3.5 : 0;
}

export interface ImpactForecast {
  before: TierAssessment;
  after: TierAssessment;
  timberConfidenceDelta: number;
  strategyConfidenceDelta: number;
  reservePctDelta: number;
  /** One-line summaries suitable for showing a forester why this matters. */
  headlines: string[];
}

/**
 * Forecast what delivering a cruise does to a parcel's LandForge scoring.
 *
 * `uqs` and `millDistanceMi` come from LandForge's existing record for the
 * parcel; if they are unknown, pass the neutral defaults and treat the result
 * as directional only.
 */
export function forecastImpact(
  before: LadderInputs,
  after: LadderInputs,
  context: { uqs: number; millDistanceMi: number }
): ImpactForecast {
  const b = assessInventoryTier(before);
  const a = assessInventoryTier(after);

  const bStrategy = harvestResellConfidence(
    b.timberConfidence,
    context.uqs,
    context.millDistanceMi
  );
  const aStrategy = harvestResellConfidence(
    a.timberConfidence,
    context.uqs,
    context.millDistanceMi
  );

  const bReserve = timberReservePenaltyPct(b.timberConfidence);
  const aReserve = timberReservePenaltyPct(a.timberConfidence);

  const headlines: string[] = [];
  if (a.tier !== b.tier) {
    headlines.push(
      `Inventory confidence moves from ${b.tier} to ${a.tier}.`
    );
  }
  if (aStrategy !== bStrategy) {
    headlines.push(
      `Harvest + Resell strategy confidence changes by ${(aStrategy - bStrategy).toFixed(1)} points.`
    );
  }
  if (aReserve !== bReserve) {
    headlines.push(
      `Reserve requirement changes by ${(aReserve - bReserve).toFixed(1)}%.`
    );
  }
  if (a.tier !== a.tierIfProvenanceHonored) {
    headlines.push(
      `Warning: this cruise is being scored as ${a.tier} when it should be ` +
        `${a.tierIfProvenanceHonored}. A measured value collides with a LandForge modeled default.`
    );
  }
  if (headlines.length === 0) {
    headlines.push('This cruise does not change the parcel\u2019s timber confidence tier.');
  }

  return {
    before: b,
    after: a,
    timberConfidenceDelta: a.timberConfidence - b.timberConfidence,
    strategyConfidenceDelta: aStrategy - bStrategy,
    reservePctDelta: aReserve - bReserve,
    headlines,
  };
}
