/**
 * Region profiles.
 *
 * Shayne chose "multi-region from the start", so region is DATA, not code. Every
 * regionally-variable decision — which log rule the market pays on, which
 * species exist, merchantable top diameters, form class — lives in one of these
 * objects. Supporting a new region means adding a profile, not editing the
 * engine.
 *
 * These starter profiles are deliberately small and honest. Green weight and
 * form class values are conventional working figures suitable for a prototype;
 * they should be replaced with locally-calibrated values before a paid cruise
 * is delivered from them, and the region profile carries a `calibration` note
 * so the report can say so.
 */

import type { RegionProfile, SpeciesConfig } from './types.js';

const sp = (
  code: string,
  commonName: string,
  group: 'softwood' | 'hardwood',
  formClass: number,
  greenLbPerCuFt: number
): SpeciesConfig => ({ code, commonName, group, formClass, greenLbPerCuFt });

/**
 * US South / Southeast. Doyle country. Tons are the working unit for pulpwood
 * and increasingly for sawtimber; MBF Doyle still governs many sawtimber sales.
 */
export const usSouth: RegionProfile = {
  id: 'us_south',
  name: 'US South / Southeast',
  logRule: 'doyle',
  sawtimberMinDbh: 10,
  pulpwoodMinDbh: 5,
  stumpHeightFt: 0.5,
  sawTopDib: 8,
  pulpTopDib: 3,
  species: [
    sp('LP', 'Loblolly pine', 'softwood', 78, 58),
    sp('SP', 'Shortleaf pine', 'softwood', 78, 57),
    sp('SLP', 'Slash pine', 'softwood', 78, 60),
    sp('LLP', 'Longleaf pine', 'softwood', 80, 61),
    sp('VP', 'Virginia pine', 'softwood', 76, 55),
    sp('WO', 'White oak', 'hardwood', 74, 66),
    sp('RO', 'Red oak', 'hardwood', 74, 64),
    sp('YP', 'Yellow-poplar', 'hardwood', 76, 45),
    sp('SG', 'Sweetgum', 'hardwood', 74, 55),
    sp('HI', 'Hickory', 'hardwood', 72, 68),
    sp('RM', 'Red maple', 'hardwood', 74, 50),
  ],
};

/** Pacific Northwest. Scribner Decimal C, MBF pricing, big conifers. */
export const pacificNorthwest: RegionProfile = {
  id: 'pacific_northwest',
  name: 'Pacific Northwest',
  logRule: 'scribner',
  sawtimberMinDbh: 8,
  pulpwoodMinDbh: 5,
  stumpHeightFt: 1,
  sawTopDib: 6,
  pulpTopDib: 4,
  species: [
    sp('DF', 'Douglas-fir', 'softwood', 80, 38),
    sp('WH', 'Western hemlock', 'softwood', 78, 41),
    sp('WRC', 'Western redcedar', 'softwood', 78, 27),
    sp('SS', 'Sitka spruce', 'softwood', 78, 33),
    sp('PP', 'Ponderosa pine', 'softwood', 78, 45),
    sp('RA', 'Red alder', 'hardwood', 74, 46),
  ],
};

/** Lake States / Northeast. International 1/4-inch, cords common. */
export const lakeStatesNortheast: RegionProfile = {
  id: 'lake_states_northeast',
  name: 'Lake States / Northeast',
  logRule: 'international_quarter',
  sawtimberMinDbh: 10,
  pulpwoodMinDbh: 4,
  stumpHeightFt: 1,
  sawTopDib: 8,
  pulpTopDib: 4,
  species: [
    sp('SM', 'Sugar maple', 'hardwood', 76, 56),
    sp('RM', 'Red maple', 'hardwood', 74, 50),
    sp('YB', 'Yellow birch', 'hardwood', 74, 57),
    sp('AB', 'American beech', 'hardwood', 72, 54),
    sp('RO', 'Northern red oak', 'hardwood', 75, 62),
    sp('WA', 'White ash', 'hardwood', 76, 52),
    sp('AS', 'Quaking aspen', 'hardwood', 74, 43),
    sp('RP', 'Red pine', 'softwood', 78, 45),
    sp('WP', 'Eastern white pine', 'softwood', 78, 36),
    sp('EH', 'Eastern hemlock', 'softwood', 76, 50),
  ],
};

export const REGIONS: Record<string, RegionProfile> = {
  us_south: usSouth,
  pacific_northwest: pacificNorthwest,
  lake_states_northeast: lakeStatesNortheast,
};

export function getRegion(id: string): RegionProfile {
  const region = REGIONS[id];
  if (!region) {
    throw new Error(
      `Unknown region "${id}". Available: ${Object.keys(REGIONS).join(', ')}`
    );
  }
  return region;
}

export function findSpecies(
  region: RegionProfile,
  code: string
): SpeciesConfig | undefined {
  return region.species.find((s) => s.code === code);
}
