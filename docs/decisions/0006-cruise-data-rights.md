# 0006 — Cruise data rights and the Intelligence conflict

**Status:** Accepted, implementation pending · **Date:** 2026-09-08

## Decision

The forester's client owns the inventory. TimberForge holds cruise data as a
**custodian, not a proprietor**. Ground-truth learning happens on **derived
features under opt-in**, never on resale of tract-level inventory, and never in a
form that can be re-identified to a parcel.

This is decided now, before the first customer, because it is a trust problem and
trust problems are not retroactively fixable.

## The conflict

A market analysis proposed two businesses: TimberForge Pro, sold to consulting
foresters, and TimberForge Intelligence, sold to TIMOs, REITs, banks, timber
buyers and procurement foresters.

Stated plainly, that structure aggregates data produced by group A, about group
A's clients, into a product sold to group B — **who sit across the negotiating
table from group A's clients.**

A timber inventory is not neutral telemetry. It is the direct basis for a
stumpage negotiation. A consulting forester's professional duty runs to the
landowner, and a cruise is commercially sensitive in exactly the way that makes
aggregation adversarial.

Three properties make this sharper than a generic privacy question.

The data is **fiduciary**, not incidental. It was produced under contract for
someone else's benefit, which is a different thing from usage analytics.

The buyers are **counterparties**. If Intelligence helps a buyer price a tract
more sharply, it transfers surplus away from the landowner whose forester
generated the training data.

The community is **small and networked** — roughly 2,000–5,000 practitioners
nationally, of whom about 750 belong to ACF. One forester concluding that
TimberForge monetizes client inventories against them is a distribution event,
not an isolated complaint. And because LandForge shares an owner, the suspicion
attaches to both products at once.

## What we will and will not do

**Will not:** sell, license or expose tract-level inventory, stand tables, or
anything re-identifiable to a parcel or landowner. Not to TIMOs, not to buyers,
not aggregated so thinly that it reconstructs.

**Will not:** treat acceptance of the terms of service as consent to train on a
cruise. Buried consent is the mechanism that makes people feel deceived even
when the text technically covered it.

**Will not:** let LandForge read TimberForge cruise data by virtue of shared
infrastructure. The two products share one Supabase project
([`0001`](0001-supabase-topology.md)) and one auth system, so this boundary is a
deliberate access-control decision, not a natural consequence of the
architecture. The schema separation makes it enforceable; RLS makes it real.

**Will:** learn from **derived features** — the relationship between remotely
observable inputs (imagery, terrain, soils, stand age, species signature) and
measured outcomes — under explicit per-organization opt-in, with a minimum
aggregation threshold before any derived statistic is published or used outside
the contributing organization.

**Will:** give the forester their data back in full, on demand, in an open
format, including on account termination. A custodian who cannot return the
thing they hold is not a custodian.

**Will:** state the position in plain language on the pricing page and in the
first-run experience, not only in the terms.

## Why opt-in rather than opt-out

Opt-out would collect more data and is defensible in most consumer software. It
is wrong here for two reasons.

The forester cannot consent on the landowner's behalf to a use the landowner
never contemplated. Opt-in at least forces the forester to make a considered
decision they can explain to their client if asked.

And the opt-in conversation is itself valuable. A forester who affirmatively
agrees to contribute has understood the value exchange and is a candidate for the
Intelligence business as a *customer*. A forester who discovers a year later that
opt-out was the default becomes the story everyone else hears.

The cost is real: fewer contributed cruises and slower dataset growth. That cost
is accepted. The dataset is a defensive asset that compounds over years
([`../market/BUSINESS_CASE.md` §5](../market/BUSINESS_CASE.md#5-where-the-actual-upside-is-and-what-it-costs)),
so growing it more slowly and cleanly beats growing it fast and having to
unwind it.

## The honest tension

This decision constrains the larger business. Some version of Intelligence — one
that sells sharper tract-level valuations to acquisitive buyers — is foreclosed
by it. That version was probably always in conflict with owning the forester
relationship, and picking one is better than discovering the incompatibility
after both are half-built.

What remains available is substantial: regional yield and growth models,
predicted-versus-actual calibration for LandForge's pre-cruise scoring, harvest
readiness, forest change detection, and confidence scoring. All of those work on
derived features. None require reselling a client's stand table.

Note also that this improves LandForge's pre-cruise model, which is the
[`0003`](0003-pre-and-post-cruise-scoring.md) feedback loop — the two scores stay
separate precisely so the comparison between them stays meaningful. That loop
runs entirely on derived features and is unaffected by this decision.

## Implementation

None of this is built yet. It becomes real through:

1. A written data rights statement in plain language, drafted before the first
   pilot cruise — a forester will ask, and "I haven't worked that out" is a
   worse answer than any specific policy.
2. An organization-level opt-in flag, defaulting **off**, surfaced at first run
   rather than buried in settings.
3. RLS policies enforcing that no cross-organization read path exists, and that
   LandForge's role cannot select TimberForge cruise rows. Migration
   [`0005_rls.sql`](../../supabase/migrations/0005_rls.sql) is where this lands,
   and it needs a test that a LandForge-role session reads zero rows — the same
   discipline used elsewhere, where a policy without a test proving it denies is
   not a policy.
4. A minimum-contributors threshold constant in the learning pipeline, enforced
   in code rather than by convention.
5. Full export on demand, including on termination.

Item 3 is the one with teeth. The rest are promises; RLS is a mechanism.

## What would make us revisit

A landowner-direct product, where the landowner is the customer and can consent
for their own property, changes the analysis — consent would sit with the party
that actually holds the right. That is a different product with a different
relationship, and it would need its own record rather than an amendment to this
one.
