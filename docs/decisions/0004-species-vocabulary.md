# 0004 — Expand `SP_LIST` in LandForge rather than degrade the bridge

**Status:** Accepted; LandForge-side work pending · **Date:** 2026-09-07 ·
**Decided by:** Shayne

## Decision

LandForge's `SP_LIST` will be **expanded** to cover Pacific Northwest and Lake
States / Northeast species. TimberForge will not work around the gap by mapping
unrepresentable species to `"Other"`, and will not silently drop them.

## The gap

`SP_LIST` is a closed 13-value vocabulary, entirely Southern:

```
Loblolly pine, Shortleaf pine, Virginia pine, Eastern white pine, White oak,
Red oak, Yellow-poplar, Sweetgum, Red maple, Hickory, Mixed hardwood,
Mixed pine-hardwood, Other
```

Two of the three region profiles in `packages/forestry-core/src/regions.ts` —
`pacific_northwest` and `lake_states_northeast` — have **no representable
species** on the LandForge side. No Douglas-fir, no ponderosa pine, no western
hemlock, no spruce, no true fir. A non-Southern cruise cannot currently
round-trip.

`mapSpecies` returns **empty string** for anything it does not recognise — not
`"Other"`, not an error. Abbreviations (`"LP"`) and Latin binomials
(`"Pinus taeda"`) both return `""`. See
[`../shared/landforge-species.md`](../shared/landforge-species.md) for the
probe table.

## Why expand rather than work around

The two workarounds both destroy information at the boundary.

**Mapping unrepresentable species to `"Other"`** turns a Douglas-fir stand into
an unspecified stand. The volume is preserved but the species is gone, and
`"Other"` is a legitimate value with its own meaning — a genuine mixed-species
odd lot — so the bad data becomes indistinguishable from good data. There is no
later query that can separate them.

**Sending the raw species name and letting `mapSpecies` return `""`** is worse,
because an empty cell reads as *not measured* rather than *measured and
untranslatable*. The cruiser did the work; the pipeline lost it.

Expanding the vocabulary is the only option where the failure, if the expansion
is incomplete, is a **visible** missing name rather than a plausible wrong one.

## Consequences

Until the LandForge-side expansion lands, non-Southern cruises cannot export.
TimberForge itself is **unaffected** — regions are configuration rows and the
calculation engine never branches on species vocabulary. The limitation is at the
LandForge export boundary only.

TimberForge resolves species on its own side and sends an **exact `SP_LIST`
string** — never a raw field code, never a binomial. This means an unmapped
species surfaces as a decision at our boundary, where someone can see it, rather
than as an empty cell in LandForge.

## The expansion is not purely additive

This is the trap in the work. `SP_LIST` values have `CV_PRIOR`-style priors
attached via stand type, so adding a name changes how existing rows score, not
just what new rows can say. Two specific hazards:

- **"Northern red oak" may collapse into the existing "Red oak."** Adding both
  splits a category that currently has one prior, and existing rows do not
  retroactively re-sort themselves.
- **`lfStandType` must be checked** before adding any name that overlaps an
  existing entry.

The candidate list in `../shared/landforge-species.md` is explicitly labelled a
**proposal, not a mirror** — it has no authority until it exists in LandForge.
That labelling matters: it is the difference between the shared directory
recording what is true and recording what we would like to be true.

## What would make us revisit

If LandForge's product direction turns out to be Southern-only, the right move is
not to expand the vocabulary but to scope TimberForge's regions to match — and
to say so, rather than shipping regions that cannot export.
