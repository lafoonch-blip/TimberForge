# 0007 — The LandForge-facing metrics surface

**Status:** Accepted, implementation pending · **Date:** 2026-09-09

Extends [`0006`](0006-cruise-data-rights.md), which settled the *rights*
question. This record settles the *structural* one: what LandForge is actually
allowed to read, and through which object.

## Decision

LandForge consumes **derived, aggregated, consented** timber metrics. It never
reads raw cruise data belonging to a forester's client.

Two distinct channels carry timber data out of TimberForge. They have different
consent models, different aggregation requirements, and — the point of this
record — **must be different database objects.** Conflating them is how the
boundary in `0006` quietly stops existing.

## The two channels

### Channel 1 — Push-back (parcel-identifiable, same custodian)

A forester finishes a cruise on a parcel they already hold in LandForge and
pushes the result to their own parcel view.

This is **not a data-sharing question.** It is one person moving their own data
between two products they use. The data is parcel-identifiable by design —
that is the entire value — and no aggregation applies.

`timberforge.timber_feed` is this channel and already implements it correctly:
`sent_at` and `sent_by` record an explicit human action rather than a background
sync, and `timber_feed_read` is gated on `can_read_cruise(cruise_id)`, so a
session that is not a member of the cruise reads nothing. A LandForge-role
session is such a session. **The `0006` boundary already holds here** — it is
not merely promised.

The rule that must not erode: push-back is **pull-by-the-owner, never
push-by-the-platform.** The moment TimberForge writes parcel-level timber
values into LandForge on a schedule, without a named human pressing a button,
channel 1 has become channel 2 without anyone deciding that it should.

### Channel 2 — Learning (derived, aggregated, consented)

Cruise outcomes improve LandForge's pre-cruise model — the
[`0003`](0003-pre-and-post-cruise-scoring.md) feedback loop, regional yield
curves, harvest-readiness signals, predicted-versus-actual calibration.

**This channel does not exist yet.** There is no table for it, and that is the
substantive gap this record opens rather than closes. When it is built it must:

- carry no parcel identifier, no cruise identifier, and no landowner-resolvable
  geometry — de-identification by **construction**, not by a `select` list that
  someone can later widen
- be gated on an explicit opt-in that defaults off
- enforce a minimum-contributors threshold in code
- be a separate object with its own grants, so that widening access to it cannot
  accidentally widen access to `timber_feed`

## Two problems the schema audit turned up

### The opt-in has nowhere to attach

`0006` §"Will" promises "explicit **per-organization** opt-in." But there is no
organization concept in the schema, and its absence is deliberate:
`FOUNDATION.md` §2 rejects reusing LandForge's organization model on the grounds
that cruise crews form per-job and dissolve, and modelling them as organizations
"would force a heavyweight structure onto a two-person afternoon." The sharing
unit is `cruise_member`, not a durable org.

So `0006` as written cannot be implemented. Resolving it by adding an
organization table would reverse a decision made for good reasons.

**Resolution:** the opt-in attaches to the **individual forester**
(`auth.users.id`), and the decision in force is **recorded on the cruise at
compilation time** rather than read live.

Recording it per-cruise matters more than it looks. A live read means a forester
who opts in today has retroactively contributed every cruise they ever ran, and
one who opts out tomorrow leaves already-derived models trained on data they
have withdrawn — with no record of which state applied when. Stamping consent
onto the cruise makes the question "was this cruise contributed?" answerable
from the row itself, years later, without reconstructing a settings history.

`0006` should be read as saying *per-custodian*, and this record supersedes its
use of the word "organization."

### The threshold must count contributors, not rows

`0006` §Implementation item 4 says "minimum-contributors threshold." Implemented
carelessly this becomes a row count, and one prolific forester with fifty cruises
in one county then satisfies a threshold of ten on their own — publishing a
regional statistic that is, in substance, that single forester's book of
business, re-identifiable by anyone who knows who works that county.

The threshold counts **distinct contributing foresters**, and it is a named
constant in code, not a number written into a query someone can edit.

## What this means for the schema work

Three surfaces, deliberately separate:

| Surface | Grain | Identifiable? | Consent | Who reads it |
|---|---|---|---|---|
| `timberforge.*` cruise tables | tree, plot, stand | yes | n/a — it's theirs | cruise members only |
| `timberforge.timber_feed` | parcel × cruise | yes | explicit push, per send | cruise members only |
| *(unbuilt)* derived-metrics surface | region × species × period | **no, by construction** | opt-in, defaulting off | LandForge |

The parcel bridge stays as it is: `parcel_link` holds a nullable FK to
LandForge's parcel table ([`0001`](0001-supabase-topology.md)), geometry is
never copied, and TimberForge does not second-guess LandForge's own row-level
policies on its own table.

## What would make us revisit

A landowner-direct product, where the landowner is the customer and can consent
for their own property — the same trigger recorded in
[`0006`](0006-cruise-data-rights.md). Consent would then sit with the party that
holds the right, and channel 2's de-identification requirement would be a
choice rather than a necessity.

Also: if a durable organization concept ever enters the schema for unrelated
reasons, the opt-in anchor should be revisited, because per-custodian consent
was a resolution to its absence rather than a preference.
