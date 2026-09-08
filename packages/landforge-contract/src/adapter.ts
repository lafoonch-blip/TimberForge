/**
 * THE SEAM.
 *
 * ============================================================================
 * THIS IS THE ONLY FILE THAT SHOULD CHANGE WHEN LANDFORGE'S REAL SHAPE IS KNOWN
 * ============================================================================
 *
 * Everything else in this package works in TimberForge's own vocabulary:
 * `mbfPerAcre`, `netStumpagePerAcre`, `millDistanceMi`. This file — and only
 * this file — knows what LandForge actually calls those things in its Postgres
 * columns and in the object its scoring engine receives.
 *
 * The mappings below were derived from the LandForge Scoring Engine Manual
 * (§13.1 engine fields: acres, price, compPpa/ppa, tGross, timberCost,
 * devUpside, devCost) and from the LandForge PRDs. They have NOT been verified
 * against the running application, because index.html was not available when
 * this was written.
 *
 * Every entry marked UNVERIFIED is a guess with a rationale, not a fact.
 * Verification procedure is at the bottom of this file.
 *
 * Why isolate it this way: the cost of being wrong about a column name should
 * be one edit in one file, not a migration plus a refactor plus a redeploy. The
 * calculation engine and the confidence replica are correct regardless of what
 * LandForge names its columns, and they should not have to be revisited when we
 * find out.
 */

import type { TimberFeedPayload } from './projection.js';

/** Set to true once every mapping below has been checked against LandForge. */
export const ADAPTER_VERIFIED = false;

export const ADAPTER_VERSION = 'tf-lf-adapter-v0-unverified';

export type MappingStatus = 'verified' | 'unverified' | 'absent';

export interface FieldMapping {
  /** TimberForge's name for the value. */
  timberForgeField: string;
  /** What we believe LandForge calls it. */
  landForgeField: string;
  status: MappingStatus;
  /** Why we think this is the right target, or what is uncertain about it. */
  note: string;
}

/**
 * Fields LandForge's scoring engine is documented to consume, per §13.1.
 * These names come straight from the manual, so they are the closest thing to
 * verified that we have without reading the source.
 */
export const ENGINE_FIELD_MAPPINGS: FieldMapping[] = [
  {
    timberForgeField: 'acres',
    landForgeField: 'acres',
    status: 'verified',
    note: 'Named in the scoring manual §13.1 engine field list.',
  },
  {
    timberForgeField: 'tGross',
    landForgeField: 'tGross',
    status: 'verified',
    note: 'Named in §13.1. Gross timber value in dollars for the parcel.',
  },
  {
    timberForgeField: 'timberCost',
    landForgeField: 'timberCost',
    status: 'verified',
    note: 'Named in §13.1. Harvest and haul cost in dollars.',
  },
  {
    timberForgeField: 'mbfPerAcre',
    landForgeField: 'mbfPerAcre',
    status: 'unverified',
    note:
      'The §7.4 ladder refers to "MBF-per-acre" in prose and LF_ASSUMPTIONS ' +
      'uses defaultMbfPerAcre, so the runtime key is very likely mbfPerAcre. ' +
      'The Postgres column may be snake_case (mbf_per_acre). Check both.',
  },
  {
    timberForgeField: 'netStumpagePerAcre',
    landForgeField: 'netStumpage',
    status: 'unverified',
    note:
      'The ladder says "net stumpage" without stating per-acre or total. This ' +
      'is the single highest-risk mapping in the file: if LandForge expects a ' +
      'total and receives a per-acre figure, the value is wrong by the acreage ' +
      'factor and will still look plausible. VERIFY BEFORE SENDING VALUE DATA.',
  },
  {
    timberForgeField: 'standAgeYears',
    landForgeField: 'standAge',
    status: 'unverified',
    note: 'Inferred from LF_ASSUMPTIONS.defaultStandAge.',
  },
  {
    timberForgeField: 'siteIndex',
    landForgeField: 'siteIndex',
    status: 'unverified',
    note: 'Inferred from LF_ASSUMPTIONS.defaultSiteIndex.',
  },
  {
    timberForgeField: 'millDistanceMi',
    landForgeField: 'millDistance',
    status: 'unverified',
    note:
      'Inferred from LF_ASSUMPTIONS.defaultMillDistanceMi and from millScore ' +
      'taking a mileage. Units are miles in both systems.',
  },
];

/** Fields TimberForge produces that LandForge has no home for yet. */
export const UNMAPPED_FIELDS: FieldMapping[] = [
  {
    timberForgeField: 'sampling.samplingErrorPct',
    landForgeField: '(none)',
    status: 'absent',
    note:
      'LandForge has no field for sampling error today. This is the field that ' +
      'justifies a high inventory-confidence tier, so adding it is the main ' +
      'schema request TimberForge should make of LandForge.',
  },
  {
    timberForgeField: 'provenance',
    landForgeField: '(none)',
    status: 'absent',
    note:
      'The structural fix for the sentinel-collision bug. LandForge currently ' +
      'infers provenance from value inequality; it should read this instead.',
  },
  {
    timberForgeField: 'basalAreaPerAcre / treesPerAcre / qmd',
    landForgeField: '(none)',
    status: 'absent',
    note:
      'Stand structure has no consumer in the scoring engine. Worth storing on ' +
      'the bridge table anyway — it is what will train a better timber model.',
  },
];

/**
 * The object LandForge's scoring engine expects.
 *
 * Deliberately loose: an index signature, because we do not yet know the exact
 * key set and a too-tight type here would force casts everywhere else.
 */
export interface LandForgeTimberInput {
  acres: number;
  tGross?: number;
  timberCost?: number;
  [key: string]: unknown;
}

export interface AdaptResult {
  /** The object to hand to LandForge. */
  payload: LandForgeTimberInput;
  /** Mappings used that are not yet verified. Surface these in the UI. */
  unverified: FieldMapping[];
  /** Values omitted because LandForge has nowhere to put them. */
  dropped: string[];
  warnings: string[];
}

/**
 * Translate a TimberForge feed payload into LandForge's engine input.
 *
 * Null values are OMITTED rather than sent as null. That is intentional: in
 * LandForge, an absent timber value means "fall back to the modeled default,"
 * which is the correct behaviour when we genuinely do not know. Sending an
 * explicit null risks being coerced to zero somewhere downstream, and a zero
 * timber value is a very different claim from an unknown one — it would read as
 * "we cruised this and it is worthless."
 */
export function toLandForgeInput(feed: TimberFeedPayload): AdaptResult {
  const warnings: string[] = [];
  const dropped: string[] = [];
  const payload: LandForgeTimberInput = { acres: feed.acres };

  if (!ADAPTER_VERIFIED) {
    warnings.push(
      'The LandForge field mapping has not been verified against the live ' +
        'application. Do not write to production LandForge records until ' +
        'ADAPTER_VERIFIED is true.'
    );
  }

  const put = (lfField: string, value: number | null, tfField: string) => {
    if (value === null || !Number.isFinite(value)) {
      dropped.push(tfField);
      return;
    }
    payload[lfField] = value;
  };

  put('tGross', feed.tGross, 'tGross');
  put('timberCost', feed.timberCost, 'timberCost');
  put('mbfPerAcre', feed.mbfPerAcre, 'mbfPerAcre');
  put('netStumpage', feed.netStumpagePerAcre, 'netStumpagePerAcre');
  put('standAge', feed.standAgeYears, 'standAgeYears');
  put('siteIndex', feed.siteIndex, 'siteIndex');
  put('millDistance', feed.millDistanceMi, 'millDistanceMi');

  // Sent even though LandForge ignores it today. It costs nothing, it is the
  // fix we are asking for, and the day LandForge starts reading it, every
  // record TimberForge has already written becomes correct retroactively.
  payload.timberProvenance = feed.provenance;
  payload.timberSources = feed.sources;
  payload.timberSamplingErrorPct = feed.sampling.samplingErrorPct;
  payload.timberPlotCount = feed.sampling.plotCount;
  payload.timberFeedVersion = feed.feedVersion;
  payload.timberCalcEngine = feed.stamp.calcEngine;
  payload.timberCruiseId = feed.cruiseId;

  if (feed.sentinelCollisions.length > 0) {
    warnings.push(
      `${feed.sentinelCollisions.length} measured value(s) collide with LandForge ` +
        'modeled defaults and will be misread as modeled data.'
    );
  }

  if (feed.netStumpagePerAcre !== null) {
    warnings.push(
      'netStumpagePerAcre is mapped to LandForge\u2019s "netStumpage" on the ' +
        'assumption that it is a per-acre figure. This is unverified and an ' +
        'error here scales with acreage. Confirm before relying on the value.'
    );
  }

  return {
    payload,
    unverified: ENGINE_FIELD_MAPPINGS.filter((m) => m.status === 'unverified'),
    dropped,
    warnings,
  };
}

/**
 * VERIFICATION PROCEDURE
 *
 * When LandForge's index.html (or its Supabase schema) is available:
 *
 *  1. Find `LF_ASSUMPTIONS`. Confirm all four sentinel values in
 *     assumptions.ts still match. If any differ, the collision guard has been
 *     silently inert — fix it and re-check any parcels already fed.
 *
 *  2. Find the metrics function (the one producing tGross / timberCost /
 *     devUpside). Read the property names it destructures off its input. Those
 *     are the authoritative keys for ENGINE_FIELD_MAPPINGS.
 *
 *  3. Resolve the netStumpage question specifically: is it per acre or a total?
 *     Grep for the identifier and look at whether it is ever multiplied or
 *     divided by acres. Fix the mapping and set its status to 'verified'.
 *
 *  4. Find the §7.4 ladder implementation. Compare it to confidence.ts. The
 *     tier point values in TIER_CONFIDENCE are working figures; replace them
 *     with the literals. Then re-run the contract tests — several assert on
 *     behaviour around the timberConf < 55 reserve threshold.
 *
 *  5. Check `land_parcels` for existing timber columns. Anything already there
 *     should be reused rather than duplicated in the timberforge schema.
 *
 *  6. Set ADAPTER_VERIFIED = true and bump ADAPTER_VERSION.
 */
