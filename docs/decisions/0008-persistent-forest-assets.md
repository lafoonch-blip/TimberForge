# 0008 — Persistent forest assets, not cruise files

**Status:** Accepted, implementation pending · **Date:** 2026-09-09

## Decision

A cruise is an **event that measures a forest**. It is not the object the schema
is organised around.

The durable entities are the **property** and the **stand**. They outlive any
single engagement, accumulate history, and carry an **inventory** — the current
best estimate of what is standing — which a completed cruise updates rather than
replaces. Plots and trees remain children of the cruise, because a plot only
means anything in the context of the cruise design that placed it.

Target hierarchy:

```
organization → property → stand → inventory → cruise → plot → tree/log
                          └── stand_event  (treatment, thinning, harvest,
                                            regeneration, disturbance, inspection)
```

## Why this is being decided now

The product documents already describe this hierarchy. `PRD.md:500–516` and
`CONTEXT.md:440–453` both run Organization → Property → Stand → Cruise → Stratum
→ Plot → Tree.

The schema does not. In
[`0001_timberforge_schema.sql`](../../supabase/migrations/0001_timberforge_schema.sql):

```sql
create table timberforge.stand (
  id        uuid primary key,
  cruise_id uuid not null references timberforge.cruise (id) on delete cascade,
```

A stand belongs to one cruise and is **deleted with it**. Cruising the same
tract next year produces a second, unrelated stand row with no relationship to
the first. Every row-level security policy in
[`0005_rls.sql`](../../supabase/migrations/0005_rls.sql) then resolves through
`can_read_cruise(cruise_id)`, so cruise membership defines not just permission
but *reachability*.

That is a cruise-file architecture wearing a hierarchy's clothes, and the gap
between the documents and the code went unnoticed because nothing has been
deployed to compare them against.

**The timing is the point.** No migration has run against a live database. The
change is a rewrite of files that currently exist only as text — hours of work.
After the first production run it means a data migration, on a schema shared
with a live LandForge, under the no-undo constraint described in
[`0001`](0001-supabase-topology.md). The cost curve here is unusually steep and
we are standing at the cheap end of it.

## What changes

**`stand` loses `cruise_id` and gains `property_id`.** A stand is a piece of
ground with a boundary, not a line item in an engagement. Its
`boundary_geojson` column already exists and already anticipates a later
generated PostGIS column, so the spatial groundwork holds.

**A `property` table appears.** Today the only thing resembling a tract is
`parcel_link`, which hangs off a cruise and requires a LandForge parcel id
(`0004_landforge_bridge.sql:61`, `not null`). That makes a property something
you cannot record without LandForge — see `0008` implications below.

**An `inventory` table appears** between stand and cruise: the current state of
a stand as of a date, with the cruise that produced it. A new cruise writes a
new inventory row and supersedes the previous one; nothing is overwritten, so
"what did we believe in 2027, and on what evidence?" stays answerable.

**A `stand_event` table appears** for treatments, thinnings, harvests,
regeneration, disturbances and inspections — the temporal dimension that is
currently absent from the schema *and* from both product documents.

**RLS re-roots.** Read paths resolve through property access rather than cruise
membership. `can_read_cruise` remains, but as a narrower check for cruise-scoped
rows rather than the universal gate.

## What does not change

Plot and tree stay under cruise. `timber_feed` stays as it is — it is the
push-back channel and is correctly cruise-scoped
([`0007`](0007-landforge-metrics-surface.md)).

The MVP does not gain inventory management as a *feature*. It ships with a
single inventory per stand and no history UI. This record is about the shape of
the tables, not the shape of the product — the distinction that keeps
"architect for enterprise, build for the small forester" from becoming an excuse
to build everything.

## The constraint that must survive the change

`CONTEXT.md:455–464` and `PRD.md:518–525` require that **predicted and measured
values are stored separately, each with provenance** — source, date, user,
method, confidence, and whether the value is predicted, user-entered or
field-measured. The provenance ladder is `measured > computed > estimated >
predicted > defaulted`.

An inventory that merges a cruise result into a single current-state row is the
obvious way to destroy this. If a field measurement overwrites a pre-cruise
prediction in place, the predicted-versus-actual comparison — the ground-truth
loop that is the product's main strategic asset — loses its left-hand column.

**Inventory rows carry provenance per field and never overwrite a prediction.**
The prediction remains addressable after the cruise that tested it.

## Implications for the LandForge coupling

`parcel_link.landforge_parcel_id` is `not null`, so a tract cannot presently
exist without a LandForge parcel. That contradicts the requirement that
TimberForge create standalone value for professional forestry customers, and it
becomes untenable once `property` is a first-class entity.

`property` owns identity; the LandForge parcel link becomes **optional
enrichment** on the property, not a precondition for it. Geometry is still never
copied ([`0001`](0001-supabase-topology.md)).

## What was considered and rejected

**Leave it and add persistence later.** Rejected on cost asymmetry alone. The
same change costs hours now and a live-database migration later, and the
argument for deferring — that MVP does not need inventory management — is an
argument about *features*, which this record does not propose building.

**Keep `stand.cruise_id` and add a separate persistent stand.** Two stand
concepts, and every later question becomes "which stand?". The duplication would
be permanent.

**Adopt LandForge's organization model to supply the top of the hierarchy.**
Rejected in `FOUNDATION.md` §2 because cruise crews form per-job and dissolve,
and that reasoning still holds. Note the live tension: the new hierarchy names
`organization` at its root, while
[`0007`](0007-landforge-metrics-surface.md) anchored consent to the individual
forester *specifically because* no durable organization exists. If a real
organization entity is introduced for enterprise (roadmap Phase 5), `0007`'s
consent anchor must be revisited — it was a resolution to an absence, not a
preference.

## What would make us revisit

Evidence from customer discovery that foresters do not think in persistent
stands — that each engagement genuinely is a fresh assessment and prior stand
boundaries are more often re-drawn than reused. That would make the temporal
model expensive scaffolding around a use case nobody has. `INTERVIEW_KIT.md` Q1
and Q10 should be listened to for it.
