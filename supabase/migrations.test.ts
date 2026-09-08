/**
 * Executes the migrations against a real Postgres and checks that the
 * constraints, triggers and policies do what their comments claim.
 *
 * The tests are grouped by what would go wrong if they were absent, because
 * that is the only reason any of them are worth the runtime:
 *
 *   - APPLY        a syntax or ordering error would fail during `db push`,
 *                  against the live LandForge project.
 *   - BRIDGE       a wrong parcel foreign key would join cruises to the wrong
 *                  parcels, and every downstream number would be plausibly wrong.
 *   - CONSTRAINTS  these encode forestry rules that produce silently biased
 *                  estimates when violated, not loud failures.
 *   - IMMUTABILITY a compilation is what a client was told. If it can be edited,
 *                  the audit trail is decorative.
 *   - RLS          the failure mode is one cruiser reading another's data.
 *
 * See harness.ts for what this setup does and does not model.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createHarness, expectFailure, migrationFiles, type Harness } from './harness.js';

const UUID = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('migrations apply', () => {
  it('has files in a stable, gapless order', () => {
    const files = migrationFiles();
    expect(files.length).toBeGreaterThanOrEqual(5);
    // Numeric prefixes must sort lexicographically the same way they sort
    // numerically, or the apply order silently changes at the tenth migration.
    const prefixes = files.map((f) => f.slice(0, 4));
    expect(prefixes).toEqual([...prefixes].sort());
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('applies cleanly to an empty database with no LandForge present', async () => {
    // TimberForge has to be developable by someone who has never seen LandForge.
    const h = await createHarness();
    const t = await h.db.query<{ n: bigint }>(
      `select count(*)::bigint as n from information_schema.tables
       where table_schema = 'timberforge'`
    );
    expect(Number(t.rows[0]!.n)).toBeGreaterThan(10);
    await h.close();
  });

  it('creates nothing in the public schema', async () => {
    // The whole additive premise rests on this.
    const h = await createHarness();
    const r = await h.db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public'`
    );
    expect(r.rows).toEqual([]);
    await h.close();
  });
});

describe('LandForge bridge', () => {
  it('creates the parcel foreign key when the parcel table is found', async () => {
    const h = await createHarness({ withLandForgeParcels: true });
    const r = await h.db.query<{ conname: string }>(
      `select conname from pg_constraint
       where conrelid = 'timberforge.parcel_link'::regclass and contype = 'f'`
    );
    expect(r.rows.map((x) => x.conname)).toContain('parcel_link_landforge_fk');
    await h.close();
  });

  it('enforces the foreign key once created', async () => {
    const h = await createHarness({ withLandForgeParcels: true });
    const user = await h.makeUser(UUID(1));
    await h.db.exec(`
      insert into timberforge.cruise (id, owner_id, name, region_id)
      values ('${UUID(10)}', '${user}', 'Test', 'us_south');
    `);
    const err = await expectFailure(
      h.db,
      `insert into timberforge.parcel_link (cruise_id, landforge_parcel_id)
       values ('${UUID(10)}', '${UUID(99)}')`
    );
    expect(err).toMatch(/foreign key|violates/i);
    await h.close();
  });

  it('skips the foreign key rather than guessing when no parcel table exists', async () => {
    // The important half: parcel_link must still be created and usable, so that
    // TimberForge is developable standalone.
    const h = await createHarness({ withLandForgeParcels: false });
    const fks = await h.db.query(
      `select 1 from pg_constraint
       where conrelid = 'timberforge.parcel_link'::regclass and contype = 'f'
         and conname = 'parcel_link_landforge_fk'`
    );
    expect(fks.rows).toEqual([]);

    const user = await h.makeUser(UUID(1));
    await h.db.exec(`
      insert into timberforge.cruise (id, owner_id, name, region_id)
      values ('${UUID(10)}', '${user}', 'Test', 'us_south');
      insert into timberforge.parcel_link (cruise_id, landforge_parcel_id)
      values ('${UUID(10)}', '${UUID(99)}');
    `);
    const n = await h.db.query(`select 1 from timberforge.parcel_link`);
    expect(n.rows.length).toBe(1);
    await h.close();
  });

  it('refuses to bind to a parcel table whose key is not a uuid', async () => {
    // Coercing a bigint key into a uuid column would either fail later or,
    // worse, succeed for a subset of rows.
    const h = await createHarness({
      withLandForgeParcels: true,
      parcelPkType: 'bigint',
    });
    const fks = await h.db.query(
      `select 1 from pg_constraint
       where conrelid = 'timberforge.parcel_link'::regclass and contype = 'f'
         and conname = 'parcel_link_landforge_fk'`
    );
    expect(fks.rows).toEqual([]);
    await h.close();
  });

  it('leaves timber_feed unconstrained so the audit log outlives the parcel', async () => {
    const h = await createHarness({ withLandForgeParcels: true });
    const fks = await h.db.query<{ conname: string }>(
      `select conname from pg_constraint
       where conrelid = 'timberforge.timber_feed'::regclass and contype = 'f'`
    );
    const names = fks.rows.map((r) => r.conname).join(' ');
    expect(names).not.toMatch(/land_parcel/);
    await h.close();
  });
});

describe('seeded regions', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h.close();
  });

  it('loads every built-in region unowned', async () => {
    const r = await h.db.query<{ id: string; is_builtin: boolean; owner_id: string | null }>(
      `select id, is_builtin, owner_id from timberforge.region_profile order by id`
    );
    expect(r.rows.length).toBe(3);
    for (const row of r.rows) {
      expect(row.is_builtin).toBe(true);
      expect(row.owner_id).toBeNull();
    }
  });

  it('loads species for each region', async () => {
    const r = await h.db.query<{ region_id: string; n: bigint }>(
      `select region_id, count(*)::bigint as n from timberforge.species
       group by region_id order by region_id`
    );
    expect(r.rows.length).toBe(3);
    for (const row of r.rows) expect(Number(row.n)).toBeGreaterThan(0);
  });

  it('is idempotent — re-running the seed changes no counts', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { MIGRATIONS_DIR } = await import('./harness.js');
    const before = await h.db.query<{ n: bigint }>(
      `select count(*)::bigint as n from timberforge.species`
    );
    await h.db.exec(
      readFileSync(join(MIGRATIONS_DIR, '0002_seed_regions.sql'), 'utf8')
    );
    const after = await h.db.query<{ n: bigint }>(
      `select count(*)::bigint as n from timberforge.species`
    );
    expect(Number(after.rows[0]!.n)).toBe(Number(before.rows[0]!.n));
  });
});

describe('field data constraints', () => {
  let h: Harness;
  let db: PGlite;

  beforeAll(async () => {
    h = await createHarness();
    db = h.db;
    const user = await h.makeUser(UUID(1));
    await db.exec(`
      insert into timberforge.cruise (id, owner_id, name, region_id)
      values ('${UUID(10)}', '${user}', 'Test cruise', 'us_south');
      insert into timberforge.stand (id, cruise_id, name, acres)
      values ('${UUID(20)}', '${UUID(10)}', 'Stand A', 80);
    `);
  });
  afterAll(async () => {
    await h.close();
  });

  const plot = (n: number, extra: string): string =>
    `insert into timberforge.plot (id, stand_id, number, ${extra.split('|')[0]})
     values ('${UUID(100 + n)}', '${UUID(20)}', ${n}, ${extra.split('|')[1]})`;

  it('accepts a variable-radius plot with a BAF', async () => {
    expect(await expectFailure(db, plot(1, 'method, baf|\'variable_radius\', 10'))).toBeNull();
  });

  it('accepts a fixed-area plot with an area', async () => {
    expect(await expectFailure(db, plot(2, 'method, plot_acres|\'fixed_area\', 0.1'))).toBeNull();
  });

  it('rejects a variable-radius plot with no BAF', async () => {
    // Without a BAF there is no expansion factor, so the plot contributes
    // nothing and the stand is quietly underestimated.
    const err = await expectFailure(db, plot(3, 'method|\'variable_radius\''));
    expect(err).toMatch(/plot_method_parameters_match_method/);
  });

  it('rejects a fixed-area plot carrying a BAF', async () => {
    // Means somebody switched method mid-cruise; the compiler would expand it
    // the wrong way and the result would look entirely normal.
    const err = await expectFailure(
      db,
      plot(4, 'method, plot_acres, baf|\'fixed_area\', 0.1, 10')
    );
    expect(err).toMatch(/plot_method_parameters_match_method/);
  });

  it('rejects a plot that is both empty and skipped', async () => {
    // Opposite statistical treatment: empty is an observation of zero that must
    // be included; skipped is missing data that must be excluded.
    const err = await expectFailure(
      db,
      `insert into timberforge.plot (id, stand_id, number, method, baf, is_empty, is_skipped)
       values ('${UUID(105)}', '${UUID(20)}', 5, 'variable_radius', 10, true, true)`
    );
    expect(err).toMatch(/plot_empty_xor_skipped/);
  });

  it('allows an empty plot, which is real data', async () => {
    expect(
      await expectFailure(
        db,
        `insert into timberforge.plot (id, stand_id, number, method, baf, is_empty)
         values ('${UUID(106)}', '${UUID(20)}', 6, 'variable_radius', 10, true)`
      )
    ).toBeNull();
  });

  it('rejects a skip reason on a plot that was not skipped', async () => {
    const err = await expectFailure(
      db,
      `insert into timberforge.plot (id, stand_id, number, method, baf, skip_reason)
       values ('${UUID(107)}', '${UUID(20)}', 7, 'variable_radius', 10, 'water')`
    );
    expect(err).toMatch(/plot_skip_reason_only_when_skipped/);
  });

  it('rejects duplicate plot numbers within a stand', async () => {
    const err = await expectFailure(
      db,
      `insert into timberforge.plot (id, stand_id, number, method, baf)
       values ('${UUID(108)}', '${UUID(20)}', 1, 'variable_radius', 10)`
    );
    expect(err).toMatch(/unique|duplicate/i);
  });

  const tree = (n: number, cols: string, vals: string): string =>
    `insert into timberforge.tree (id, plot_id, species_code, dbh, ${cols})
     values ('${UUID(200 + n)}', '${UUID(101)}', 'LP', 12.5, ${vals})`;

  it('rejects a merchantable height with no unit', async () => {
    // "2" is either two 16-foot logs or two feet. Guessing turns a sawlog into
    // a stump.
    const err = await expectFailure(db, tree(1, 'merch_height', '2'));
    expect(err).toMatch(/tree_merch_height_has_unit/);
  });

  it('accepts a merchantable height in logs without a total height', async () => {
    expect(
      await expectFailure(db, tree(2, 'merch_height, merch_height_unit', "2, 'logs'"))
    ).toBeNull();
  });

  it('rejects merchantable feet exceeding total height', async () => {
    const err = await expectFailure(
      db,
      tree(3, 'total_height_ft, merch_height, merch_height_unit', "70, 90, 'feet'")
    );
    expect(err).toMatch(/tree_merch_feet_within_total/);
  });

  it('does not apply the height comparison when the unit is logs', async () => {
    // 4 logs is 64 feet, which is less than 70 — but the raw number 4 vs 70
    // comparison is meaningless, and the constraint must not pretend otherwise.
    expect(
      await expectFailure(
        db,
        tree(4, 'total_height_ft, merch_height, merch_height_unit', "70, 4, 'logs'")
      )
    ).toBeNull();
  });

  it('rejects a tally count below one', async () => {
    const err = await expectFailure(db, tree(5, 'tree_count', '0'));
    expect(err).toMatch(/tree_count/);
  });

  it('accepts an unknown species code rather than losing the observation', async () => {
    // species_code is deliberately not a foreign key. A cruiser must be able to
    // record a surprise; QA raises TREE_UNKNOWN_SPECIES at compile time.
    expect(
      await expectFailure(
        db,
        `insert into timberforge.tree (id, plot_id, species_code, dbh)
         values ('${UUID(230)}', '${UUID(101)}', 'ZZZ-UNKNOWN', 14)`
      )
    ).toBeNull();
  });

  it('rejects a stand with no acres', async () => {
    const err = await expectFailure(
      db,
      `insert into timberforge.stand (id, cruise_id, name, acres)
       values ('${UUID(21)}', '${UUID(10)}', 'Bad', 0)`
    );
    expect(err).toMatch(/acres/);
  });

  it('rejects a built-in region profile with an owner', async () => {
    const err = await expectFailure(
      db,
      `insert into timberforge.region_profile
         (id, name, log_rule, sawtimber_min_dbh, pulpwood_min_dbh,
          stump_height_ft, saw_top_dib, pulp_top_dib, is_builtin, owner_id)
       values ('bad', 'Bad', 'doyle', 10, 5, 0.5, 8, 3, true, '${UUID(1)}')`
    );
    expect(err).toMatch(/region_ownership_coherent/);
  });

  it('rejects a region where pulpwood minimum exceeds sawtimber minimum', async () => {
    // Every stem between the two thresholds would fall through into no product.
    const err = await expectFailure(
      db,
      `insert into timberforge.region_profile
         (id, name, log_rule, sawtimber_min_dbh, pulpwood_min_dbh,
          stump_height_ft, saw_top_dib, pulp_top_dib, is_builtin)
       values ('bad2', 'Bad', 'doyle', 5, 10, 0.5, 8, 3, true)`
    );
    expect(err).toMatch(/region_pulp_min_below_saw_min/);
  });
});

describe('immutability of the record', () => {
  let h: Harness;
  let db: PGlite;

  beforeAll(async () => {
    h = await createHarness();
    db = h.db;
    const user = await h.makeUser(UUID(1));
    await db.exec(`
      insert into timberforge.cruise (id, owner_id, name, region_id)
      values ('${UUID(10)}', '${user}', 'Test', 'us_south');
      insert into timberforge.stand (id, cruise_id, name, acres)
      values ('${UUID(20)}', '${UUID(10)}', 'Stand A', 80);
      insert into timberforge.compilation (
        id, cruise_id, calc_engine_version, log_rule, region_snapshot,
        confidence_level, result, total_acres, total_net_mbf,
        total_net_green_tons, weighted_net_mbf_per_acre,
        weighted_basal_area_per_acre, weighted_trees_per_acre, plot_count)
      values ('${UUID(30)}', '${UUID(10)}', 'tf-calc-v0.1.0', 'doyle',
        '{"id":"us_south"}'::jsonb, 0.95,
        '{"stands":[{"standId":"${UUID(20)}","netMbfPerAcre":5.2,
           "basalAreaPerAcre":90,"netGreenTonsPerAcre":42,"plotCount":8,
           "statistics":{"netBoardFeetPerAcre":{"samplingErrorPct":12.4}}}]}'::jsonb,
        80, 416, 3360, 5.2, 90, 210, 8);
    `);
  });
  afterAll(async () => {
    await h.close();
  });

  it('refuses to update a compilation, even as superuser', async () => {
    const err = await expectFailure(
      db,
      `update timberforge.compilation set total_net_mbf = 999 where id = '${UUID(30)}'`
    );
    expect(err).toMatch(/append-only/i);
  });

  it('names supersession as the correct remedy in the error', async () => {
    // The error has to teach the right move, or somebody will drop the trigger.
    const err = await expectFailure(
      db,
      `update timberforge.compilation set delivered_note = 'x' where id = '${UUID(30)}'`
    );
    expect(err).toMatch(/supersedes_id/);
  });

  it('allows correction by supersession', async () => {
    expect(
      await expectFailure(
        db,
        `insert into timberforge.compilation (
           id, cruise_id, supersedes_id, calc_engine_version, log_rule,
           region_snapshot, confidence_level, result, total_acres, total_net_mbf,
           total_net_green_tons, weighted_net_mbf_per_acre,
           weighted_basal_area_per_acre, weighted_trees_per_acre, plot_count)
         values ('${UUID(31)}', '${UUID(10)}', '${UUID(30)}', 'tf-calc-v0.1.0',
           'doyle', '{"id":"us_south"}'::jsonb, 0.95, '{"stands":[]}'::jsonb,
           80, 420, 3360, 5.25, 90, 210, 8)`
      )
    ).toBeNull();
  });

  it('keeps the lineage a chain, not a branching history', async () => {
    const err = await expectFailure(
      db,
      `insert into timberforge.compilation (
         id, cruise_id, supersedes_id, calc_engine_version, log_rule,
         region_snapshot, confidence_level, result, total_acres, total_net_mbf,
         total_net_green_tons, weighted_net_mbf_per_acre,
         weighted_basal_area_per_acre, weighted_trees_per_acre, plot_count)
       values ('${UUID(32)}', '${UUID(10)}', '${UUID(30)}', 'tf-calc-v0.1.0',
         'doyle', '{"id":"us_south"}'::jsonb, 0.95, '{"stands":[]}'::jsonb,
         80, 421, 3360, 5.26, 90, 210, 8)`
    );
    expect(err).toMatch(/compilation_single_successor_idx|unique/i);
  });

  it('refuses a prediction that claims to be measured', async () => {
    // A "prediction" with measured provenance would score perfectly and
    // contaminate the model's accuracy record.
    const err = await expectFailure(
      db,
      `insert into timberforge.prediction
         (cruise_id, stand_id, model_version, input_source, provenance,
          predicted_mbf_per_acre)
       values ('${UUID(10)}', '${UUID(20)}', 'm1', 'landforge', 'measured', 5)`
    );
    expect(err).toMatch(/prediction_is_not_measured/);
  });

  it('refuses to update a prediction after the fact', async () => {
    await db.exec(
      `insert into timberforge.prediction
         (id, cruise_id, stand_id, model_version, input_source, predicted_mbf_per_acre)
       values ('${UUID(40)}', '${UUID(10)}', '${UUID(20)}', 'm1', 'landforge', 4.0)`
    );
    const err = await expectFailure(
      db,
      `update timberforge.prediction set predicted_mbf_per_acre = 5.2
       where id = '${UUID(40)}'`
    );
    expect(err).toMatch(/append-only/i);
  });

  it('requires a note when a QA finding is dismissed', async () => {
    await db.exec(
      `insert into timberforge.qa_finding (id, cruise_id, code, severity, scope, message)
       values ('${UUID(50)}', '${UUID(10)}', 'TREE_DBH_ABOVE_RANGE', 'warning',
               'tree', '42 inch loblolly')`
    );
    const err = await expectFailure(
      db,
      `update timberforge.qa_finding set acknowledged_at = now() where id = '${UUID(50)}'`
    );
    expect(err).toMatch(/qa_ack_has_note/);
  });

  it('allows a QA finding to be acknowledged with a reason', async () => {
    expect(
      await expectFailure(
        db,
        `update timberforge.qa_finding
         set acknowledged_at = now(),
             acknowledgement_note = 'Verified in field — legacy yard tree.'
         where id = '${UUID(50)}'`
      )
    ).toBeNull();
  });

  it('flags a sentinel collision without altering the value', async () => {
    await db.exec(
      `insert into timberforge.timber_feed (
         id, landforge_parcel_id, cruise_id, compilation_id, feed_version,
         adapter_version, calc_engine_version, payload, mbf_per_acre,
         sentinel_collisions)
       values ('${UUID(60)}', '${UUID(99)}', '${UUID(10)}', '${UUID(30)}',
         'tf-feed-v1', 'tf-lf-adapter-v0-unverified', 'tf-calc-v0.1.0',
         '{}'::jsonb, 4.5,
         '[{"key":"defaultMbfPerAcre","value":4.5}]'::jsonb)`
    );
    const r = await h.db.query<{ mbf_per_acre: string; has_sentinel_collision: boolean }>(
      `select mbf_per_acre, has_sentinel_collision from timberforge.timber_feed
       where id = '${UUID(60)}'`
    );
    expect(r.rows[0]!.has_sentinel_collision).toBe(true);
    // The measurement is passed through untouched. Nudging it to 4.51 to dodge
    // LandForge's ladder would be fabricating data.
    expect(Number(r.rows[0]!.mbf_per_acre)).toBe(4.5);
  });

  it('reports no collision for an ordinary value', async () => {
    await db.exec(
      `insert into timberforge.timber_feed (
         id, landforge_parcel_id, cruise_id, compilation_id, feed_version,
         adapter_version, calc_engine_version, payload, mbf_per_acre)
       values ('${UUID(61)}', '${UUID(99)}', '${UUID(10)}', '${UUID(30)}',
         'tf-feed-v1', 'tf-lf-adapter-v0-unverified', 'tf-calc-v0.1.0',
         '{}'::jsonb, 4.6)`
    );
    const r = await h.db.query<{ has_sentinel_collision: boolean }>(
      `select has_sentinel_collision from timberforge.timber_feed where id = '${UUID(61)}'`
    );
    expect(r.rows[0]!.has_sentinel_collision).toBe(false);
  });
});

describe('predicted vs actual', () => {
  let h: Harness;
  let db: PGlite;

  beforeAll(async () => {
    h = await createHarness();
    db = h.db;
    const user = await h.makeUser(UUID(1));
    await db.exec(`
      insert into timberforge.cruise (id, owner_id, name, region_id)
      values ('${UUID(10)}', '${user}', 'Test', 'us_south');
      insert into timberforge.stand (id, cruise_id, name, acres)
      values ('${UUID(20)}', '${UUID(10)}', 'Stand A', 80);

      insert into timberforge.prediction
        (id, cruise_id, stand_id, model_version, input_source,
         predicted_mbf_per_acre, predicted_at)
      values ('${UUID(40)}', '${UUID(10)}', '${UUID(20)}', 'lf-timber-v1',
        'landforge', 6.5, now() - interval '30 days');

      insert into timberforge.compilation (
        id, cruise_id, calc_engine_version, log_rule, region_snapshot,
        confidence_level, result, total_acres, total_net_mbf,
        total_net_green_tons, weighted_net_mbf_per_acre,
        weighted_basal_area_per_acre, weighted_trees_per_acre, plot_count)
      values ('${UUID(30)}', '${UUID(10)}', 'tf-calc-v0.1.0', 'doyle',
        '{"id":"us_south"}'::jsonb, 0.95,
        '{"stands":[{"standId":"${UUID(20)}","netMbfPerAcre":5.0,
           "basalAreaPerAcre":90,"netGreenTonsPerAcre":42,"plotCount":8,
           "statistics":{"netBoardFeetPerAcre":{"samplingErrorPct":12.4}}}]}'::jsonb,
        80, 400, 3360, 5.0, 90, 210, 8);
    `);
  });
  afterAll(async () => {
    await h.close();
  });

  it('joins the frozen prediction to the measured result', async () => {
    const r = await db.query<{
      mbf_residual: string;
      mbf_error_pct: string;
      actual_sampling_error_pct: string;
      error_is_scoreable: boolean;
      stand_name: string;
    }>(`select * from timberforge.predicted_vs_actual`);
    expect(r.rows.length).toBe(1);
    const row = r.rows[0]!;
    expect(row.stand_name).toBe('Stand A');
    // Predicted 6.5 against an actual 5.0: over-predicted by 1.5, i.e. 30%.
    expect(Number(row.mbf_residual)).toBeCloseTo(1.5, 6);
    expect(Number(row.mbf_error_pct)).toBeCloseTo(30, 6);
    expect(row.error_is_scoreable).toBe(true);
  });

  it('surfaces the cruise sampling error alongside the residual', async () => {
    // A 30% miss against a cruise carrying 12.4% sampling error is a different
    // claim from a 30% miss against a tight cruise. Scoring without this column
    // blames the model for the cruise's imprecision.
    const r = await db.query<{ actual_sampling_error_pct: string }>(
      `select actual_sampling_error_pct from timberforge.predicted_vs_actual`
    );
    expect(Number(r.rows[0]!.actual_sampling_error_pct)).toBeCloseTo(12.4, 6);
  });

  it('marks a prediction made after the compilation as unscoreable', async () => {
    await db.exec(`
      insert into timberforge.stand (id, cruise_id, name, acres)
      values ('${UUID(21)}', '${UUID(10)}', 'Stand B', 40);
      insert into timberforge.prediction
        (cruise_id, stand_id, model_version, input_source,
         predicted_mbf_per_acre, predicted_at)
      values ('${UUID(10)}', '${UUID(21)}', 'lf-timber-v1', 'landforge',
        4.0, now() + interval '1 day');
    `);
    // Supersede the compilation so its stands array covers Stand B too.
    await db.exec(`
      insert into timberforge.compilation (
        id, cruise_id, supersedes_id, calc_engine_version, log_rule,
        region_snapshot, confidence_level, result, total_acres, total_net_mbf,
        total_net_green_tons, weighted_net_mbf_per_acre,
        weighted_basal_area_per_acre, weighted_trees_per_acre, plot_count)
      values ('${UUID(31)}', '${UUID(10)}', '${UUID(30)}', 'tf-calc-v0.1.0',
        'doyle', '{"id":"us_south"}'::jsonb, 0.95,
        '{"stands":[{"standId":"${UUID(21)}","netMbfPerAcre":4.0,
           "basalAreaPerAcre":80,"netGreenTonsPerAcre":30,"plotCount":5,
           "statistics":{"netBoardFeetPerAcre":{"samplingErrorPct":20}}}]}'::jsonb,
        40, 160, 1200, 4.0, 80, 190, 5);
    `);
    const r = await db.query<{ error_is_scoreable: boolean }>(
      `select error_is_scoreable from timberforge.predicted_vs_actual
       where stand_id = '${UUID(21)}'`
    );
    // Retained, not dropped — a silent exclusion would hide a broken workflow.
    expect(r.rows.length).toBe(1);
    expect(r.rows[0]!.error_is_scoreable).toBe(false);
  });

  it('returns null percent error rather than infinity on a zero-volume stand', async () => {
    const h2 = await createHarness();
    const user = await h2.makeUser(UUID(1));
    await h2.db.exec(`
      insert into timberforge.cruise (id, owner_id, name, region_id)
      values ('${UUID(10)}', '${user}', 'T', 'us_south');
      insert into timberforge.stand (id, cruise_id, name, acres)
      values ('${UUID(20)}', '${UUID(10)}', 'Cutover', 40);
      insert into timberforge.prediction
        (cruise_id, stand_id, model_version, input_source, predicted_mbf_per_acre)
      values ('${UUID(10)}', '${UUID(20)}', 'm', 'landforge', 3.0);
      insert into timberforge.compilation (
        id, cruise_id, calc_engine_version, log_rule, region_snapshot,
        confidence_level, result, total_acres, total_net_mbf,
        total_net_green_tons, weighted_net_mbf_per_acre,
        weighted_basal_area_per_acre, weighted_trees_per_acre, plot_count)
      values ('${UUID(30)}', '${UUID(10)}', 'v', 'doyle', '{}'::jsonb, 0.95,
        '{"stands":[{"standId":"${UUID(20)}","netMbfPerAcre":0,
          "basalAreaPerAcre":0,"netGreenTonsPerAcre":0,"plotCount":4,
          "statistics":{"netBoardFeetPerAcre":{"samplingErrorPct":0}}}]}'::jsonb,
        40, 0, 0, 0, 0, 0, 4);
    `);
    const r = await h2.db.query<{ mbf_error_pct: string | null; mbf_residual: string }>(
      `select mbf_error_pct, mbf_residual from timberforge.predicted_vs_actual`
    );
    expect(r.rows[0]!.mbf_error_pct).toBeNull();
    // The residual is still meaningful and is still reported.
    expect(Number(r.rows[0]!.mbf_residual)).toBeCloseTo(3.0, 6);
    await h2.close();
  });
});

describe('row level security', () => {
  let h: Harness;
  let db: PGlite;
  const alice = UUID(1);
  const bob = UUID(2);

  beforeAll(async () => {
    h = await createHarness();
    db = h.db;
    await h.makeUser(alice);
    await h.makeUser(bob);
    await db.exec(`
      insert into timberforge.cruise (id, owner_id, name, region_id)
      values ('${UUID(10)}', '${alice}', 'Alice cruise', 'us_south');
      insert into timberforge.stand (id, cruise_id, name, acres)
      values ('${UUID(20)}', '${UUID(10)}', 'Stand A', 80);
    `);
  });
  afterAll(async () => {
    await h.actAsOwner();
    await h.close();
  });

  it('is enabled on every table in the schema', async () => {
    // One table with RLS left off is readable by any authenticated user, and
    // the omission is invisible until somebody goes looking.
    const r = await db.query<{ relname: string }>(
      `select c.relname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'timberforge' and c.relkind = 'r' and not c.relrowsecurity`
    );
    expect(r.rows.map((x) => x.relname)).toEqual([]);
  });

  it('hides a cruise from an unrelated user', async () => {
    await h.actAs(bob);
    await h.actAsRole('authenticated');
    const r = await db.query(`select id from timberforge.cruise`);
    await h.actAsOwner();
    expect(r.rows).toEqual([]);
  });

  it('shows a cruise to its owner', async () => {
    await h.actAs(alice);
    await h.actAsRole('authenticated');
    const r = await db.query(`select id from timberforge.cruise`);
    await h.actAsOwner();
    expect(r.rows.length).toBe(1);
  });

  it('cascades visibility to stands', async () => {
    await h.actAs(bob);
    await h.actAsRole('authenticated');
    const hidden = await db.query(`select id from timberforge.stand`);
    await h.actAsOwner();
    expect(hidden.rows).toEqual([]);

    await h.actAs(alice);
    await h.actAsRole('authenticated');
    const shown = await db.query(`select id from timberforge.stand`);
    await h.actAsOwner();
    expect(shown.rows.length).toBe(1);
  });

  it('grants read but not write to a viewer', async () => {
    await db.exec(
      `insert into timberforge.cruise_member (cruise_id, user_id, role)
       values ('${UUID(10)}', '${bob}', 'viewer')`
    );
    await h.actAs(bob);
    await h.actAsRole('authenticated');
    const read = await db.query(`select id from timberforge.cruise`);
    expect(read.rows.length).toBe(1);
    const err = await expectFailure(
      db,
      `insert into timberforge.stand (id, cruise_id, name, acres)
       values ('${UUID(22)}', '${UUID(10)}', 'Sneaky', 10)`
    );
    await h.actAsOwner();
    expect(err).toMatch(/policy/i);
  });

  it('grants write to an editor', async () => {
    await db.exec(
      `update timberforge.cruise_member set role = 'editor'
       where cruise_id = '${UUID(10)}' and user_id = '${bob}'`
    );
    await h.actAs(bob);
    await h.actAsRole('authenticated');
    const err = await expectFailure(
      db,
      `insert into timberforge.stand (id, cruise_id, name, acres)
       values ('${UUID(23)}', '${UUID(10)}', 'Stand C', 10)`
    );
    await h.actAsOwner();
    expect(err).toBeNull();
  });

  it('stops an editor seizing ownership of the cruise', async () => {
    // REGRESSION GUARD. This started as a bug. The policy read
    //   with check (can_write_cruise(id) and owner_id = auth.uid())
    // which looks like it prevents an editor taking the cruise and in fact
    // permits precisely that: WITH CHECK sees only the NEW row, so setting
    // owner_id to yourself satisfies it. The escalation chain that followed was
    // seize ownership -> rewrite membership -> delete the cruise, and the two
    // tests below walk the rest of it.
    await h.actAs(bob);
    await h.actAsRole('authenticated');
    const err = await expectFailure(
      db,
      `update timberforge.cruise set owner_id = '${bob}' where id = '${UUID(10)}'`
    );
    await h.actAsOwner();
    expect(err).toMatch(/only the current owner/i);

    const owner = await db.query<{ owner_id: string }>(
      `select owner_id from timberforge.cruise where id = '${UUID(10)}'`
    );
    expect(owner.rows[0]!.owner_id).toBe(alice);
  });

  it('stops an editor managing membership', async () => {
    // An editor who could add members could promote themselves to owner, which
    // would make the editor/owner distinction decorative.
    //
    // Note this asserts on the RESULT, not on an error. An UPDATE whose policy
    // USING clause matches nothing affects zero rows and raises nothing — so a
    // test that only expected an exception would pass against a policy that had
    // been deleted entirely.
    await h.actAs(bob);
    await h.actAsRole('authenticated');
    await db.query(
      `update timberforge.cruise_member set role = 'owner'
       where cruise_id = '${UUID(10)}' and user_id = '${bob}'`
    );
    await h.actAsOwner();
    const r = await db.query<{ role: string }>(
      `select role from timberforge.cruise_member
       where cruise_id = '${UUID(10)}' and user_id = '${bob}'`
    );
    expect(r.rows[0]!.role).toBe('editor');
  });

  it('stops an editor deleting the cruise', async () => {
    await h.actAs(bob);
    await h.actAsRole('authenticated');
    await db.query(`delete from timberforge.cruise where id = '${UUID(10)}'`);
    await h.actAsOwner();
    const still = await db.query(`select id from timberforge.cruise where id = '${UUID(10)}'`);
    expect(still.rows.length).toBe(1);
  });

  it('refuses even the owner a bare UPDATE of owner_id', async () => {
    // Not a bug — a documented consequence, pinned here because it is the kind
    // of behaviour someone would otherwise "fix" by loosening cruise_read.
    //
    // Where a table has an UPDATE policy, Postgres also applies the SELECT
    // policy to the new row as a WITH CHECK: you may not update a row into a
    // state you could no longer read. Changing owner_id does exactly that, so
    // the statement is rejected — and rejected with a message naming the WITH
    // CHECK, which points at the wrong policy entirely.
    await h.actAs(alice);
    await h.actAsRole('authenticated');
    const err = await expectFailure(
      db,
      `update timberforge.cruise set owner_id = '${bob}' where id = '${UUID(10)}'`
    );
    await h.actAsOwner();
    expect(err).toMatch(/row-level security/i);

    const owner = await db.query<{ owner_id: string }>(
      `select owner_id from timberforge.cruise where id = '${UUID(10)}'`
    );
    expect(owner.rows[0]!.owner_id).toBe(alice);
  });

  it('lets the actual owner hand the cruise over via transfer_cruise', async () => {
    // The escalation guard must not make legitimate handover impossible — a
    // cruiser leaving a firm has to be able to pass the work on.
    await h.actAs(alice);
    await h.actAsRole('authenticated');
    const err = await expectFailure(
      db,
      `select timberforge.transfer_cruise('${UUID(10)}', '${bob}')`
    );
    await h.actAsOwner();
    expect(err).toBeNull();

    const after = await db.query<{ owner_id: string }>(
      `select owner_id from timberforge.cruise where id = '${UUID(10)}'`
    );
    expect(after.rows[0]!.owner_id).toBe(bob);

    // The outgoing owner keeps access to the data they collected.
    const kept = await db.query<{ role: string }>(
      `select role from timberforge.cruise_member
       where cruise_id = '${UUID(10)}' and user_id = '${alice}'`
    );
    expect(kept.rows[0]!.role).toBe('editor');

    // Put it back so the remaining tests see the original owner. Note the
    // actAs(null): the session still carries alice's uid, and alice is no
    // longer the owner, so a bare UPDATE here would be stopped by the very
    // guard this test just exercised. Clearing the uid is the service-role
    // path, which is exactly what an administrative fixup is.
    await h.actAs(null);
    await db.exec(
      `update timberforge.cruise set owner_id = '${alice}' where id = '${UUID(10)}';
       delete from timberforge.cruise_member
       where cruise_id = '${UUID(10)}' and user_id = '${alice}';`
    );
  });

  it('refuses transfer_cruise to anyone but the current owner', async () => {
    // The function runs SECURITY DEFINER, so RLS is not protecting it. Its own
    // check is the only thing standing between an editor and the cruise.
    await h.actAs(bob);
    await h.actAsRole('authenticated');
    const err = await expectFailure(
      db,
      `select timberforge.transfer_cruise('${UUID(10)}', '${bob}')`
    );
    await h.actAsOwner();
    expect(err).toMatch(/only the current owner/i);

    const owner = await db.query<{ owner_id: string }>(
      `select owner_id from timberforge.cruise where id = '${UUID(10)}'`
    );
    expect(owner.rows[0]!.owner_id).toBe(alice);
  });

  it('does not recurse between cruise and cruise_member policies', async () => {
    // The classic RLS failure: a policy on A that reads B, whose policy reads A.
    // Postgres raises it at query time, not at migration time, so nothing short
    // of running a query finds it.
    await h.actAs(bob);
    await h.actAsRole('authenticated');
    const err = await expectFailure(
      db,
      `select c.id from timberforge.cruise c
       join timberforge.cruise_member m on m.cruise_id = c.id`
    );
    await h.actAsOwner();
    expect(err ?? '').not.toMatch(/infinite recursion/i);
  });

  it('lets everyone read built-in region profiles', async () => {
    await h.actAs(bob);
    await h.actAsRole('authenticated');
    const r = await db.query(`select id from timberforge.region_profile`);
    await h.actAsOwner();
    expect(r.rows.length).toBe(3);
  });

  it('does not let a user modify a built-in region profile', async () => {
    await h.actAs(bob);
    await h.actAsRole('authenticated');
    await db.query(
      `update timberforge.region_profile set sawtimber_min_dbh = 99 where id = 'us_south'`
    );
    await h.actAsOwner();
    const r = await db.query<{ sawtimber_min_dbh: string }>(
      `select sawtimber_min_dbh from timberforge.region_profile where id = 'us_south'`
    );
    expect(Number(r.rows[0]!.sawtimber_min_dbh)).toBe(10);
  });

  it('does not grant UPDATE on the append-only tables', async () => {
    const r = await db.query<{ privilege_type: string }>(
      `select privilege_type from information_schema.role_table_grants
       where table_schema = 'timberforge' and table_name = 'compilation'
         and grantee = 'authenticated'`
    );
    expect(r.rows.map((x) => x.privilege_type)).not.toContain('UPDATE');
  });
});
