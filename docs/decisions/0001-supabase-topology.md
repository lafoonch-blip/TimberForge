# 0001 — One Supabase project, separate schema, parcels shared by foreign key

**Status:** Accepted · **Date:** 2026-09-07

## Decision

TimberForge lives in the **same Supabase project** as LandForge, in its **own
`timberforge` schema**. It does not create, alter, or drop anything in `public`.
Parcels are **referenced by foreign key**, never copied.

## Forces

LandForge is live and has paying use. Anything TimberForge does that can damage
it is a real cost, not a hypothetical one. At the same time, the two products
genuinely share one entity — the parcel — and share one set of users, who should
not have to hold two accounts.

Three options were on the table.

**A second Supabase project** would have given perfect blast-radius isolation,
and was rejected because it splits `auth`. Two projects means two user tables,
which means either federating identity or asking a forester to log in twice.
It also makes the parcel relationship impossible to express as a constraint —
it becomes an application-level convention, which is another way of saying it
becomes wrong eventually.

**Copying parcel geometry into `timberforge`** was rejected on two counts. It
pays twice for the same acreage and ownership lookups, which are metered. And it
creates two copies that diverge the first time a boundary is corrected on the
LandForge side, with no mechanism to notice. A foreign key plus a join costs
nothing and cannot drift.

**Tables in `public` alongside LandForge's** was rejected because it removes the
one cheap safety property we can have: a schema boundary makes "did TimberForge
touch LandForge?" answerable by inspection rather than by reading every migration.

## Consequences

The `timberforge` schema is not on Supabase's exposed-schema list by default, so
it is invisible to PostgREST until someone adds it. This is called out in
`supabase/migrations/0004_landforge_bridge.sql` as an operator note rather than
being silently worked around, because the workaround (putting tables in `public`)
is the thing this decision exists to prevent.

The parcel foreign key in `0004` binds **conditionally**. It locates the parcel
table by configured name, verifies the key is a `uuid`, and **skips with a
printed list of candidates** if it cannot positively identify the table. It
does not attach to something that merely looks plausible. A wrong bind would
join cruises to the wrong parcels and every downstream number would be quietly
incorrect — the worst failure mode available to us, because it produces
confident output.

That FK is currently in skip mode against the real project, because the parcel
schema has not been captured. See [`../shared/parcel.md`](../shared/parcel.md).

## What would make us revisit

If LandForge and TimberForge ever need independent scaling, backup schedules, or
compliance boundaries, the shared project stops being an asset. The migration
path is a separate project with a replicated parcel table and federated auth,
and it gets meaningfully harder the more `timberforge` tables come to depend on
joins into `public`. Keeping those joins to **parcel identity only** is what
preserves the option.
