# Open questions for the LandForge side

**Owner: TimberForge.** These are things TimberForge needs to know that cannot be
determined from this repository. Each one is blocking something specific.

The point of this file is that these stay *questions*. The failure mode it
prevents is answering one plausibly, mirroring the answer into
[`../shared/`](../shared/), and having a guess acquire the authority of a
captured fact. Nothing here gets written into `docs/shared/` until it has been
observed in a running LandForge.

**How to answer one:** observe it in LandForge, record it in the relevant
`docs/shared/` file, update `mirror.manifest.json` (`confidence`, `capturedAt`,
`capturedFrom`, `method`), run `npm run check:mirror -- --update`, and delete the
question from this file in the same commit.

---

## 1. Which acreage divides total into per-acre?

**Blocks:** the entire export path. `ADAPTER_VERIFIED` stays `false` until this
is answered.

LandForge's intake accepts **totals**; it works in **per-acre** internally.
TimberForge produces per-acre natively. So something divides, and we do not know
what.

The candidates are `na-fac` (forested acres) and `na-op`. They differ on any
tract that is not entirely forested — which is most tracts.

**Why we are not guessing:** the two produce results differing by the ratio of
the acreages, typically between 1.0 and 2.0. That is small enough to look like a
believable timber estimate and large enough to misprice a tract by a wide margin.
A wrong answer here does not look wrong.

**To resolve:** enter a known cruise in `/beta` on a tract where forested acres
and total acres differ, then read the resulting per-acre value and see which
divisor reproduces it. One observation settles it.

---

## 2. What object keys does `applyParsedFields()` expect?

**Blocks:** programmatic submission. Manual form entry is unaffected.

We captured the `na-*` DOM field ids by read-only inspection and deliberately
**did not invoke any page functions**. So the form field ids are confirmed, but
the shape of the object `applyParsedFields()` consumes is not — it may key on the
`na-*` ids, on stripped names, or on something else entirely.

**Why this is unknown by choice:** invoking functions in a live authenticated
session against a production application is a side-effecting act on Shayne's real
data. Reading was appropriate; calling was not.

**To resolve:** read the function's source or parameter names in a safe context,
or invoke it against a throwaway record in a non-production environment.

---

## 3. `SP_LIST` expansion — Pacific Northwest and Lake States / Northeast

**Blocks:** any non-Southern cruise from exporting at all. TimberForge itself is
unaffected; regions are configuration and the calculation engine never branches
on species vocabulary.

Decided in
[`../decisions/0004-species-vocabulary.md`](../decisions/0004-species-vocabulary.md).
The candidate list lives in
[`../shared/landforge-species.md`](../shared/landforge-species.md) and is
explicitly labelled a **proposal, not a mirror**.

**The trap:** expansion is not purely additive. `SP_LIST` values carry
`CV_PRIOR`-style priors through stand type, so adding a name changes how existing
rows score. Check `lfStandType` before adding anything that overlaps an existing
entry — "Northern red oak" in particular may need to collapse into the existing
"Red oak" rather than sit beside it, and existing rows will not re-sort
themselves.

---

## 4. The parcel schema — `PARCEL_HIT`

**Blocks:** the foreign key in `supabase/migrations/0004_landforge_bridge.sql`,
which is running in **skip mode** against the real project until this is known.

`PARCEL_HIT` was `null` at capture time because no parcel had been selected in
the session. Selecting one populates it and exposes the real field names and
types.

**This is the cheapest item on the list** — it is one click in `/beta`. Capture
procedure is in [`../shared/parcel.md`](../shared/parcel.md). What is needed:
field names, types, which field is the primary key, and the schema and table
name.

Note that migration `0004` explicitly **refuses to bind to a non-`uuid` key**,
and there is a test pinning that refusal. If the key turns out not to be a uuid,
that is a design conversation, not a test to relax.

---

## 5. Does the replica ladder actually agree with LandForge?

**Blocks:** nothing yet, but it is the check that determines whether
`confidence.ts` is worth keeping.

`confidence.ts` is a forecast of LandForge's pre-cruise score, tagged
`LADDER_REPLICA_VERSION`, and its header already commits to the right resolution:
if LandForge returns its own score and the two disagree, **our file is wrong**.

**To resolve:** round-trip one real parcel, capture LandForge's returned score,
compare. This should happen as part of step 4 of the adapter checklist in
[`LANDFORGE_BRIDGE.md`](LANDFORGE_BRIDGE.md), and is the step that cannot be
substituted with more careful reasoning — the whole point is that we are modelling
a system we can only observe from outside.

---

## Access still needed

Two of these are blocked on connectors rather than on knowledge:

- **Supabase** — not yet authorized. Needed to confirm the parcel table's real
  schema, and to run migrations against anything other than the in-process
  PGlite harness.
- **Vercel** — not yet authorized. `list_teams` returned an empty list.

There is no GitHub connector in the registry, so validating against the LandForge
repository directly is not currently possible. Everything in `docs/shared/` was
obtained by observing the running application, which is why provenance is
recorded per file rather than assumed.
