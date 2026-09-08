-- =============================================================================
-- 0001  TimberForge core schema
-- =============================================================================
--
-- ADDITIVE ONLY. This migration creates a new `timberforge` schema alongside
-- LandForge's existing `public` schema. It creates nothing in `public`, alters
-- nothing in `public`, and drops nothing anywhere. If this migration is run
-- against the live LandForge project and then immediately rolled back by
-- dropping the `timberforge` schema, LandForge is bit-for-bit unaffected.
--
-- That constraint is not politeness. LandForge is a live product with paying
-- users; TimberForge is pre-alpha. The blast radius of every TimberForge
-- migration must be confined to its own schema until the bridge in 0004 is
-- deliberately switched on.
--
-- -----------------------------------------------------------------------------
-- THREE DESIGN COMMITMENTS THAT EXPLAIN MOST OF WHAT FOLLOWS
-- -----------------------------------------------------------------------------
--
-- 1. IDENTIFIERS ARE GENERATED ON THE DEVICE, NOT BY THE DATABASE.
--    A cruiser is in a stand with no signal for six hours and creates a stand,
--    twelve plots and three hundred trees. Those rows must have their final,
--    permanent identity the moment they are written to IndexedDB, because the
--    tree rows reference the plot rows before the server has ever seen either.
--    So every primary key is a client-generated uuid, and `gen_random_uuid()`
--    is a fallback for server-side inserts, not the normal path. This is why
--    there is not a single `bigserial` in this file.
--
-- 2. AN EMPTY PLOT IS DATA. A SKIPPED PLOT IS NOT.
--    A plot that was walked to and legitimately held no tally trees is an
--    observation of zero and belongs in the statistics. A plot that could not
--    be reached is missing data and must be excluded. Collapsing these two into
--    one nullable "no trees" state is the single most consequential modelling
--    error available here: it systematically overestimates the stand while
--    making the estimate look more precise. The distinction is enforced by
--    CHECK constraint, not by convention.
--
-- 3. A NUMBER TRAVELS WITH ITS PROVENANCE.
--    `provenance` is a first-class enum, not a text note. Predicted-vs-actual
--    learning, and every claim TimberForge makes to LandForge about data
--    quality, is meaningless if a measured height and an ocular guess are
--    indistinguishable once they are in a table.
--
-- -----------------------------------------------------------------------------
-- UNITS. Stored canonically, always. No per-row unit columns except where a
-- genuine field-practice ambiguity exists (merchantable height, below).
--   diameter .......... inches
--   height ............ feet
--   area .............. acres
--   basal area ........ square feet
--   weight ............ green short tons (2000 lb)
--   board feet ........ board feet; MBF is derived, never stored raw
--   coordinates ....... WGS84 decimal degrees
-- =============================================================================

create schema if not exists timberforge;

comment on schema timberforge is
  'TimberForge timber cruising. Additive to LandForge''s public schema; '
  'shares auth and parcels, owns everything else.';

-- No extensions are required. gen_random_uuid() has been in core Postgres since
-- 13, so the pgcrypto dependency that this would once have needed is gone —
-- worth noting because a `create extension` here would be the one statement in
-- the file needing privileges beyond schema ownership.

-- -----------------------------------------------------------------------------
-- Enumerated domains
-- -----------------------------------------------------------------------------
-- These mirror the TypeScript unions in @timberforge/forestry-core/src/types.ts
-- exactly. When one changes the other must change in the same commit; there is
-- a drift test in the field app that reads these via information_schema.

create type timberforge.provenance as enum (
  'measured',   -- instrument in hand, in the field. Ground truth.
  'estimated',  -- a human typed it without measuring (ocular height, say)
  'predicted',  -- a TimberForge model produced it from remote data, pre-cruise
  'computed',   -- derived arithmetically from other values
  'defaulted'   -- filled from configuration because nothing better existed
);

comment on type timberforge.provenance is
  'Ordered by strength: measured > computed > estimated > predicted > defaulted. '
  'A derived value carries the provenance of its weakest input.';

create type timberforge.cruise_method as enum (
  'variable_radius',  -- point sampling / prism / angle gauge
  'fixed_area'        -- fixed-radius or fixed-dimension plots
);
-- 100% tally and 3P are deliberately absent. They are post-MVP, and adding an
-- enum value later is a one-line additive migration; supporting a method the
-- calculation engine cannot compile is not.

create type timberforge.log_rule as enum (
  'doyle',
  'scribner',
  'international_quarter'
);

create type timberforge.product_class as enum (
  'sawtimber',
  'chip_n_saw',
  'pulpwood',
  'veneer',
  'pole',
  'cull'
);

create type timberforge.species_group as enum ('softwood', 'hardwood');

create type timberforge.merch_height_unit as enum ('feet', 'logs');
-- The one legitimate per-row unit column. Cruisers in different regions record
-- merchantable height as feet or as 16-foot logs, and a crew will sometimes
-- switch between them within a day. Storing a bare number and inferring the
-- unit from magnitude is how a 2-log tree becomes a 2-foot tree.

create type timberforge.cruise_status as enum (
  'planning',    -- stands drawn, plots laid out, nothing measured
  'in_field',    -- actively collecting
  'compiling',   -- field work done, under review
  'delivered',   -- report issued to the client. Compilations frozen.
  'archived'
);

-- -----------------------------------------------------------------------------
-- Shared row plumbing
-- -----------------------------------------------------------------------------
-- Every synced table carries these. They exist for offline reconciliation, and
-- they are worth the width on every row.
--
--   created_at / updated_at : server clock, set by trigger. Never trusted from
--                             the client, whose clock may be wrong by hours.
--   client_updated_at       : the device's own clock. Kept for forensics and
--                             for ordering edits made by one device offline.
--   device_id               : which device wrote this. Free text; devices are
--                             not registered entities.
--   deleted_at              : SOFT DELETE. A hard delete cannot be synced --
--                             a device that was offline when a row was removed
--                             has no way to learn the row is gone, and will
--                             cheerfully re-upload it. Nothing in TimberForge
--                             hard-deletes field data.

create or replace function timberforge.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function timberforge.touch_updated_at() is
  'Sets updated_at from the server clock on every UPDATE. Client-supplied '
  'timestamps are recorded separately in client_updated_at and never trusted '
  'for ordering across devices.';

-- =============================================================================
-- Region profiles and species
-- =============================================================================
-- Region is configuration, not code. A cruise in Georgia and a cruise in Oregon
-- differ in log rule, species library, merchantable top diameter and minimum
-- merchantable DBH -- and nothing else structural. Hard-coding the South and
-- bolting on the West later would mean rewriting the calculation engine; making
-- the region a row means adding one.

create table timberforge.region_profile (
  id                  text primary key,
  name                text not null,
  log_rule            timberforge.log_rule not null,
  sawtimber_min_dbh   numeric(4,1) not null check (sawtimber_min_dbh > 0),
  pulpwood_min_dbh    numeric(4,1) not null check (pulpwood_min_dbh > 0),
  stump_height_ft     numeric(4,1) not null check (stump_height_ft >= 0),
  saw_top_dib         numeric(4,1) not null check (saw_top_dib > 0),
  pulp_top_dib        numeric(4,1) not null check (pulp_top_dib > 0),
  -- A built-in profile ships with the app and is not editable by users.
  -- A user profile belongs to whoever created it.
  is_builtin          boolean not null default false,
  owner_id            uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint region_pulp_min_below_saw_min
    check (pulpwood_min_dbh <= sawtimber_min_dbh),
  constraint region_pulp_top_below_saw_top
    check (pulp_top_dib <= saw_top_dib),
  -- A built-in profile has no owner; a user profile must have one.
  constraint region_ownership_coherent
    check ((is_builtin and owner_id is null) or (not is_builtin and owner_id is not null))
);

comment on table timberforge.region_profile is
  'Bundles every regionally-variable decision into one row so that supporting a '
  'new region is data entry rather than a code change.';
comment on column timberforge.region_profile.saw_top_dib is
  'Merchantable top diameter inside bark for sawtimber, inches. Drives where '
  'the merchantable stem is truncated in volume calculation.';

create trigger region_profile_touch
  before update on timberforge.region_profile
  for each row execute function timberforge.touch_updated_at();

create table timberforge.species (
  id                uuid primary key default gen_random_uuid(),
  region_id         text not null
                      references timberforge.region_profile (id) on delete cascade,
  code              text not null,
  common_name       text not null,
  species_group     timberforge.species_group not null,
  -- Girard form class: diameter inside bark at the top of the first 16-ft log,
  -- as a percent of DBH. 78 is the classic southern pine default. Values
  -- outside 60-95 are not physically impossible but are almost always a typo,
  -- so the constraint is deliberately wider than the QA warning band.
  form_class        numeric(4,1) not null check (form_class between 50 and 99),
  green_lb_per_cuft numeric(5,2) not null check (green_lb_per_cuft between 20 and 90),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (region_id, code)
);

comment on column timberforge.species.green_lb_per_cuft is
  'Green weight per cubic foot. The tons conversion is linear in this number, '
  'so a wrong value here scales an entire pulpwood valuation.';

create trigger species_touch
  before update on timberforge.species
  for each row execute function timberforge.touch_updated_at();

create index species_region_idx on timberforge.species (region_id);

-- =============================================================================
-- Cruise / stand / plot / tree
-- =============================================================================

create table timberforge.cruise (
  id                        uuid primary key,   -- client-generated
  owner_id                  uuid not null references auth.users (id) on delete restrict,
  name                      text not null,
  client_name               text,
  region_id                 text not null references timberforge.region_profile (id),
  -- Overrides the region default when a client contractually requires a rule.
  -- Doyle vs Scribner on the same timber can differ by 30% in small diameters,
  -- so which rule was used is part of the deliverable, not a display setting.
  log_rule_override         timberforge.log_rule,
  status                    timberforge.cruise_status not null default 'planning',
  target_sampling_error_pct numeric(4,1)
                              check (target_sampling_error_pct > 0
                                 and target_sampling_error_pct <= 100),
  confidence_level          numeric(4,3) not null default 0.95
                              check (confidence_level in (0.90, 0.95)),
  cruise_date               date,
  cruiser_name              text,
  notes                     text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  client_updated_at         timestamptz,
  device_id                 text,
  deleted_at                timestamptz
);

comment on column timberforge.cruise.log_rule_override is
  'Null means use the region profile default. Set only when the client '
  'requires a specific rule; the choice materially changes reported volume.';

create trigger cruise_touch
  before update on timberforge.cruise
  for each row execute function timberforge.touch_updated_at();

create index cruise_owner_idx on timberforge.cruise (owner_id)
  where deleted_at is null;
create index cruise_updated_idx on timberforge.cruise (updated_at);

create table timberforge.stand (
  id                uuid primary key,
  cruise_id         uuid not null references timberforge.cruise (id) on delete cascade,
  name              text not null,
  acres             numeric(10,3) not null check (acres > 0),
  -- Stand boundary. Stored as GeoJSON rather than PostGIS geometry so that this
  -- migration has no extension dependency beyond pgcrypto and the same value
  -- round-trips through IndexedDB unchanged. If LandForge already runs PostGIS,
  -- a later additive migration can add a generated geometry column alongside.
  boundary_geojson  jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  client_updated_at timestamptz,
  device_id         text,
  deleted_at        timestamptz
);

comment on column timberforge.stand.acres is
  'Every per-acre figure in the report is multiplied by this to reach a total. '
  'An acreage error is the largest single-number error available in a cruise '
  'and is invisible in the statistics, which describe only sampling error.';

create trigger stand_touch
  before update on timberforge.stand
  for each row execute function timberforge.touch_updated_at();

create index stand_cruise_idx on timberforge.stand (cruise_id)
  where deleted_at is null;

create table timberforge.plot (
  id                uuid primary key,
  stand_id          uuid not null references timberforge.stand (id) on delete cascade,
  number            integer not null check (number > 0),
  method            timberforge.cruise_method not null,

  -- Basal area factor, sq ft per acre per tallied tree. Required for VRP.
  baf               numeric(6,2) check (baf > 0),
  -- Plot size in acres. Required for fixed-area. 1/10 acre is the common case.
  plot_acres        numeric(8,5) check (plot_acres > 0),

  latitude          numeric(9,6) check (latitude between -90 and 90),
  longitude         numeric(9,6) check (longitude between -180 and 180),
  gps_accuracy_m    numeric(6,1) check (gps_accuracy_m >= 0),

  -- See design commitment 2 at the top of this file.
  is_empty          boolean not null default false,
  is_skipped        boolean not null default false,
  skip_reason       text,

  measured_at       timestamptz,
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  client_updated_at timestamptz,
  device_id         text,
  deleted_at        timestamptz,

  -- The parameter the method needs must be present, and the parameter it does
  -- not use must be absent. A fixed-area plot carrying a BAF is not merely
  -- untidy: it means somebody switched methods mid-cruise and the compiler
  -- would silently expand the plot the wrong way.
  constraint plot_method_parameters_match_method check (
    (method = 'variable_radius' and baf is not null and plot_acres is null)
    or
    (method = 'fixed_area' and plot_acres is not null and baf is null)
  ),

  -- Empty and skipped are mutually exclusive states with opposite statistical
  -- treatment. A plot cannot be both an observation of zero and not observed.
  constraint plot_empty_xor_skipped check (not (is_empty and is_skipped)),

  constraint plot_skip_reason_only_when_skipped
    check (is_skipped or skip_reason is null),

  unique (stand_id, number)
);

comment on constraint plot_method_parameters_match_method on timberforge.plot is
  'Mirrors the PLOT_MISSING_BAF / PLOT_METHOD_MIXED_FIELDS QA findings at the '
  'storage layer. QA can be overridden by a cruiser; this cannot.';
comment on column timberforge.plot.is_empty is
  'Visited, and legitimately held no tally trees. A real observation of zero '
  'that MUST be included in the statistics.';
comment on column timberforge.plot.is_skipped is
  'Not visited -- access denied, hazard, water. Missing data. Excluded from '
  'the statistics entirely, and reported as a coverage caveat.';

create trigger plot_touch
  before update on timberforge.plot
  for each row execute function timberforge.touch_updated_at();

create index plot_stand_idx on timberforge.plot (stand_id)
  where deleted_at is null;

create table timberforge.tree (
  id                uuid primary key,
  plot_id           uuid not null references timberforge.plot (id) on delete cascade,
  species_code      text not null,

  dbh               numeric(5,2) not null check (dbh > 0 and dbh < 200),
  total_height_ft   numeric(5,1) check (total_height_ft > 0 and total_height_ft < 400),
  merch_height      numeric(5,1) check (merch_height > 0),
  merch_height_unit timberforge.merch_height_unit,

  product           timberforge.product_class,
  defect_pct        numeric(5,2) check (defect_pct >= 0 and defect_pct <= 100),

  -- Number of identical trees this row represents. A cruiser tallying "3 in"
  -- writes one row with count 3 rather than three rows. The expansion factor is
  -- applied per represented tree, so count must never be silently defaulted to
  -- something other than 1.
  tree_count        integer not null default 1 check (tree_count >= 1),

  -- Per-tree Girard form class, when individually measured. Null falls back to
  -- the species default.
  form_class        numeric(4,1) check (form_class between 50 and 99),

  provenance        timberforge.provenance not null default 'measured',
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  client_updated_at timestamptz,
  device_id         text,
  deleted_at        timestamptz,

  -- A merchantable height with no unit is uninterpretable: 2 could be two logs
  -- (32 feet) or two feet. Rather than guess, refuse the row.
  constraint tree_merch_height_has_unit check (
    (merch_height is null and merch_height_unit is null)
    or (merch_height is not null and merch_height_unit is not null)
  ),

  -- Physically, merchantable height in FEET cannot exceed total height. When
  -- the unit is logs the comparison is not meaningful here and is left to the
  -- QA module, which knows the log length.
  constraint tree_merch_feet_within_total check (
    merch_height_unit is distinct from 'feet'
    or total_height_ft is null
    or merch_height is null
    or merch_height <= total_height_ft
  )
);

comment on column timberforge.tree.species_code is
  'References timberforge.species.code within the cruise''s region, but is NOT '
  'a foreign key. A cruiser must be able to record an unexpected species in the '
  'field without the write failing; the QA module raises TREE_UNKNOWN_SPECIES '
  'and the code is reconciled during compilation. Losing a real observation to '
  'referential integrity is the worse failure.';
comment on column timberforge.tree.tree_count is
  'Trees represented by this row. Expansion is applied per represented tree; '
  'treating this row as a single tree undercounts, and expanding it twice '
  'double-counts.';
comment on column timberforge.tree.provenance is
  'Defaults to measured because the field app''s tally screen produces measured '
  'rows. Any path that infers or imports a tree must set this explicitly.';

create trigger tree_touch
  before update on timberforge.tree
  for each row execute function timberforge.touch_updated_at();

create index tree_plot_idx on timberforge.tree (plot_id)
  where deleted_at is null;
create index tree_species_idx on timberforge.tree (species_code);

-- -----------------------------------------------------------------------------
-- Height subsample support
-- -----------------------------------------------------------------------------
-- Most cruises measure height on a subsample and predict the rest from a
-- height-diameter curve. The predicted heights are written back onto the tree
-- rows with provenance 'computed', and this table preserves which trees were
-- actually measured so the curve can be refit later and so the report can state
-- the subsample size honestly.

create table timberforge.height_sample (
  id            uuid primary key,
  tree_id       uuid not null references timberforge.tree (id) on delete cascade,
  height_ft     numeric(5,1) not null check (height_ft > 0 and height_ft < 400),
  instrument    text,
  measured_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (tree_id)
);

comment on table timberforge.height_sample is
  'The heights that were genuinely measured. Kept separate from tree.'
  'total_height_ft so that a fitted height can overwrite the tree row without '
  'destroying the evidence it was fitted from.';
