/**
 * Guards on the generated region seed migration.
 *
 * Two jobs here, and the second is the more interesting one.
 *
 * 1. DRIFT. `0002_seed_regions.sql` is generated from `regions.ts`. If somebody
 *    edits regions.ts and forgets to regenerate, the database and the browser
 *    engine end up holding different numbers, and nothing anywhere raises an
 *    error — the two just quietly disagree. This test turns that into a red
 *    build.
 *
 * 2. CONSTRAINT AGREEMENT. The CHECK constraints in `0001_timberforge_schema.sql`
 *    encode what a physically sensible region profile looks like. A new profile
 *    added to regions.ts that violates one of them would generate SQL that only
 *    fails when the migration is applied — that is, on deploy, in front of a
 *    real database, possibly the live LandForge project. Asserting the bounds
 *    here moves that failure to the laptop.
 *
 *    The bounds below are transcribed from 0001. That transcription is itself a
 *    duplication, and if the SQL constraints are ever loosened or tightened this
 *    file has to follow. It earns its keep anyway: the alternative is finding
 *    out during `supabase db push`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { REGIONS, getRegion } from '../packages/forestry-core/src/regions.js';
import { buildSeedSql, orderedRegions, seedIsCurrent, SEED_PATH } from './genRegionSeed.js';

describe('region seed migration', () => {
  it('is in step with regions.ts', () => {
    const { current, reason } = seedIsCurrent();
    expect(current, `${reason ?? ''} — run: npm run gen:regions`).toBe(true);
  });

  it('is deterministic across runs', () => {
    // A generator whose output depends on object key order or on a timestamp
    // would produce a spurious diff on every run and train everyone to ignore
    // the drift test.
    expect(buildSeedSql(orderedRegions())).toBe(buildSeedSql(orderedRegions()));
  });

  it('emits every configured region and species', () => {
    const sql = readFileSync(SEED_PATH, 'utf8');
    for (const region of Object.values(REGIONS)) {
      expect(sql).toContain(`'${region.id}'`);
      for (const s of region.species) {
        expect(sql).toContain(`'${s.commonName}'`);
      }
    }
  });

  it('escapes single quotes rather than emitting broken SQL', () => {
    const sql = buildSeedSql([
      {
        ...getRegion('us_south'),
        id: 'quote_test',
        name: "O'Brien's Region",
        species: [
          {
            code: 'XX',
            commonName: "Bill's oak",
            group: 'hardwood',
            formClass: 74,
            greenLbPerCuFt: 60,
          },
        ],
      },
    ]);
    expect(sql).toContain("'O''Brien''s Region'");
    expect(sql).toContain("'Bill''s oak'");
  });

  it('marks built-in profiles as such and leaves them unowned', () => {
    // The schema's region_ownership_coherent CHECK requires is_builtin profiles
    // to have a null owner. Generating owner_id for one would fail on apply.
    const sql = readFileSync(SEED_PATH, 'utf8');
    const valueRows = sql.match(/true, null\n\)/g) ?? [];
    expect(valueRows.length).toBe(Object.keys(REGIONS).length);
  });

  it('upserts rather than inserting, so re-running is safe', () => {
    const sql = readFileSync(SEED_PATH, 'utf8');
    const inserts = (sql.match(/^insert into/gm) ?? []).length;
    const conflicts = (sql.match(/^on conflict/gm) ?? []).length;
    expect(inserts).toBeGreaterThan(0);
    expect(conflicts).toBe(inserts);
  });

  it('never deletes species', () => {
    // A tallied species code must stay resolvable forever or an old cruise
    // stops compiling. Nothing in a seed file should remove one.
    const sql = readFileSync(SEED_PATH, 'utf8');
    expect(sql).not.toMatch(/^\s*delete\s+from/im);
    expect(sql).not.toMatch(/^\s*drop\s+/im);
    expect(sql).not.toMatch(/^\s*truncate\s+/im);
  });
});

describe('region profiles satisfy the 0001 CHECK constraints', () => {
  const regions = orderedRegions();

  it.each(regions.map((r) => [r.id, r] as const))(
    '%s has physically sensible merchantability limits',
    (_id, region) => {
      expect(region.sawtimberMinDbh).toBeGreaterThan(0);
      expect(region.pulpwoodMinDbh).toBeGreaterThan(0);
      expect(region.sawTopDib).toBeGreaterThan(0);
      expect(region.pulpTopDib).toBeGreaterThan(0);
      expect(region.stumpHeightFt).toBeGreaterThanOrEqual(0);

      // region_pulp_min_below_saw_min: pulpwood is the lower-value, smaller
      // product. If its minimum diameter exceeded sawtimber's, every stem
      // between the two thresholds would fall through into nothing.
      expect(region.pulpwoodMinDbh).toBeLessThanOrEqual(region.sawtimberMinDbh);

      // region_pulp_top_below_saw_top: you can merchandise further up the stem
      // for pulpwood than for sawtimber, never the reverse.
      expect(region.pulpTopDib).toBeLessThanOrEqual(region.sawTopDib);
    }
  );

  it.each(regions.map((r) => [r.id, r] as const))(
    '%s has species within the stored numeric bounds',
    (_id, region) => {
      expect(region.species.length).toBeGreaterThan(0);
      for (const s of region.species) {
        // species.form_class CHECK (between 50 and 99)
        expect(s.formClass, `${s.code} form class`).toBeGreaterThanOrEqual(50);
        expect(s.formClass, `${s.code} form class`).toBeLessThanOrEqual(99);

        // species.green_lb_per_cuft CHECK (between 20 and 90). Green weight is
        // linear in the tons conversion, so an out-of-band value here scales an
        // entire valuation rather than nudging it.
        expect(s.greenLbPerCuFt, `${s.code} green weight`).toBeGreaterThanOrEqual(20);
        expect(s.greenLbPerCuFt, `${s.code} green weight`).toBeLessThanOrEqual(90);

        // numeric(5,2) on green_lb_per_cuft and numeric(4,1) on form_class:
        // more precision than that is silently rounded on insert, which would
        // put the database and the engine a hair apart.
        expect(Math.round(s.greenLbPerCuFt * 100) / 100).toBe(s.greenLbPerCuFt);
        expect(Math.round(s.formClass * 10) / 10).toBe(s.formClass);
      }
    }
  );

  it.each(regions.map((r) => [r.id, r] as const))(
    '%s has unique species codes',
    (_id, region) => {
      // species has UNIQUE (region_id, code). A duplicate would make the seed
      // fail to apply, and would make findSpecies() silently pick the first.
      const codes = region.species.map((s) => s.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  );

  it('keys every region by its own id', () => {
    // getRegion() looks up by map key; a mismatch would return a profile whose
    // id disagrees with the key a cruise stored, and the seed would insert
    // under the id, not the key.
    for (const [key, region] of Object.entries(REGIONS)) {
      expect(region.id).toBe(key);
    }
  });
});
