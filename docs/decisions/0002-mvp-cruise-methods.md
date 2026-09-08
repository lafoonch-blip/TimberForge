# 0002 — Ship variable-radius and fixed-area plots only

**Status:** Accepted · **Date:** 2026-09-07

## Decision

`CruiseMethod` is a closed two-value union: `'variable_radius' | 'fixed_area'`.
Strip cruises, 100% tallies, and remote/imagery-based estimation are out of scope
for the MVP and are **not** represented as unimplemented enum members.

## Forces

These two methods cover the large majority of operational timber cruising in the
markets TimberForge targets first. Variable-radius (point sampling with a basal
area factor) is the workhorse for merchantable timber; fixed-area plots are what
you fall back to for regeneration, small stems, and anywhere the prism gets
unreliable.

The temptation was to define the full enum now — `'strip'`, `'full_tally'` — and
throw on the unimplemented cases. That was rejected. An enum member that exists
but throws is worse than one that does not exist: it typechecks at every call
site, appears in autocomplete, gets stored in a database column, and fails at
runtime in the field, offline, on someone's phone, three miles from the truck.
A union that omits the value fails at compile time on the developer's machine
instead.

The expansion logic reinforces this. `expansion.ts` branches on method and
demands the corresponding parameter — a positive BAF for variable-radius, a
positive `plotAcres` for fixed-area — and throws a plot-identifying error when
it is absent. Each method carries a different expansion factor and a different
correct way to be wrong. Adding a method is not adding a label; it is adding a
branch that has to be right.

## Consequences

Both methods are supported **per plot**, not per cruise. A single cruise can mix
them, which is what real cruisers do when a stand has a merchantable overstory
and a regeneration component that point sampling will not capture.

The database column storing method should be a text column with a check
constraint rather than a Postgres enum, so that adding a method later is a
migration and not a type rewrite — but the TypeScript union stays closed, so the
compiler still finds every site that needs to handle the new case.

## What would make us revisit

A customer whose standard practice is strip cruising, or a regulatory context
requiring 100% tally. Either is a real reason. "It would be more complete" is
not — completeness in a field app is paid for in bugs that surface where nobody
can fix them.
