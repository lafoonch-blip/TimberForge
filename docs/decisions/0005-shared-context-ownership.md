# 0005 — LandForge is canonical; TimberForge mirrors with a drift check

**Status:** Accepted · **Date:** 2026-09-07 · **Decided by:** Shayne

## Decision

For any fact both products depend on, **LandForge holds the canonical version.**
TimberForge keeps a **read-only mirror** in `docs/shared/`, with per-file
provenance in `mirror.manifest.json` and an automated drift check
(`npm run check:mirror`).

TimberForge's own documentation is maintained separately and is not shared.

## Forces

The instruction that produced this was Shayne's: *"I want to pass context between
the two projects so we aren't guessing."* It arrived as the answer to a narrow
question — what divisor LandForge uses to derive MBF per acre — and it was a
better answer than the one asked for. The right fix was not to pick a divisor but
to stop the class of problem that made the question necessary.

Three shapes were considered.

**Duplicating the facts in both repos with no linkage** is the status quo it
replaces, and it is the thing that produces guessing. Two copies with no
mechanism to detect divergence means the divergence is discovered by a wrong
number in production.

**Importing LandForge as a package dependency** was rejected for two reasons.
It couples deploys — a LandForge release would be able to break the field app —
and it puts a runtime dependency into an application whose defining constraint
is working offline, on a phone, with no signal, in a stand of timber. The field
app must be able to compute without reaching anything.

**Mirroring with provenance** keeps the facts local and inert, while making the
copy's staleness a first-class, checkable property. The cost is that
reconciliation is manual. That cost is accepted, and the age limit
(`maxAgeDays: 90`) exists because manual reconciliation is easy to forget.

## What the drift check can and cannot prove

This distinction is the whole load-bearing part of the decision, and it is
restated in `scripts/checkMirror.ts` and `docs/shared/README.md` because it is
very easy to over-read a green check.

It **can** detect a TimberForge-side edit to a mirrored file, a mirror that has
aged past the limit, and a file added to or removed from `docs/shared` without a
manifest entry. That last one matters most: an unprovenanced document in a
directory of authoritative documents quietly acquires the authority of its
neighbours.

It **cannot** detect that LandForge changed. Nothing in this repository can —
LandForge's source is not reachable from here. A green check means **intact and
recent**, not **correct**.

The failure mode it is really built for is narrower and more likely than a
malicious edit: someone changes a mirrored constant locally to make a TimberForge
test pass. The repo then agrees with itself and disagrees with production, and
every test is green. The check makes that edit loud.

## Design choices worth keeping

**It fails closed.** A mirrored file with no recorded hash is reported as
`edited`, not as a pass. Failing open would let a file be introduced with no hash
and sail through forever.

**`pending` is a first-class confidence level.** `parcel.md` is a deliberate
placeholder — `PARCEL_HIT` was null at capture time. It reports as `uncaptured`
and does **not** fail the check. If it failed, someone would eventually "fix" the
red suite by inventing a plausible schema, which is precisely the mistake the
directory exists to prevent. Visible and non-blocking is the correct treatment
for a known unknown.

**`--update` is a separate, explicit invocation.** It makes any diff disappear,
including one that should have been reverted rather than blessed. It is never run
as part of the check.

**Confidence is recorded per file**, not assumed: `confirmed` (read directly from
a running LandForge), `derived` (computed from observed behaviour and verified),
`inferred` (reasoned, not observed), `pending` (not captured). A proposal that
has not landed in LandForge is not mirrored fact and is labelled as such inline —
see the candidate species list in `landforge-species.md`.

## Consequences

Changing a mirrored number is not an edit; it is a **re-capture**. The procedure
in `docs/shared/README.md` includes bumping `CALC_ENGINE_VERSION`, because a
changed constant changes computed output and stored results need to be
attributable to the version that produced them.

Facts flow one way. Where TimberForge needs something from LandForge that does
not exist yet, that is a **question**, recorded in
[`../integration/OPEN_QUESTIONS.md`](../integration/OPEN_QUESTIONS.md) — not a
value we choose and mirror back.

## What would make us revisit

If the two products ever share a repository or a release train, the mirror
becomes unnecessary overhead and a direct import is correct. Short of that, the
offline constraint on the field app makes a runtime dependency the wrong answer
regardless of how convenient it looks.
