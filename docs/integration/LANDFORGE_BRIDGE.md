# The LandForge bridge — TimberForge's side

**Owner: TimberForge.** This document is our *interpretation* of LandForge's
contract and is freely editable here. The facts it interprets live in
[`../shared/`](../shared/) and are **not** editable here — that directory is a
mirror. See [`../decisions/0005-shared-context-ownership.md`](../decisions/0005-shared-context-ownership.md).

Keeping these apart matters. `docs/shared/landforge-constants.md` says what
LandForge *does*. This file says what we have *decided to do about it*. Merging
them would make our reasoning indistinguishable from LandForge's behaviour, and
the first person to update one would silently rewrite the other.

## The seam, in one paragraph

TimberForge measures timber and produces per-acre values with real statistical
error bars. LandForge scores parcels before anyone walks them. The bridge sends a
completed cruise into LandForge so that a parcel's pre-cruise estimate can be
replaced by measurement — and, more valuably over time, so the pre-cruise model
can be checked against what the cruise actually found.

## Current state: the adapter does not run

`ADAPTER_VERIFIED` in `packages/landforge-contract/src/adapter.ts` is **`false`**,
and the export path throws while it is false. This is deliberate and should stay
until the open questions are closed.

The adapter was written against `LF_ASSUMPTIONS` — a set of sentinel defaults
inferred from LandForge's *documented* behaviour before we had read the running
application. We have since read the running application, and the real intake
contract is the `na-*` form-field vocabulary recorded in
[`../shared/landforge-cruise-intake.md`](../shared/landforge-cruise-intake.md).
Those are not the same contract.

What this means concretely, and what needs to change:

- `assumptions.ts` is built on `LF_ASSUMPTIONS`, which we invented. It needs to
  be rewritten against observed values, dropping the invented sentinels.

  | Assumed (wrong) | Actual |
  |---|---|
  | `LF_ASSUMPTIONS` (one object) | `CV_PRIOR`, `FIXED_TOL`, `FIELD_WEIGHT`, `T90` — four separate top-level bindings |
  | `defaultStandAge` | `FIXED_TOL.stand_age` |
  | `defaultSiteIndex` | `FIXED_TOL.site_index` |
  | `defaultMillDistanceMi` | **no equivalent** — mill distance is not in this model at all |
  | camelCase field names generally | `snake_case`: `mbf_per_acre`, `basal_area`, `tpa`, `tons_per_acre`, `forested_acres`, `site_index`, `stand_age` |

  Note the third row. `millScore` and mill distance appear nowhere in the beta
  script, so the adapter's mill-distance mapping currently maps to nothing.
- `millDistanceMi` appears in the adapter's field map and in `confidence.ts`.
  Mill distance is **not** a cruise intake field. It belongs to the pre-cruise
  scoring model, per
  [`../decisions/0003-pre-and-post-cruise-scoring.md`](../decisions/0003-pre-and-post-cruise-scoring.md),
  and does not travel with a cruise.
- The adapter emits camelCase LandForge field names. The real intake takes
  `na-*` DOM field ids. The payload shape is wrong, not just the values.

The adapter is currently a **plan** for talking to LandForge, not a working
client. It is retained rather than deleted because its field-by-field notes
record why each mapping was proposed, which is the input to fixing it.

## What we send, and in what units

The single most dangerous detail in the whole bridge is units.

LandForge's intake takes **totals** at the form, and works in **per-acre**
internally. TimberForge computes **per-acre** natively, because that is what a
cruise produces. So there is a conversion at the boundary, and the divisor is
**not yet confirmed** — the candidates are `na-fac` (forested acres) and `na-op`
(the other acreage field). See
[`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md#1-which-acreage-divides-total-into-per-acre).

This is exactly the kind of question that would previously have been resolved by
picking the more plausible one. It is not being resolved that way. A wrong
divisor produces numbers that are wrong by the ratio of two acreages — typically
a factor between 1.0 and 2.0, which is small enough to look like a plausible
timber estimate and large enough to misprice a tract.

Until it is answered, the adapter stays off.

## Species

TimberForge resolves species internally and emits an **exact `SP_LIST` string**.
Never a field code, never a Latin binomial. `mapSpecies` returns `""` — not
`"Other"` and not an error — for anything it does not recognise, so sending a raw
value produces a silently empty cell.

Resolving on our side converts that silent failure into a visible decision at our
own boundary. See
[`../decisions/0004-species-vocabulary.md`](../decisions/0004-species-vocabulary.md)
for why non-Southern species currently have nowhere to go.

## Parcel identity

TimberForge attaches cruises to parcels by foreign key and copies no parcel data.
LandForge identifies parcels, pays for the geometry and ownership lookups, and
holds the canonical row.

`supabase/migrations/0004_landforge_bridge.sql` binds that FK **conditionally**:
it locates the parcel table by configured name, requires the key to be a `uuid`,
and skips with a printed candidate list rather than binding to a table that
merely looks plausible. It is in skip mode right now because the parcel schema
has not been captured — `PARCEL_HIT` was null. See
[`../shared/parcel.md`](../shared/parcel.md).

A wrong bind is the worst available failure: it joins cruises to the wrong
parcels, and every number downstream is confidently incorrect with nothing
visibly broken.

## Confidence: two numbers, not one

A cruised parcel carries both LandForge's pre-cruise score and TimberForge's
post-cruise interval. We do not merge, map, or overwrite. The pre-cruise score
survives the cruise, because comparing it to what the cruise found is the
feedback loop this pairing exists to build.

`confidence.ts` is a **replica** of LandForge's ladder — tagged
`LADDER_REPLICA_VERSION` — and its own header states that LandForge computes the
real score and that any disagreement means our file is wrong. That framing is
correct. It forecasts; it does not decide.

Note the confidence levels differ on purpose: LandForge's tolerance model uses
90%, TimberForge's reported statistics default to 95%. `tCritical(df, confidence)`
takes the level explicitly. Any call crossing this boundary must pass it rather
than rely on the default.

## Versioning

If a mirrored constant changes, `CALC_ENGINE_VERSION` is bumped as part of the
re-capture. Stored results must remain attributable to the engine version that
produced them; a changed prior silently re-scoring historical cruises would
destroy the comparison described above.

## Before turning the adapter on

1. Answer the questions in [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md), in
   particular the acreage divisor and the object keys `applyParsedFields()`
   expects.
2. Rewrite `assumptions.ts` against observed values; drop `LF_ASSUMPTIONS`.
3. Rewrite `adapter.ts` to emit the `na-*` payload; drop `millDistanceMi` from
   the cruise path.
4. Round-trip one real cruise against `/beta` and compare LandForge's returned
   score to the replica's forecast.
5. Only then set `ADAPTER_VERIFIED = true` and bump `ADAPTER_VERSION`.

Step 4 is the one that cannot be skipped. Every other step can be done correctly
and still produce a wrong integration, because the thing being verified is our
model of a system we can only observe from outside.
