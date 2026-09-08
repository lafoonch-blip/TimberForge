-- =============================================================================
-- 0003  Compilations, QA snapshots, and the predicted-vs-actual record
-- =============================================================================
--
-- ADDITIVE ONLY. Touches nothing outside the `timberforge` schema.
--
-- -----------------------------------------------------------------------------
-- THE GOVERNING IDEA: A COMPILATION IS A DOCUMENT, NOT A QUERY
-- -----------------------------------------------------------------------------
--
-- Everything so far has been field data, which changes: a cruiser fixes a
-- mis-keyed DBH, re-walks a plot, corrects an acreage. That is right and normal.
--
-- A compilation is different in kind. It is the numbers that were handed to a
-- client on a specific day, over somebody's signature, and possibly relied on in
-- a timber sale. Six months later the only questions that matter are "what did
-- the report say" and "how was it produced" — and both must be answerable
-- exactly, from the database, without re-running anything.
--
-- If a compilation were recomputed on read, three separate things could move
-- underneath it without anybody touching the report:
--
--   * the field data     — a later correction to a tree row
--   * the engine         — a fixed bug in the volume equations
--   * the region profile — a recalibrated green weight, upserted by a seed
--
-- Any of the three would silently change what the report "says" it said. So a
-- compilation stores its own results, its own engine version, AND a frozen copy
-- of the region profile it used. It is written once and never updated: revision
-- is expressed by inserting a new row that points at the one it replaces, which
-- keeps the entire lineage of what was told to the client and when.
--
-- The UPDATE block is enforced by trigger rather than by permissions, because
-- permissions are for people and this rule applies to the service role too.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Immutability
-- -----------------------------------------------------------------------------

create or replace function timberforge.forbid_update()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Table %.% is append-only. Insert a new row referencing this one via '
    'supersedes_id instead of updating it.',
    tg_table_schema, tg_table_name
    using errcode = 'restrict_violation',
          hint = 'A delivered compilation is a record of what a client was '
                 'told. Rewriting it destroys the audit trail that makes the '
                 'cruise defensible.';
end;
$$;

comment on function timberforge.forbid_update() is
  'Blocks UPDATE on append-only tables for every role including service_role. '
  'Correction happens by supersession, never by mutation.';

-- -----------------------------------------------------------------------------
-- Compilations
-- -----------------------------------------------------------------------------

create table timberforge.compilation (
  id                uuid primary key default gen_random_uuid(),
  cruise_id         uuid not null references timberforge.cruise (id) on delete cascade,

  -- Lineage. Null for the first compilation of a cruise; otherwise the row this
  -- one replaces. Chains, so the full revision history is walkable.
  supersedes_id     uuid references timberforge.compilation (id),

  -- REPRODUCIBILITY TRIO ------------------------------------------------------
  -- Together these answer "how was this number produced" without re-running.

  -- e.g. 'tf-calc-v0.1.0-vrp-fixed-formclass'. Matches CALC_ENGINE_VERSION in
  -- @timberforge/forestry-core. A compilation produced by a different engine
  -- version is a different document even from identical field data.
  calc_engine_version text not null,

  -- The log rule actually applied. Doyle and Scribner disagree by ~30% on small
  -- diameters, so this is a term of the deliverable, not a display preference.
  log_rule            timberforge.log_rule not null,

  -- Frozen copy of the region profile and species library as they stood at
  -- compile time. NOT a foreign key to the live rows: 0002 upserts region
  -- profiles, so a later calibration correction would otherwise retroactively
  -- change what this report is recorded as having used.
  region_snapshot     jsonb not null,
  -- ---------------------------------------------------------------------------

  confidence_level  numeric(4,3) not null check (confidence_level in (0.90, 0.95)),

  -- The full CruiseResult from compileCruise(). Authoritative.
  result            jsonb not null,

  -- Denormalized headline scalars, lifted out of `result` purely so that
  -- portfolio queries and the predicted-vs-actual view do not have to traverse
  -- jsonb. `result` remains the source of truth if the two ever disagree.
  total_acres              numeric(12,3) not null check (total_acres > 0),
  total_net_mbf            numeric(14,3) not null check (total_net_mbf >= 0),
  total_net_green_tons     numeric(14,3) not null check (total_net_green_tons >= 0),
  weighted_net_mbf_per_acre numeric(10,4) not null check (weighted_net_mbf_per_acre >= 0),
  weighted_basal_area_per_acre numeric(10,3) not null check (weighted_basal_area_per_acre >= 0),
  weighted_trees_per_acre  numeric(10,2) not null check (weighted_trees_per_acre >= 0),

  -- Worst (largest) sampling error across stands, as a percent of the mean.
  -- Null when no stand had two or more plots — which is itself worth recording,
  -- because it means no error could be computed at all.
  max_sampling_error_pct   numeric(6,2) check (max_sampling_error_pct >= 0),
  plot_count               integer not null check (plot_count >= 0),

  -- Set when this compilation was actually issued to a client. A compilation
  -- with a delivered_at is the one that has to survive scrutiny.
  delivered_at      timestamptz,
  delivered_note    text,

  compiled_by       uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),

  constraint compilation_not_self_superseding check (id <> supersedes_id)
);

comment on table timberforge.compilation is
  'Append-only. One row per time a cruise was compiled. Stores its own results, '
  'engine version and a frozen region profile so the document can be '
  'reconstructed exactly, years later, regardless of what has changed since.';
comment on column timberforge.compilation.region_snapshot is
  'Frozen region profile + species library. Deliberately not a foreign key: the '
  'seed migration upserts live profiles, and a recalibration must not rewrite '
  'history.';
comment on column timberforge.compilation.max_sampling_error_pct is
  'Null means no stand had enough plots to compute one. That is a materially '
  'different statement from zero, and the report must not print 0%.';

create trigger compilation_no_update
  before update on timberforge.compilation
  for each row execute function timberforge.forbid_update();

create index compilation_cruise_idx
  on timberforge.compilation (cruise_id, created_at desc);
create index compilation_delivered_idx
  on timberforge.compilation (cruise_id, delivered_at desc)
  where delivered_at is not null;
-- At most one live successor per compilation, so the lineage stays a chain
-- rather than branching into two competing histories.
create unique index compilation_single_successor_idx
  on timberforge.compilation (supersedes_id)
  where supersedes_id is not null;

-- Convenience: the newest compilation for each cruise.
create view timberforge.latest_compilation as
select distinct on (cruise_id) *
from timberforge.compilation
order by cruise_id, created_at desc;

comment on view timberforge.latest_compilation is
  'Newest compilation per cruise. Note this is not necessarily the DELIVERED '
  'one — a draft recompile after delivery appears here. Reports that must match '
  'what the client holds should filter on delivered_at.';

-- -----------------------------------------------------------------------------
-- QA findings
-- -----------------------------------------------------------------------------
-- QA never mutates field data; it flags. Only the cruiser knows whether a 42"
-- loblolly is a mis-key or a legacy yard tree, so the resolution of a finding is
-- a human act and is recorded as one.

create type timberforge.qa_severity as enum ('error', 'warning', 'info');

comment on type timberforge.qa_severity is
  'Severity is about consequence, not confidence. Only `error` blocks release. '
  'A warning may well be correct data.';

create table timberforge.qa_finding (
  id             uuid primary key default gen_random_uuid(),
  cruise_id      uuid not null references timberforge.cruise (id) on delete cascade,
  -- Null when the finding was raised during a live field session rather than at
  -- compile time. Both are worth keeping: the field ones show what the cruiser
  -- saw in time to fix it.
  compilation_id uuid references timberforge.compilation (id) on delete cascade,

  code           text not null,          -- e.g. 'TREE_IMPLAUSIBLE_TAPER'
  severity       timberforge.qa_severity not null,
  scope          text not null,          -- 'tree' | 'plot' | 'stand' | 'cruise'
  message        text not null,
  remedy         text,
  value          numeric,

  -- Deliberately NOT foreign keys. A finding frequently concerns a row that was
  -- subsequently deleted — that is often precisely the remedy — and the finding
  -- must survive as evidence that the problem was seen and dealt with.
  tree_id        uuid,
  plot_id        uuid,
  stand_id       uuid,

  -- Acknowledgement: a cruiser confirming "yes, that really is a 42-inch tree".
  acknowledged_at   timestamptz,
  acknowledged_by   uuid references auth.users (id) on delete set null,
  acknowledgement_note text,

  created_at     timestamptz not null default now(),

  constraint qa_ack_has_note check (
    acknowledged_at is null or acknowledgement_note is not null
  )
);

comment on constraint qa_ack_has_note on timberforge.qa_finding is
  'Dismissing a finding requires saying why. An unexplained override is '
  'indistinguishable from clicking through a dialog, and the note is what makes '
  'the override defensible later.';

create index qa_finding_cruise_idx on timberforge.qa_finding (cruise_id, severity);
create index qa_finding_open_idx on timberforge.qa_finding (cruise_id)
  where acknowledged_at is null;

-- -----------------------------------------------------------------------------
-- Predictions — the point of the whole exercise
-- -----------------------------------------------------------------------------
-- TimberForge exists partly so that LandForge's timber model can be trained on
-- ground truth. That requires the prediction to be recorded BEFORE the cruise,
-- frozen, and never adjusted afterwards. A prediction written or amended after
-- the field data is in hand is not a prediction; it is a fit, and scoring a
-- model against it is self-congratulation.
--
-- Hence: append-only, with a CHECK that the model version is recorded and a
-- predicted_at that the application sets from the pre-cruise moment.

create table timberforge.prediction (
  id                 uuid primary key default gen_random_uuid(),
  cruise_id          uuid not null references timberforge.cruise (id) on delete cascade,
  stand_id           uuid references timberforge.stand (id) on delete cascade,

  -- Which model produced this. Without it, an accuracy score aggregates across
  -- model generations and means nothing.
  model_version      text not null,
  -- Where the inputs came from: 'landforge', 'nlcd', 'lidar', 'operator', ...
  input_source       text not null,

  predicted_mbf_per_acre    numeric(10,4) check (predicted_mbf_per_acre >= 0),
  predicted_tons_per_acre   numeric(10,3) check (predicted_tons_per_acre >= 0),
  predicted_basal_area      numeric(10,3) check (predicted_basal_area >= 0),
  predicted_stand_age_years numeric(5,1)  check (predicted_stand_age_years >= 0),
  predicted_site_index      numeric(5,1)  check (predicted_site_index > 0),
  predicted_species_mix     jsonb,

  -- Self-reported model confidence, 0-100.
  confidence         numeric(5,2) check (confidence between 0 and 100),
  provenance         timberforge.provenance not null default 'predicted',

  -- The pre-cruise instant. Compared against the cruise's field dates by the
  -- view below, which refuses to score a "prediction" made after the fact.
  predicted_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),

  constraint prediction_is_not_measured
    check (provenance in ('predicted', 'estimated', 'defaulted', 'computed'))
);

comment on table timberforge.prediction is
  'Pre-cruise model output, frozen. Append-only. A prediction amended after the '
  'field data arrives is a fit, not a prediction, and scoring against it would '
  'flatter the model.';
comment on constraint prediction_is_not_measured on timberforge.prediction is
  'A prediction can never carry provenance `measured`. If it were measured it '
  'would not be a prediction, and it would contaminate the accuracy scoring '
  'with a perfect result.';

create trigger prediction_no_update
  before update on timberforge.prediction
  for each row execute function timberforge.forbid_update();

create index prediction_cruise_idx on timberforge.prediction (cruise_id);
create index prediction_stand_idx on timberforge.prediction (stand_id);
create index prediction_model_idx on timberforge.prediction (model_version);

-- -----------------------------------------------------------------------------
-- Predicted vs actual
-- -----------------------------------------------------------------------------
-- Joins each frozen prediction to the measured result for the same stand.
--
-- Two things this view does that a naive version would not:
--
--   * It reports `error_is_scoreable = false` rather than dropping the row when
--     the prediction post-dates the compilation. Silently excluding those rows
--     would hide a data-collection problem; surfacing them makes it visible.
--
--   * It exposes sampling error alongside the residual. A 30% miss against a
--     cruise that itself carries 25% sampling error is not evidence the model is
--     wrong — it is evidence the ground truth is thin. Scoring without that
--     column invites the model to be blamed for the cruise's imprecision.

create view timberforge.predicted_vs_actual as
select
  p.id                        as prediction_id,
  p.cruise_id,
  p.stand_id,
  p.model_version,
  p.input_source,
  p.predicted_at,
  p.confidence                as predicted_confidence,

  c.id                        as compilation_id,
  c.calc_engine_version,
  c.created_at                as compiled_at,
  c.delivered_at,

  s.name                      as stand_name,
  s.acres                     as stand_acres,

  p.predicted_mbf_per_acre,
  (stand_result ->> 'netMbfPerAcre')::numeric      as actual_mbf_per_acre,
  p.predicted_basal_area,
  (stand_result ->> 'basalAreaPerAcre')::numeric   as actual_basal_area,
  p.predicted_tons_per_acre,
  (stand_result ->> 'netGreenTonsPerAcre')::numeric as actual_tons_per_acre,

  -- Signed residual. Positive means the model over-predicted.
  p.predicted_mbf_per_acre - (stand_result ->> 'netMbfPerAcre')::numeric
                              as mbf_residual,

  -- Percent error, guarded against a zero actual. A stand that genuinely
  -- compiled to zero volume has no meaningful percent error, and dividing
  -- anyway would produce an infinity that poisons every aggregate built on it.
  case
    when coalesce((stand_result ->> 'netMbfPerAcre')::numeric, 0) = 0 then null
    else 100 * (p.predicted_mbf_per_acre - (stand_result ->> 'netMbfPerAcre')::numeric)
         / (stand_result ->> 'netMbfPerAcre')::numeric
  end                         as mbf_error_pct,

  -- The cruise's own precision, for context. See the note above.
  (stand_result -> 'statistics' -> 'netBoardFeetPerAcre' ->> 'samplingErrorPct')::numeric
                              as actual_sampling_error_pct,
  (stand_result ->> 'plotCount')::int as actual_plot_count,

  -- False when the "prediction" was recorded after the compilation existed.
  (p.predicted_at <= c.created_at) as error_is_scoreable

from timberforge.prediction p
join timberforge.stand s
  on s.id = p.stand_id
join timberforge.latest_compilation c
  on c.cruise_id = p.cruise_id
cross join lateral jsonb_array_elements(c.result -> 'stands') as stand_result
where p.stand_id is not null
  and stand_result ->> 'standId' = p.stand_id::text;

comment on view timberforge.predicted_vs_actual is
  'Frozen predictions joined to measured results. Always filter on '
  'error_is_scoreable before computing model accuracy — rows where the '
  'prediction post-dates the compilation are retained deliberately, so that a '
  'broken collection order is visible rather than silently dropped.';
