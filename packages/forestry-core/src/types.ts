/**
 * Core domain types.
 *
 * Design rule that runs through this whole package: a value never travels
 * without its provenance. `Provenance` is attached to anything that could
 * plausibly have been measured, estimated, or defaulted, because the entire
 * TimberForge premise — predicted vs. actual, and feeding trustworthy ground
 * truth to LandForge — collapses if you cannot tell those apart later.
 */

/** How a value came to exist. Never infer this; always carry it. */
export type Provenance =
  /** Measured in the field by a cruiser with an instrument. Ground truth. */
  | 'measured'
  /** Typed by a human who was not measuring (e.g. ocular height estimate). */
  | 'estimated'
  /** Produced by a TimberForge model from remote data, pre-cruise. */
  | 'predicted'
  /** Derived arithmetically from other values (e.g. QMD from BA and TPA). */
  | 'computed'
  /** Filled from a configured default because nothing better existed. */
  | 'defaulted';

/** A number that knows where it came from. */
export interface Sourced<T = number> {
  value: T;
  provenance: Provenance;
  /** Free-text source note, e.g. "Haglof DP II", "SSURGO", "crew default". */
  source?: string;
  /** ISO-8601. When the value was established. */
  observedAt?: string;
  /** 0-100 self-reported confidence, where the source can express one. */
  confidence?: number;
}

/** Cruise methodologies supported at MVP. */
export type CruiseMethod = 'variable_radius' | 'fixed_area';

/** Board-foot log rules. Regionally selected, never globally assumed. */
export type LogRuleName = 'doyle' | 'scribner' | 'international_quarter';

/** Merchantable product classes. Configurable per region; these are the defaults. */
export type ProductClass =
  | 'sawtimber'
  | 'chip_n_saw'
  | 'pulpwood'
  | 'veneer'
  | 'pole'
  | 'cull';

/** A single tallied tree. */
export interface TreeRecord {
  id: string;
  /** Plot this tree was tallied on. */
  plotId: string;
  /** Species code, from the cruise's configured species list. */
  species: string;
  /** Diameter at breast height, inches. */
  dbh: number;
  /** Total height, feet. Optional — many cruises measure a height subsample. */
  totalHeightFt?: number;
  /** Merchantable height. Either feet or 16-ft logs; see merchHeightUnit. */
  merchHeight?: number;
  merchHeightUnit?: 'feet' | 'logs';
  product?: ProductClass;
  /** Cull/defect deduction as a percent of gross volume, 0-100. */
  defectPct?: number;
  /**
   * Number of trees this record represents at the point. Normally 1. Used when
   * a cruiser tallies "3 in" for identical trees to save time in the field.
   */
  count?: number;
  /** Girard form class override for this tree, if individually measured. */
  formClass?: number;
  provenance?: Provenance;
  notes?: string;
}

/** A plot or point. */
export interface PlotRecord {
  id: string;
  standId: string;
  /** Sequence number shown to the cruiser. */
  number: number;
  method: CruiseMethod;
  /** Basal area factor. Required when method is variable_radius. */
  baf?: number;
  /** Plot size in acres. Required when method is fixed_area. */
  plotAcres?: number;
  latitude?: number;
  longitude?: number;
  /**
   * A plot that was visited and legitimately held no tally trees. This is a
   * real observation of zero, NOT missing data, and it must be included in the
   * statistics or the stand is systematically overestimated.
   */
  isEmpty?: boolean;
  /** Plot was not visited (access denied, hazard). Excluded from statistics. */
  isSkipped?: boolean;
  measuredAt?: string;
}

/** A stand / stratum being cruised. */
export interface StandRecord {
  id: string;
  name: string;
  acres: number;
  /** Optional pre-cruise predicted attributes, kept for predicted-vs-actual. */
  predicted?: {
    volumeMbfPerAcre?: Sourced;
    standAgeYears?: Sourced;
    siteIndex?: Sourced;
    speciesMix?: Record<string, number>;
  };
}

/** Species-level configuration used by volume and weight calculations. */
export interface SpeciesConfig {
  code: string;
  commonName: string;
  /** 'softwood' | 'hardwood' — drives default form class and product rules. */
  group: 'softwood' | 'hardwood';
  /**
   * Girard form class: DIB at the top of the first 16-ft log as a percent of
   * DBH. 78 is the classic default for southern pine; hardwoods run lower.
   */
  formClass: number;
  /** Green weight, pounds per cubic foot, for tons conversion. */
  greenLbPerCuFt: number;
}

/** A region profile bundles every regionally-variable decision in one object. */
export interface RegionProfile {
  id: string;
  name: string;
  /** Default board-foot rule for this region. */
  logRule: LogRuleName;
  /** Species library for this region. */
  species: SpeciesConfig[];
  /** Minimum DBH to be counted as merchantable sawtimber, inches. */
  sawtimberMinDbh: number;
  /** Minimum DBH to be counted as pulpwood, inches. */
  pulpwoodMinDbh: number;
  /** Stump height, feet, used in cubic volume. */
  stumpHeightFt: number;
  /** Merchantable top diameter inside bark for sawtimber, inches. */
  sawTopDib: number;
  /** Merchantable top diameter inside bark for pulpwood, inches. */
  pulpTopDib: number;
}
