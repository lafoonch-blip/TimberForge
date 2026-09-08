/**
 * Projecting a cruise into the narrow shape LandForge consumes.
 *
 * THE ASYMMETRY THAT DEFINES THIS FILE
 *
 * A cruise is enormous: plots, tally trees, species composition, diameter
 * distributions, sampling statistics, defect, product mix, GPS. LandForge's
 * scoring engine consumes a handful of scalars — acres, price, tGross,
 * timberCost, and a few stand descriptors.
 *
 * The temptation is to send everything. That is wrong for two reasons. It
 * couples LandForge to the shape of TimberForge's field data, so every schema
 * change ripples. And it invites LandForge to start deriving its own timber
 * numbers from raw tally, which would put two engines in the business of
 * computing volume and guarantee they eventually disagree.
 *
 * So: TimberForge computes. LandForge consumes conclusions. This file is the
 * narrowing, and it is deliberately the only place the narrowing happens.
 *
 * WHAT WE REFUSE TO DO HERE
 *
 * We do not invent a stumpage price. Not from a regional average, not from a
 * remembered figure, not from a plausible-sounding default. Price is the single
 * largest lever on `tGross`, and a fabricated one produces a confident dollar
 * figure with nothing behind it. `StumpagePricing` must be supplied by the
 * caller with its own provenance, or the payload carries volume and no value.
 * A LandForge record that says "we know the volume, we do not know the price"
 * is honest. One that quietly assumes $400/MBF is not.
 */

import {
  BF_PER_MBF,
  type CruiseResult,
  type Provenance,
  type StandResult,
} from '@timberforge/forestry-core';
import {
  assessInventoryTier,
  LADDER_REPLICA_VERSION,
  type TierAssessment,
} from './confidence.js';
import { detectSentinelCollisions, type SentinelCollision } from './assumptions.js';

/** Wire format version. Bump on any breaking change to TimberFeedPayload. */
export const TIMBER_FEED_VERSION = 'tf-feed-v1';

/**
 * Stumpage prices, supplied by the caller. Never defaulted.
 *
 * `provenance` and `source` are required, not optional, because a price with no
 * stated origin is the thing that turns a cruise report into a liability. If
 * the forester typed a number they got from a mill on the phone, that is a
 * perfectly good source — it just has to say so.
 */
export interface StumpagePricing {
  /** Dollars per MBF, by product class. Omit a product to exclude its value. */
  sawtimberPerMbf?: number;
  chipNSawPerTon?: number;
  pulpwoodPerTon?: number;
  veneerPerMbf?: number;
  polePerMbf?: number;
  provenance: Provenance;
  /** e.g. "TimberMart-South 2026Q2, Region 3", "Mill quote, 2026-08-14". */
  source: string;
  /** ISO-8601 date the prices were effective. */
  effectiveDate?: string;
}

/** Harvest cost assumptions. Also never defaulted. */
export interface HarvestCosts {
  /** Logging and hauling, dollars per ton delivered. */
  loggingPerTon?: number;
  /** Fixed mobilization cost for the job, dollars. */
  mobilizationCost?: number;
  /** Consulting forester commission, percent of gross. */
  commissionPct?: number;
  provenance: Provenance;
  source: string;
}

/** Parcel-level context that TimberForge does not measure. */
export interface ParcelContext {
  /** LandForge's parcel identifier. The join key. */
  landForgeParcelId: string;
  /** Haul distance to the governing mill, miles. */
  millDistanceMi?: number;
  standAgeYears?: number;
  siteIndex?: number;
  /** LandForge's current unified quality score, for impact forecasting. */
  uqs?: number;
  /** Provenance for the context values above, as a group. */
  provenance?: Provenance;
  source?: string;
}

/**
 * The payload TimberForge sends to LandForge.
 *
 * Every numeric field that could plausibly have been guessed is paired with a
 * provenance entry in `provenance`. This is the structural fix for the sentinel
 * problem: LandForge should read this map and stop inferring trust from value
 * inequality.
 */
export interface TimberFeedPayload {
  feedVersion: string;
  landForgeParcelId: string;
  cruiseId: string;

  acres: number;

  /** Standing volume. The field LandForge's ladder keys on. */
  mbfPerAcre: number | null;
  totalMbf: number | null;
  netGreenTonsPerAcre: number | null;
  totalNetGreenTons: number | null;
  basalAreaPerAcre: number | null;
  treesPerAcre: number | null;
  qmd: number | null;

  /** Gross timber value, dollars. LandForge's `tGross`. Null when unpriced. */
  tGross: number | null;
  /** Harvest cost, dollars. LandForge's `timberCost`. Null when uncosted. */
  timberCost: number | null;
  /** Net stumpage per acre, dollars. Drives the §7.4 ladder alongside volume. */
  netStumpagePerAcre: number | null;

  standAgeYears: number | null;
  siteIndex: number | null;
  millDistanceMi: number | null;

  /** Sampling evidence. This is what earns the high confidence tier. */
  sampling: {
    plotCount: number;
    /** Sampling error on net board feet per acre, percent, at `confidenceLevel`. */
    samplingErrorPct: number | null;
    confidenceLevel: number;
    method: string;
    logRule: string;
    regionProfile: string;
    volumeMethod: string;
  };

  /**
   * Explicit provenance per outbound field. Read this instead of comparing
   * values to defaults.
   */
  provenance: Record<string, Provenance>;

  /** Free-text source per outbound field, where one exists. */
  sources: Record<string, string>;

  /** Values that collide with a LandForge modeled default. Usually empty. */
  sentinelCollisions: SentinelCollision[];

  /** TimberForge's forecast of how LandForge will classify this. Advisory only. */
  predictedTier: TierAssessment;

  stamp: {
    calcEngine: string;
    ladderReplica: string;
    feedVersion: string;
    computedAt: string;
  };

  warnings: string[];
}

export interface ProjectionInput {
  cruise: CruiseResult;
  cruiseId: string;
  parcel: ParcelContext;
  pricing?: StumpagePricing;
  costs?: HarvestCosts;
  /**
   * Restrict the projection to specific stands. Omit to use the whole cruise.
   * Useful when a property has stands outside the LandForge parcel boundary.
   */
  standIds?: string[];
}

/**
 * Build the LandForge payload from a compiled cruise.
 *
 * Returns volume unconditionally and value only when pricing was supplied.
 * A payload with `tGross: null` is a valid, useful payload — it still lifts the
 * parcel's inventory confidence, because the ladder accepts MBF-per-acre on its
 * own.
 */
export function projectCruiseToLandForge(
  input: ProjectionInput
): TimberFeedPayload {
  const { cruise, cruiseId, parcel, pricing, costs } = input;
  const warnings: string[] = [];

  const stands: StandResult[] = input.standIds
    ? cruise.stands.filter((s) => input.standIds?.includes(s.standId))
    : cruise.stands;

  if (stands.length === 0) {
    warnings.push('No stands were selected for projection; the payload is empty.');
  }

  const acres = stands.reduce((s, r) => s + r.acres, 0);
  const totalNetBf = stands.reduce((s, r) => s + r.totalNetBoardFeet, 0);
  const totalTons = stands.reduce((s, r) => s + r.totalNetGreenTons, 0);

  const hasArea = acres > 0;
  if (!hasArea) {
    warnings.push(
      'Selected stands have no acreage, so per-acre values cannot be computed.'
    );
  }

  const mbfPerAcre = hasArea ? totalNetBf / BF_PER_MBF / acres : null;
  const tonsPerAcre = hasArea ? totalTons / acres : null;
  const baPerAcre = hasArea
    ? stands.reduce((s, r) => s + r.basalAreaPerAcre * r.acres, 0) / acres
    : null;
  const tpa = hasArea
    ? stands.reduce((s, r) => s + r.treesPerAcre * r.acres, 0) / acres
    : null;
  const qmd = hasArea
    ? stands.reduce((s, r) => s + r.qmd * r.acres, 0) / acres
    : null;

  // ------------------------------------------------------------ sampling
  const plotCount = stands.reduce((s, r) => s + r.plotCount, 0);
  // Sampling error is acre-weighted across stands. This is an approximation of
  // a properly pooled stratified error and is labelled as such; a true
  // stratified estimate needs the per-stratum variances combined, which belongs
  // in forestry-core once multi-stratum cruises are supported end to end.
  const errStands = stands.filter(
    (r) => r.plotCount >= 2 && r.statistics.netBoardFeetPerAcre.samplingErrorPct > 0
  );
  const weightedErr =
    hasArea && errStands.length > 0
      ? errStands.reduce(
          (s, r) => s + r.statistics.netBoardFeetPerAcre.samplingErrorPct * r.acres,
          0
        ) / errStands.reduce((s, r) => s + r.acres, 0)
      : null;
  if (stands.length > 1 && weightedErr !== null) {
    warnings.push(
      'Sampling error is acre-weighted across stands rather than pooled as a ' +
        'stratified estimate. Treat it as indicative for multi-stand parcels.'
    );
  }
  const confidenceLevel =
    stands[0]?.statistics.netBoardFeetPerAcre.confidenceLevel ?? 0.95;

  // -------------------------------------------------------------- valuation
  let tGross: number | null = null;
  let timberCost: number | null = null;

  if (pricing) {
    tGross = 0;
    // Board-foot products price per MBF; ton products price per ton. We only
    // value what we can attribute to a priced product, and we say so when a
    // product's volume exists but its price was not supplied.
    for (const stand of stands) {
      for (const row of stand.productMix) {
        const standMbf = (row.netBoardFeetPerAcre * stand.acres) / BF_PER_MBF;
        const standTons = row.netGreenTonsPerAcre * stand.acres;
        switch (row.product) {
          case 'sawtimber':
            if (pricing.sawtimberPerMbf !== undefined)
              tGross += standMbf * pricing.sawtimberPerMbf;
            else warnings.push('Sawtimber volume is present but no sawtimber price was supplied.');
            break;
          case 'veneer':
            if (pricing.veneerPerMbf !== undefined)
              tGross += standMbf * pricing.veneerPerMbf;
            else warnings.push('Veneer volume is present but no veneer price was supplied.');
            break;
          case 'pole':
            if (pricing.polePerMbf !== undefined)
              tGross += standMbf * pricing.polePerMbf;
            else warnings.push('Pole volume is present but no pole price was supplied.');
            break;
          case 'chip_n_saw':
            if (pricing.chipNSawPerTon !== undefined)
              tGross += standTons * pricing.chipNSawPerTon;
            else warnings.push('Chip-n-saw volume is present but no chip-n-saw price was supplied.');
            break;
          case 'pulpwood':
            if (pricing.pulpwoodPerTon !== undefined)
              tGross += standTons * pricing.pulpwoodPerTon;
            else warnings.push('Pulpwood volume is present but no pulpwood price was supplied.');
            break;
          case 'cull':
            break;
          case 'unassigned':
            warnings.push(
              'Some volume is not assigned to a product class and could not be valued. ' +
                'Assign products in the field or in review, or the gross value is understated.'
            );
            break;
        }
      }
    }
  } else {
    warnings.push(
      'No stumpage pricing was supplied, so no timber value was computed. ' +
        'Volume alone still raises inventory confidence in LandForge.'
    );
  }

  if (costs) {
    timberCost = 0;
    if (costs.loggingPerTon !== undefined) timberCost += totalTons * costs.loggingPerTon;
    if (costs.mobilizationCost !== undefined) timberCost += costs.mobilizationCost;
    if (costs.commissionPct !== undefined && tGross !== null) {
      timberCost += tGross * (costs.commissionPct / 100);
    } else if (costs.commissionPct !== undefined && tGross === null) {
      warnings.push(
        'A commission percentage was supplied but there is no gross value to apply it to.'
      );
    }
  }

  const netStumpagePerAcre =
    tGross !== null && hasArea ? (tGross - (timberCost ?? 0)) / acres : null;

  // ------------------------------------------------------------- provenance
  const provenance: Record<string, Provenance> = {
    mbfPerAcre: 'measured',
    totalMbf: 'computed',
    netGreenTonsPerAcre: 'computed',
    basalAreaPerAcre: 'measured',
    treesPerAcre: 'measured',
    qmd: 'computed',
  };
  const sources: Record<string, string> = {
    mbfPerAcre: `TimberForge cruise ${cruiseId}, ${cruise.stamp.calcEngine}`,
    basalAreaPerAcre: `TimberForge cruise ${cruiseId}`,
    treesPerAcre: `TimberForge cruise ${cruiseId}`,
  };

  if (tGross !== null && pricing) {
    // Value is never better than its price. A measured volume multiplied by an
    // estimated price yields an estimated value, and saying otherwise would
    // launder the weakest input into the strongest claim.
    provenance.tGross = weakerOf('computed', pricing.provenance);
    sources.tGross = pricing.source;
    provenance.netStumpagePerAcre = provenance.tGross;
    sources.netStumpagePerAcre = pricing.source;
  }
  if (timberCost !== null && costs) {
    provenance.timberCost = weakerOf('computed', costs.provenance);
    sources.timberCost = costs.source;
  }
  if (parcel.standAgeYears !== undefined) {
    provenance.standAgeYears = parcel.provenance ?? 'estimated';
    if (parcel.source) sources.standAgeYears = parcel.source;
  }
  if (parcel.siteIndex !== undefined) {
    provenance.siteIndex = parcel.provenance ?? 'estimated';
    if (parcel.source) sources.siteIndex = parcel.source;
  }
  if (parcel.millDistanceMi !== undefined) {
    provenance.millDistanceMi = parcel.provenance ?? 'estimated';
    if (parcel.source) sources.millDistanceMi = parcel.source;
  }

  // -------------------------------------------------------------- sentinels
  const sentinelCollisions = detectSentinelCollisions({
    mbfPerAcre: mbfPerAcre ?? undefined,
    standAgeYears: parcel.standAgeYears,
    millDistanceMi: parcel.millDistanceMi,
    siteIndex: parcel.siteIndex,
  });
  for (const c of sentinelCollisions) {
    warnings.push(c.message);
  }

  const predictedTier = assessInventoryTier({
    mbfPerAcre: mbfPerAcre ?? undefined,
    netStumpagePerAcre: netStumpagePerAcre ?? undefined,
    standAgeYears: parcel.standAgeYears,
    siteIndex: parcel.siteIndex,
    millDistanceMi: parcel.millDistanceMi,
    provenance: 'measured',
    samplingErrorPct: weightedErr ?? undefined,
    plotCount,
  });

  for (const stand of stands) {
    for (const w of stand.warnings) warnings.push(`${stand.standName}: ${w}`);
  }

  return {
    feedVersion: TIMBER_FEED_VERSION,
    landForgeParcelId: parcel.landForgeParcelId,
    cruiseId,
    acres,
    mbfPerAcre,
    totalMbf: totalNetBf / BF_PER_MBF,
    netGreenTonsPerAcre: tonsPerAcre,
    totalNetGreenTons: totalTons,
    basalAreaPerAcre: baPerAcre,
    treesPerAcre: tpa,
    qmd,
    tGross,
    timberCost,
    netStumpagePerAcre,
    standAgeYears: parcel.standAgeYears ?? null,
    siteIndex: parcel.siteIndex ?? null,
    millDistanceMi: parcel.millDistanceMi ?? null,
    sampling: {
      plotCount,
      samplingErrorPct: weightedErr,
      confidenceLevel,
      method: describeMethods(stands),
      logRule: cruise.stamp.logRule,
      regionProfile: cruise.stamp.regionProfile,
      volumeMethod: cruise.stamp.volumeMethod,
    },
    provenance,
    sources,
    sentinelCollisions,
    predictedTier,
    stamp: {
      calcEngine: cruise.stamp.calcEngine,
      ladderReplica: LADDER_REPLICA_VERSION,
      feedVersion: TIMBER_FEED_VERSION,
      computedAt: new Date().toISOString(),
    },
    warnings,
  };
}

/**
 * The weaker of two provenance values.
 *
 * Ordering runs from strongest evidence to weakest. Combining inputs can only
 * ever produce a claim as strong as its weakest link.
 */
const PROVENANCE_STRENGTH: Record<Provenance, number> = {
  measured: 5,
  computed: 4,
  estimated: 3,
  predicted: 2,
  defaulted: 1,
};

export function weakerOf(a: Provenance, b: Provenance): Provenance {
  return PROVENANCE_STRENGTH[a] <= PROVENANCE_STRENGTH[b] ? a : b;
}

function describeMethods(stands: StandResult[]): string {
  if (stands.length === 0) return 'none';
  const total = stands.reduce((s, r) => s + r.plotCount, 0);
  return `${stands.length} stand(s), ${total} plot(s)`;
}
