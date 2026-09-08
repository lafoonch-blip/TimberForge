-- =============================================================================
-- 0002  Built-in region profiles
-- =============================================================================
--
-- GENERATED FILE. DO NOT EDIT BY HAND.
--   source:    packages/forestry-core/src/regions.ts
--   generator: scripts/genRegionSeed.ts  (npm run gen:regions)
--   guard:     scripts/regionSeed.test.ts
--
-- Edit regions.ts and regenerate. The guard test fails until you do, which
-- is the point: the engine and the database must never hold two different
-- opinions about how much a cubic foot of loblolly weighs.
--
-- Idempotent. Safe to re-run. Upserts by key and leaves user-created region
-- profiles (is_builtin = false) entirely alone.
--
-- CALIBRATION. The form class and green weight figures below are conventional
-- working values — adequate for a prototype and for relative comparison, but
-- not locally calibrated. A cruise delivered to a paying client should use
-- values fitted to local mill scale, and the report should state which set it
-- used. Green weight in particular enters the tons conversion linearly, so a
-- 10% error here is a 10% error in every pulpwood valuation downstream.
-- =============================================================================

-- Lake States / Northeast -----------------------------------------------
insert into timberforge.region_profile (
  id, name, log_rule, sawtimber_min_dbh, pulpwood_min_dbh,
  stump_height_ft, saw_top_dib, pulp_top_dib, is_builtin, owner_id
) values (
  'lake_states_northeast', 'Lake States / Northeast', 'international_quarter', 10, 4,
  1, 8, 4, true, null
)
on conflict (id) do update set
  name              = excluded.name,
  log_rule          = excluded.log_rule,
  sawtimber_min_dbh = excluded.sawtimber_min_dbh,
  pulpwood_min_dbh  = excluded.pulpwood_min_dbh,
  stump_height_ft   = excluded.stump_height_ft,
  saw_top_dib       = excluded.saw_top_dib,
  pulp_top_dib      = excluded.pulp_top_dib,
  updated_at        = now();

insert into timberforge.species
  (region_id, code, common_name, species_group, form_class, green_lb_per_cuft)
values
  ('lake_states_northeast', 'SM', 'Sugar maple', 'hardwood', 76, 56),
  ('lake_states_northeast', 'RM', 'Red maple', 'hardwood', 74, 50),
  ('lake_states_northeast', 'YB', 'Yellow birch', 'hardwood', 74, 57),
  ('lake_states_northeast', 'AB', 'American beech', 'hardwood', 72, 54),
  ('lake_states_northeast', 'RO', 'Northern red oak', 'hardwood', 75, 62),
  ('lake_states_northeast', 'WA', 'White ash', 'hardwood', 76, 52),
  ('lake_states_northeast', 'AS', 'Quaking aspen', 'hardwood', 74, 43),
  ('lake_states_northeast', 'RP', 'Red pine', 'softwood', 78, 45),
  ('lake_states_northeast', 'WP', 'Eastern white pine', 'softwood', 78, 36),
  ('lake_states_northeast', 'EH', 'Eastern hemlock', 'softwood', 76, 50)
on conflict (region_id, code) do update set
  common_name       = excluded.common_name,
  species_group     = excluded.species_group,
  form_class        = excluded.form_class,
  green_lb_per_cuft = excluded.green_lb_per_cuft,
  updated_at        = now();

-- Pacific Northwest -----------------------------------------------------
insert into timberforge.region_profile (
  id, name, log_rule, sawtimber_min_dbh, pulpwood_min_dbh,
  stump_height_ft, saw_top_dib, pulp_top_dib, is_builtin, owner_id
) values (
  'pacific_northwest', 'Pacific Northwest', 'scribner', 8, 5,
  1, 6, 4, true, null
)
on conflict (id) do update set
  name              = excluded.name,
  log_rule          = excluded.log_rule,
  sawtimber_min_dbh = excluded.sawtimber_min_dbh,
  pulpwood_min_dbh  = excluded.pulpwood_min_dbh,
  stump_height_ft   = excluded.stump_height_ft,
  saw_top_dib       = excluded.saw_top_dib,
  pulp_top_dib      = excluded.pulp_top_dib,
  updated_at        = now();

insert into timberforge.species
  (region_id, code, common_name, species_group, form_class, green_lb_per_cuft)
values
  ('pacific_northwest', 'DF', 'Douglas-fir', 'softwood', 80, 38),
  ('pacific_northwest', 'WH', 'Western hemlock', 'softwood', 78, 41),
  ('pacific_northwest', 'WRC', 'Western redcedar', 'softwood', 78, 27),
  ('pacific_northwest', 'SS', 'Sitka spruce', 'softwood', 78, 33),
  ('pacific_northwest', 'PP', 'Ponderosa pine', 'softwood', 78, 45),
  ('pacific_northwest', 'RA', 'Red alder', 'hardwood', 74, 46)
on conflict (region_id, code) do update set
  common_name       = excluded.common_name,
  species_group     = excluded.species_group,
  form_class        = excluded.form_class,
  green_lb_per_cuft = excluded.green_lb_per_cuft,
  updated_at        = now();

-- US South / Southeast --------------------------------------------------
insert into timberforge.region_profile (
  id, name, log_rule, sawtimber_min_dbh, pulpwood_min_dbh,
  stump_height_ft, saw_top_dib, pulp_top_dib, is_builtin, owner_id
) values (
  'us_south', 'US South / Southeast', 'doyle', 10, 5,
  0.5, 8, 3, true, null
)
on conflict (id) do update set
  name              = excluded.name,
  log_rule          = excluded.log_rule,
  sawtimber_min_dbh = excluded.sawtimber_min_dbh,
  pulpwood_min_dbh  = excluded.pulpwood_min_dbh,
  stump_height_ft   = excluded.stump_height_ft,
  saw_top_dib       = excluded.saw_top_dib,
  pulp_top_dib      = excluded.pulp_top_dib,
  updated_at        = now();

insert into timberforge.species
  (region_id, code, common_name, species_group, form_class, green_lb_per_cuft)
values
  ('us_south', 'LP', 'Loblolly pine', 'softwood', 78, 58),
  ('us_south', 'SP', 'Shortleaf pine', 'softwood', 78, 57),
  ('us_south', 'SLP', 'Slash pine', 'softwood', 78, 60),
  ('us_south', 'LLP', 'Longleaf pine', 'softwood', 80, 61),
  ('us_south', 'VP', 'Virginia pine', 'softwood', 76, 55),
  ('us_south', 'WO', 'White oak', 'hardwood', 74, 66),
  ('us_south', 'RO', 'Red oak', 'hardwood', 74, 64),
  ('us_south', 'YP', 'Yellow-poplar', 'hardwood', 76, 45),
  ('us_south', 'SG', 'Sweetgum', 'hardwood', 74, 55),
  ('us_south', 'HI', 'Hickory', 'hardwood', 72, 68),
  ('us_south', 'RM', 'Red maple', 'hardwood', 74, 50)
on conflict (region_id, code) do update set
  common_name       = excluded.common_name,
  species_group     = excluded.species_group,
  form_class        = excluded.form_class,
  green_lb_per_cuft = excluded.green_lb_per_cuft,
  updated_at        = now();

-- A species dropped from regions.ts is deliberately NOT deleted here. Any
-- code that has ever been tallied must stay resolvable or an old cruise stops
-- compiling — and a cruise that compiled once must compile identically
-- forever. Retiring a species is a separate, deliberate migration that has to
-- reckon with the existing tally rows.
