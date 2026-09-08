-- =============================================================================
-- 0004  LandForge bridge
-- =============================================================================
--
-- This is the seam. Every other migration is confined to a schema that did not
-- exist an hour ago; this one is the first that has an opinion about LandForge.
-- It is therefore the only one that can hurt a live product, and it is written
-- accordingly.
--
-- WHAT IT WILL NOT DO
--   * It does not create, alter or drop anything in `public`.
--   * It does not add a trigger to a LandForge table.
--   * It does not guess. If it cannot find the parcel table by its configured
--     name, it prints the candidates it found and skips the foreign key rather
--     than binding to a table that merely looks plausible. A wrong FK to a
--     similarly-named table would join TimberForge cruises to the wrong parcels
--     and every downstream number would be confidently, quietly incorrect.
--
-- WHY A FOREIGN KEY AT ALL
--   Shayne's decision was one Supabase project, one auth system, parcels shared
--   rather than copied. Copying parcel geometry into `timberforge` would mean
--   paying twice for the same acreage API calls and maintaining two copies that
--   drift the first time a boundary is corrected. A foreign key plus a join
--   costs nothing and cannot drift.
--
-- -----------------------------------------------------------------------------
-- OPERATOR NOTE — POSTGREST SCHEMA EXPOSURE
-- -----------------------------------------------------------------------------
-- Supabase's API only serves schemas on its exposed list. `timberforge` is not
-- on it by default, so until it is added, every table in this project is
-- reachable by SQL and invisible to the client library — which presents as
-- inexplicable empty results rather than as an error.
--
--   Dashboard: Settings -> API -> Exposed schemas -> add `timberforge`
--   Or in config.toml:  [api] schemas = ["public", "graphql_public", "timberforge"]
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Order of operations
-- -----------------------------------------------------------------------------
-- The conditional foreign key is attached at the BOTTOM of this file, after the
-- tables it constrains exist. Postgres runs statements in file order, so a
-- discovery block placed up here would abort the whole migration the moment it
-- succeeded in finding LandForge's parcel table and tried to ALTER a table that
-- had not been created yet -- failing precisely in the environment it was meant
-- to serve. If you need to point the bridge at a differently-named table, the
-- two variables to edit are `parcel_table` and `parcel_schema` in the final DO
-- block.

-- -----------------------------------------------------------------------------
-- The link itself
-- -----------------------------------------------------------------------------

create table timberforge.parcel_link (
  id                  uuid primary key default gen_random_uuid(),
  cruise_id           uuid not null references timberforge.cruise (id) on delete cascade,

  -- Foreign key added conditionally by the DO block, once the target is
  -- verified to exist and to be keyed by uuid.
  landforge_parcel_id uuid not null,

  -- A cruise can span several parcels and a parcel can be cruised repeatedly
  -- over the years, so this is many-to-many on purpose. The acreage share lets
  -- a multi-parcel cruise apportion volume back to each parcel rather than
  -- attributing all of it to whichever parcel happens to sort first.
  acres_on_parcel     numeric(10,3) check (acres_on_parcel > 0),

  linked_by           uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),

  unique (cruise_id, landforge_parcel_id)
);

comment on table timberforge.parcel_link is
  'Many-to-many between TimberForge cruises and LandForge parcels. Parcel data '
  'is joined, never copied: one source of truth for boundaries and acreage, and '
  'no second bill for the same acreage API calls.';
comment on column timberforge.parcel_link.acres_on_parcel is
  'Acres of this cruise falling on this parcel. Null is acceptable for a '
  'single-parcel cruise; on a multi-parcel cruise, leaving it null means volume '
  'cannot be apportioned and the feed will say so rather than guess.';

create index parcel_link_parcel_idx on timberforge.parcel_link (landforge_parcel_id);
create index parcel_link_cruise_idx on timberforge.parcel_link (cruise_id);

-- -----------------------------------------------------------------------------
-- The outbound feed
-- -----------------------------------------------------------------------------
-- One row per (parcel, compilation): the projection produced by
-- projectCruiseToLandForge() in @timberforge/landforge-contract, stored exactly
-- as it was sent.
--
-- Append-only, for the same reason compilations are. "What did TimberForge tell
-- LandForge about this parcel, and when" has to be answerable after the fact,
-- particularly when a valuation is disputed.

create table timberforge.timber_feed (
  id                  uuid primary key default gen_random_uuid(),
  landforge_parcel_id uuid not null,
  cruise_id           uuid not null references timberforge.cruise (id) on delete cascade,
  compilation_id      uuid not null references timberforge.compilation (id) on delete cascade,

  -- Contract versions. Both are needed to interpret an old row: the feed
  -- version fixes the payload shape, the adapter version fixes the field
  -- mapping, and they move independently.
  feed_version        text not null,   -- TIMBER_FEED_VERSION,  e.g. 'tf-feed-v1'
  adapter_version     text not null,   -- ADAPTER_VERSION
  calc_engine_version text not null,

  -- False while the adapter's field mapping is still inferred rather than
  -- confirmed against LandForge's actual code. Rows written in that state are
  -- not wrong so much as unverified, and consumers should treat them as
  -- provisional. See ADAPTER_VERIFIED in packages/landforge-contract.
  adapter_verified    boolean not null default false,

  -- The payload as sent. Authoritative.
  payload             jsonb not null,

  -- Lifted scalars for querying.
  acres                  numeric(12,3) check (acres > 0),
  mbf_per_acre           numeric(10,4) check (mbf_per_acre >= 0),
  net_stumpage_per_acre  numeric(12,2),
  timber_cost            numeric(14,2),
  t_gross                numeric(14,2),
  sampling_error_pct     numeric(6,2) check (sampling_error_pct >= 0),
  plot_count             integer check (plot_count >= 0),

  -- THE SENTINEL PROBLEM ------------------------------------------------------
  -- LandForge's §7.4 inventory ladder decides whether a parcel has real timber
  -- data by comparing values against its own modeled defaults. A genuine cruise
  -- that happens to return exactly 4.5 MBF/acre is therefore indistinguishable
  -- from the placeholder, and gets silently demoted: tier drops, Harvest+Resell
  -- confidence weakens, and a 3.5% reserve penalty switches on — all because a
  -- real measurement landed on a round number.
  --
  -- TimberForge's position is that you never perturb a measurement to dodge a
  -- sentinel. Nudging 4.5 to 4.51 to get better treatment downstream is
  -- fabricating data, and it would be undetectable afterwards. Instead the
  -- colliding value is passed through unchanged and the collision is recorded
  -- here, loudly, so a human can see why the parcel scored the way it did.
  sentinel_collisions jsonb not null default '[]'::jsonb,
  has_sentinel_collision boolean
    generated always as (jsonb_array_length(sentinel_collisions) > 0) stored,
  -- ---------------------------------------------------------------------------

  -- Provenance for each projected field, and free-text sources. Sent even
  -- though LandForge ignores them today; the day it reads them, the history is
  -- already there.
  provenance          jsonb not null default '{}'::jsonb,
  sources             jsonb not null default '{}'::jsonb,

  -- What TimberForge expects LandForge to conclude. Stored so that a later
  -- comparison against what LandForge actually concluded reveals a contract
  -- drift without anybody having to read both codebases.
  predicted_tier      text,

  warnings            text[] not null default '{}',

  sent_at             timestamptz,
  sent_by             uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now()
);

comment on table timberforge.timber_feed is
  'Append-only record of every timber projection handed to LandForge. Stores '
  'the payload verbatim alongside the contract versions needed to interpret it.';
comment on column timberforge.timber_feed.sentinel_collisions is
  'Measurements that landed exactly on a LandForge modeled default and will '
  'therefore be misread as "no real data". Recorded, never worked around: '
  'altering a measurement to game a downstream classifier is fabrication.';
comment on column timberforge.timber_feed.net_stumpage_per_acre is
  'PER ACRE, not a total. The corresponding LandForge field may be a total — '
  'that mapping is the single highest-risk item in adapter.ts, because sending '
  'a per-acre figure where a total is expected is wrong by the acreage factor '
  'and still looks entirely plausible in the UI.';

create trigger timber_feed_no_update
  before update on timberforge.timber_feed
  for each row execute function timberforge.forbid_update();

create index timber_feed_parcel_idx
  on timberforge.timber_feed (landforge_parcel_id, created_at desc);
create index timber_feed_collision_idx
  on timberforge.timber_feed (landforge_parcel_id)
  where has_sentinel_collision;

-- Current feed per parcel: the newest row that was actually sent.
create view timberforge.timber_feed_current as
select distinct on (landforge_parcel_id) *
from timberforge.timber_feed
where sent_at is not null
order by landforge_parcel_id, sent_at desc;

comment on view timberforge.timber_feed_current is
  'The timber figures LandForge should currently be using for each parcel. This '
  'is the intended read surface for LandForge — query this, not the base table.';

-- -----------------------------------------------------------------------------
-- Now attach the parcel foreign key, with the table in existence.
-- -----------------------------------------------------------------------------

do $$
declare
  parcel_table  text := 'land_parcels';
  parcel_schema text := 'public';
  target_regclass  regclass;
  target_pk_column text;
  target_pk_type   text;
  candidates       text;
begin
  select c.oid::regclass into target_regclass
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = parcel_schema
    and c.relname = parcel_table
    and c.relkind in ('r', 'p');

  if target_regclass is null then
    select coalesce(string_agg(format('%I.%I', n.nspname, c.relname), ', '
                               order by c.relname), '(none found)')
      into candidates
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = parcel_schema
      and c.relkind in ('r', 'p')
      and (c.relname ilike '%parcel%' or c.relname ilike '%propert%');

    raise notice
      'TimberForge 0004: parcel FK SKIPPED — %.% not found. Candidates: %. '
      'parcel_link exists with an unconstrained uuid column; set parcel_table '
      'at the top of this migration and re-run to complete the bridge.',
      parcel_schema, parcel_table, candidates;
    return;
  end if;

  select a.attname, format_type(a.atttypid, a.atttypmod)
    into target_pk_column, target_pk_type
  from pg_index i
  join pg_attribute a
    on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
  where i.indrelid = target_regclass
    and i.indisprimary
    and array_length(i.indkey::int[], 1) = 1;

  if target_pk_column is null then
    raise notice 'TimberForge 0004: %.% has no single-column PK; FK skipped.',
      parcel_schema, parcel_table;
    return;
  end if;

  if target_pk_type <> 'uuid' then
    raise notice
      'TimberForge 0004: %.%.% is %, not uuid; FK skipped. Retype '
      'parcel_link.landforge_parcel_id and timber_feed.landforge_parcel_id to % '
      'and re-run.',
      parcel_schema, parcel_table, target_pk_column, target_pk_type, target_pk_type;
    return;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'parcel_link_landforge_fk'
      and conrelid = 'timberforge.parcel_link'::regclass
  ) then
    execute format(
      'alter table timberforge.parcel_link
         add constraint parcel_link_landforge_fk
         foreign key (landforge_parcel_id) references %I.%I (%I)
         on delete restrict',
      parcel_schema, parcel_table, target_pk_column
    );
  end if;

  -- timber_feed intentionally gets NO foreign key to the parcel table. It is an
  -- append-only audit log: if a parcel is later deleted from LandForge, the
  -- record of what was reported about it must survive. `on delete restrict`
  -- would block the parcel deletion outright, and `cascade` would erase the
  -- audit trail — both worse than an orphaned uuid in a log.

  raise notice 'TimberForge 0004: parcel FK present on %.%(%).',
    parcel_schema, parcel_table, target_pk_column;
end;
$$;
