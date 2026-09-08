/**
 * Generates supabase/migrations/0002_seed_regions.sql from the region profiles
 * in @timberforge/forestry-core.
 *
 * WHY THIS IS GENERATED RATHER THAN HAND-WRITTEN
 *
 * The region profile has to exist in two places. The calculation engine needs it
 * in the browser with no network, and the database needs it to serve the picker
 * and to keep a cruise's region resolvable years later. Two hand-maintained
 * copies of the same forty numbers will diverge — not on the day they are
 * written, but on the day somebody corrects a green weight in one of them.
 *
 * That divergence is silent and expensive. The field app would compute tons with
 * one figure and a server-side report with another, and the two documents would
 * disagree by a few percent with no error raised anywhere. A cruiser would find
 * it by being asked why the totals moved.
 *
 * So regions.ts is the single source of truth and the SQL is a build artifact.
 * `region-seed.test.ts` regenerates the file in memory and fails if the
 * checked-in copy differs, which converts "somebody forgot to re-run the
 * generator" from a client-discovered discrepancy into a red test.
 *
 *   npm run gen:regions          # write the file
 *   npm run check:regions        # exit 1 if stale
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REGIONS } from '../packages/forestry-core/src/regions.js';
import type { RegionProfile } from '../packages/forestry-core/src/types.js';

export const SEED_PATH = fileURLToPath(
  new URL('../supabase/migrations/0002_seed_regions.sql', import.meta.url)
);

/** Single-quote escaping for SQL string literals. */
const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/** Regions in a stable order, so the generated file does not churn. */
export function orderedRegions(): RegionProfile[] {
  return Object.keys(REGIONS)
    .sort()
    .map((k) => REGIONS[k]!);
}

export function buildSeedSql(regions: RegionProfile[]): string {
  const lines: string[] = [];
  const p = (s = ''): void => {
    lines.push(s);
  };

  p('-- =============================================================================');
  p('-- 0002  Built-in region profiles');
  p('-- =============================================================================');
  p('--');
  p('-- GENERATED FILE. DO NOT EDIT BY HAND.');
  p('--   source:    packages/forestry-core/src/regions.ts');
  p('--   generator: scripts/genRegionSeed.ts  (npm run gen:regions)');
  p('--   guard:     scripts/regionSeed.test.ts');
  p('--');
  p('-- Edit regions.ts and regenerate. The guard test fails until you do, which');
  p('-- is the point: the engine and the database must never hold two different');
  p('-- opinions about how much a cubic foot of loblolly weighs.');
  p('--');
  p('-- Idempotent. Safe to re-run. Upserts by key and leaves user-created region');
  p('-- profiles (is_builtin = false) entirely alone.');
  p('--');
  p('-- CALIBRATION. The form class and green weight figures below are conventional');
  p('-- working values — adequate for a prototype and for relative comparison, but');
  p('-- not locally calibrated. A cruise delivered to a paying client should use');
  p('-- values fitted to local mill scale, and the report should state which set it');
  p('-- used. Green weight in particular enters the tons conversion linearly, so a');
  p('-- 10% error here is a 10% error in every pulpwood valuation downstream.');
  p('-- =============================================================================');
  p();

  for (const region of regions) {
    const bar = '-'.repeat(Math.max(3, 70 - region.name.length));
    p(`-- ${region.name} ${bar}`);
    p('insert into timberforge.region_profile (');
    p('  id, name, log_rule, sawtimber_min_dbh, pulpwood_min_dbh,');
    p('  stump_height_ft, saw_top_dib, pulp_top_dib, is_builtin, owner_id');
    p(') values (');
    p(
      `  ${q(region.id)}, ${q(region.name)}, ${q(region.logRule)}, ` +
        `${region.sawtimberMinDbh}, ${region.pulpwoodMinDbh},`
    );
    p(
      `  ${region.stumpHeightFt}, ${region.sawTopDib}, ${region.pulpTopDib}, true, null`
    );
    p(')');
    p('on conflict (id) do update set');
    p('  name              = excluded.name,');
    p('  log_rule          = excluded.log_rule,');
    p('  sawtimber_min_dbh = excluded.sawtimber_min_dbh,');
    p('  pulpwood_min_dbh  = excluded.pulpwood_min_dbh,');
    p('  stump_height_ft   = excluded.stump_height_ft,');
    p('  saw_top_dib       = excluded.saw_top_dib,');
    p('  pulp_top_dib      = excluded.pulp_top_dib,');
    p('  updated_at        = now();');
    p();

    p('insert into timberforge.species');
    p('  (region_id, code, common_name, species_group, form_class, green_lb_per_cuft)');
    p('values');
    p(
      region.species
        .map(
          (s) =>
            `  (${q(region.id)}, ${q(s.code)}, ${q(s.commonName)}, ` +
            `${q(s.group)}, ${s.formClass}, ${s.greenLbPerCuFt})`
        )
        .join(',\n')
    );
    p('on conflict (region_id, code) do update set');
    p('  common_name       = excluded.common_name,');
    p('  species_group     = excluded.species_group,');
    p('  form_class        = excluded.form_class,');
    p('  green_lb_per_cuft = excluded.green_lb_per_cuft,');
    p('  updated_at        = now();');
    p();
  }

  p('-- A species dropped from regions.ts is deliberately NOT deleted here. Any');
  p('-- code that has ever been tallied must stay resolvable or an old cruise stops');
  p('-- compiling — and a cruise that compiled once must compile identically');
  p('-- forever. Retiring a species is a separate, deliberate migration that has to');
  p('-- reckon with the existing tally rows.');
  p();

  return lines.join('\n');
}

/** True when the checked-in file matches what the source would generate now. */
export function seedIsCurrent(): { current: boolean; reason?: string } {
  const expected = buildSeedSql(orderedRegions());
  let actual: string;
  try {
    actual = readFileSync(SEED_PATH, 'utf8');
  } catch {
    return { current: false, reason: '0002_seed_regions.sql does not exist' };
  }
  if (actual !== expected) {
    return {
      current: false,
      reason: '0002_seed_regions.sql is stale relative to regions.ts',
    };
  }
  return { current: true };
}

/** Writes the seed file. Called only by the CLI in writeRegionSeed.ts. */
export function writeSeed(): string {
  writeFileSync(SEED_PATH, buildSeedSql(orderedRegions()));
  return SEED_PATH;
}

// This module is deliberately side-effect free so that the guard test can
// import it without writing anything. The CLI lives in writeRegionSeed.ts.
// (Detecting "was I run directly?" is not reliable here: under vite-node,
// process.argv[1] is the vite-node binary and the script path is absent.)
