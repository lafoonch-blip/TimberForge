# 0009 — Stratum as a first-class entity

**Status:** Accepted
**Date:** 2026-09-10
**Supersedes in part:** the implicit "stand is the only grouping level" assumption in the current schema
**Related:** `CONTEXT.md` §7, `PRD.md` data model,
`0002-mvp-cruise-methods.md`, `0008-persistent-forest-assets.md`

---

## Decision

A **stratum is a sampling and merchantability
definition**, not a place. It is defined once per cruise and applied across one or more geographic
areas.

This separates two things the current schema conflates in `stand`:

| Concept | What it is | Carries |
|---|---|---|
| **Stand** (geographic) | A place on the ground | name, acres, boundary geometry |
| **Stratum** (sampling) | *How* trees in that place are measured and what counts as merchantable | name, abbreviation, product, DBH range, cruise method, BAF or plot size, nesting |

A **plot belongs to both**: it sits in a stand and is measured under a stratum.

---

## Stratum definition

| Field | Type | Rules |
|---|---|---|
| `name` | text, required | e.g. "Pine upland" |
| `abbreviation` | text(2), optional | Shown on stratum tabs during tally and in every report table. It is a real identity that follows the stratum everywhere, not a label |
| `product` | enum `sawlog \| biomass`, required | Controls whether board-foot volume is computed and reported at all |
| `min_dbh_in` | numeric, nullable | Null = inherit the cruise-level minimum. Sawlog has no upper bound |
| `max_dbh_in` | numeric, nullable | Biomass strata use a bounded range (e.g. 3–10") |
| `method` | enum `variable_radius \| fixed_area`, **required, no default** | See §"Method has no default" |
| `baf` | numeric, nullable | Required iff `method = variable_radius`, null otherwise |
| `plot_acres` | numeric, nullable | Required iff `method = fixed_area`, null otherwise |
| `nested_in_stratum_id` | fk → stratum, nullable | Non-null means this stratum is sampled **at another stratum's plot points**. It keeps its own BAF or plot size |

Constraints:
- `(baf is not null) <> (plot_acres is not null)`, matching the existing plot-level constraint
- `check (max_dbh_in is null or min_dbh_in is null or max_dbh_in > min_dbh_in)`
- `nested_in_stratum_id` must reference a stratum in the same cruise; no cycles; **one level of
  nesting only** for now
- `unique (cruise_id, name)` and `unique (cruise_id, abbreviation)` where abbreviation is non-null

### Method has no default — and it blocks

Copy this behaviour exactly. A stratum with no cruise method cannot be saved past the design step,
and the validation message explains *why*, naming the offending stratum:

> Every stratum needs a cruise method — it sets how each tree expands to per-acre volume.
> There is no default.

The method is the method of record for volume expansion. Silently defaulting it is how a cruise
gets compiled against an expansion factor nobody chose.

---

## What moves, and from where

**Method, BAF and plot size move from `plot` up to `stratum`.**

Today `plot` carries `method` + `baf`/`plot_acres`, and the QA engine has a rule that flags mixed
methods or mixed BAFs inside one stand. After this change that error is **structurally
impossible** — every plot inherits its expansion parameters from its stratum. Keep the QA rule as a
defensive check against bad imports; it should now never fire on data the app itself created.

**Product class stays on the tree.** TimberForge's `ProductClass`
(`sawtimber / chip_n_saw / pulpwood / veneer / pole / cull`) is deliberately fine-grained
and describes what an individual stem *is*. `stratum.product` is a different question — it decides
whether this stratum produces board feet at all. Both exist; they are not the same field.

**Minimum DBH gets an explicit precedence chain**, stated on both screens where the conflict is
visible:

```
stratum.min_dbh_in  →  cruise.min_sawlog_dbh_in  →  region_profile minimum
```

---

## Stand ↔ stratum is many-to-many

A cruise defines its strata once. Stands are then **assigned to one or more strata**. A stand in
two strata gets two sets of plots.

```
cruise ──< stratum
cruise ──< stand
              stand_stratum (stand_id, stratum_id, planned_plots)
                                  │
                                plot (stand_id, stratum_id, number, …)
                                  │
                                tree
```

`planned_plots` lives on the join row, not on the stratum — the same stratum can warrant 40 plots
in a 200-acre stand and 6 in a 20-acre one. Planned plots are set when a stand is added to a
stratum.

`plot.number` is unique per `(stand_id, stratum_id)`, not per stand.

---

## Nesting

A nested stratum is sampled at its parent's plot points. Concretely: a biomass stratum nested in a
sawtimber stratum means that at each sawtimber point the cruiser also runs a biomass count, using
the biomass stratum's own BAF.

- Nested plots share the parent plot's location and plot number
- The nested stratum keeps its own BAF or plot size
- **Acreage is not additive across a nesting pair.** A nested stratum covers the same ground as its
  parent. Cruise-level totals must sum acreage over *stands*, never over strata, or a nested cruise
  double-counts its own acres. The nested case must be handled correctly from the start. **This is the single most
  likely place to introduce a silent arithmetic error.** Add a QA rule.

---

## Compilation and statistics

`compileCruise` currently computes `sampleStatistics` per stand and weights to a cruise total by
acres. After this change the expansion order becomes:

```
tree → plot → (stand × stratum) → stratum → cruise
```

- Statistics are computed **across plots within a (stand × stratum)**, never across trees — the
  existing discipline is unchanged, only the grouping key widens
- **Stratified error** is the acreage-weighted combination across strata; report it alongside the
  simple pooled error so the value of stratifying is visible
- A **biomass stratum reports no board feet**. It reports trees, TPA, BA/acre, QMD and height, and
  is excluded from the sale total. Reporting `0 MBF` for a biomass stratum is wrong; reporting an
  em-dash is right
- Per-stratum results carry the same `EngineStamp` discipline as today
- Because a stratum's `min_dbh_in` is part of what produced a number, it must be included in the
  frozen `Compilation` snapshot

---

## Why adopt someone else's model

Because it is the correct decomposition and it is already validated in the field. Merchantability
rules and sampling design vary independently of geography — a 40-acre stand can hold a sawlog
stratum and a biomass stratum at once, and the same sawlog definition can span five stands. A model
where "stand" means both a place and a sampling rule cannot express either case without duplication.

`PRD.md` already names Stratum between Cruise and Plot. This reconciles the code to the PRD rather
than changing the intent.

---

## Consequences

**Good**
- Mixed-method-within-a-stand becomes unrepresentable rather than merely detected
- Biomass and sub-merchantable material become expressible, which the Piedmont thinning market
  needs (see gap analysis §3)
- Stratified sampling error becomes computable, which is the main statistical reason to stratify
- Closes the doc-vs-code divergence flagged in `STRATEGY_RECONCILIATION.md`

**Costs**
- Schema migration touching `plot`; a new `stratum` table and a `stand_stratum` join
- `compileCruise` regroups by `(stand, stratum)` — mechanically contained, but the acreage-weighting
  path needs care around nesting
- The cruise-creation flow gains a step: define strata before adding stands
- Existing cruises migrate to a single implicit stratum per stand, carrying that stand's current
  method and BAF, `product = sawlog`, `min_dbh_in = null`

**Deferred, deliberately**
- More than one level of nesting
- Per-stratum species subsets
- `tally` and `100% measure` methods — `0002` keeps the method enum closed at two values, and this
  decision does not reopen it. The `method` column is where they would land if that ever changes

---

## Open

- Does a stratum's plot numbering restart per stand, or run continuously across the cruise?
  Either way, gaps and overruns against the planned count (e.g. "Plot 75 of 71") must be
  tolerated and shown, not blocked.
- Should `stratum` outlive a cruise as a reusable template? Related to `0008`; not decided here.
