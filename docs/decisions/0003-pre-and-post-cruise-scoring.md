# 0003 — Pre-cruise and post-cruise scoring stay separate

**Status:** Accepted · **Date:** 2026-09-07 · **Decided by:** Shayne

## Decision

LandForge's pre-cruise confidence score and TimberForge's post-cruise statistical
confidence are **two different numbers measuring two different things**. We do
not map one onto the other, do not reconcile them to a common scale, and do not
overwrite one with the other.

## The problem this dissolves

There is an apparent conflict between the two systems that looked, for a while,
like something needing a conversion function.

LandForge scores a property **before anyone walks it**. Its confidence reflects
how much is known about the parcel — the inventory tier ladder in
`packages/landforge-contract/src/confidence.ts`, running from `none` through
`high`, blended with mill proximity and other locational factors. It answers:
*how much should a buyer trust this estimate given how little we've measured?*

TimberForge scores a stand **after it has been measured**. Its confidence is a
sampling statistic — a t-based interval around a mean, with real degrees of
freedom from real plots. It answers: *given n plots with this variance, how
tight is this estimate?*

Those are not the same quantity in different units. They are different
quantities. A parcel can have a high pre-cruise score (good records, close to a
mill, known stand type) and a wide post-cruise interval (highly variable timber,
few plots). Both statements are true at once, and averaging them destroys both.

The rejected alternative was a mapping function — normalising the sampling error
to 0–100 and feeding it back into LandForge's ladder as a new top tier. It fails
because the ladder's tiers encode *how the data was obtained*, not *how precise
it is*. A cruise with 3 plots and a cruise with 40 plots are both `high` tier,
and should be, because both were physically measured. Their precision differs by
a factor the ladder is not built to express — and forcing it to express one
would make the tiers mean two things at once.

## Consequences

A cruised parcel carries **both** scores. The pre-cruise score is not deleted
when a cruise lands; it becomes the record of what was believed beforehand, which
is exactly the data needed to find out whether the pre-cruise model is any good.
That comparison is the feedback loop the whole TimberForge/LandForge pairing
exists to create.

`confidence.ts` is currently a **replica** of LandForge's ladder, tagged
`LADDER_REPLICA_VERSION` and explicit in its own header that LandForge computes
the real score and that a disagreement means this file is wrong. That framing is
correct and stays. It predicts the pre-cruise score; it does not compute the
post-cruise one.

The two also differ in confidence level, and this is not an inconsistency to fix.
LandForge's tolerance model uses **90%** (`T90` in
[`../shared/landforge-constants.md`](../shared/landforge-constants.md)).
TimberForge's `statistics.ts` defaults to **95%**, the convention for reported
cruise results. Each is right for its own audience — a pre-cruise tolerance band
is a screening heuristic, a reported cruise interval is a professional
deliverable. `tCritical(df, confidence)` supports both explicitly, and any call
site crossing the boundary must pass the level rather than take the default.

## What would make us revisit

Evidence that users are in fact reading the two numbers as comparable and making
decisions on the difference. If that happens, the fix is presentational — label
them unmistakably in the UI — not a merge of the two models.
