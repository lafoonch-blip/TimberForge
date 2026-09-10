# 0010 — TimberForge is the source of truth for timber predictions

**Status:** Accepted, implementation pending · **Date:** 2026-09-10 · **Decided by:** Shayne

Partially supersedes [`0003`](0003-pre-and-post-cruise-scoring.md) and
[`0005`](0005-shared-context-ownership.md) — see *What changes* below.

## Decision

TimberForge owns every timber prediction: stand boundaries, species, age, volume,
product mix, timber value, and the confidence attached to each. When LandForge
needs timber data or timber value for a property, it **reads it from TimberForge**.
LandForge does not compute its own.

LandForge keeps everything that is not timber: parcel identity, ownership,
acreage, comps, land value, and the property-level investment decision that
combines them. TimberForge answers *what timber is here and what is it worth*;
LandForge answers *should I buy this property*.

## Why

Two products were on course to predict the same thing.

LandForge's live database already holds its own timber model output:
`parcel_stands` (modelled stands with volume, stumpage value and confidence), a
segmentation worker that produces them, and per-parcel timber fields on
`land_parcels`. TimberForge's pre-cruise intelligence and predicted-versus-actual
loop ([`VISION.md`](../product/VISION.md) §3) describe the same outputs.

Two sources for one number means:

- a cruised parcel can show two disagreeing pre-cruise estimates, and nobody can
  say which one the cruise should be compared against
- the ground-truth loop trains whichever model happens to receive the cruise, and
  improvements in one never reach the other
- every species, volume-equation or price change has to be made twice, and
  [`0005`](0005-shared-context-ownership.md)'s drift check exists precisely
  because "made twice" becomes "made once, silently"

Timber is TimberForge's domain. It is where the forestry method lives, where the
measured data arrives, and where the model can be checked against it. So the
prediction lives there too.

## What changes

- **[`0003`](0003-pre-and-post-cruise-scoring.md):** the rule stands — pre-cruise
  confidence and post-cruise sampling statistics remain two separate numbers,
  never mapped or merged. What changes is *who computes the pre-cruise estimate*:
  TimberForge, not LandForge. LandForge may still score how much it trusts its
  *property* data; it no longer produces a timber estimate of its own.
- **[`0005`](0005-shared-context-ownership.md):** LandForge stays canonical for
  parcels. For timber constants, species and prediction logic, the direction
  reverses over time — TimberForge becomes canonical and LandForge consumes.
  Until that migration happens, the existing mirror and drift check stay in force.
- **LandForge:** no new timber-prediction work. `parcel_stands`, the segmentation
  worker and the timber fields on `land_parcels` are interim. They keep running
  until TimberForge serves predictions, then LandForge switches to reading them
  and retires its own.

## What does not change

[`0006`](0006-cruise-data-rights.md) and
[`0007`](0007-landforge-metrics-surface.md) still govern **measured cruise data**.
A prediction built from public remote data is TimberForge's own output and can be
served to LandForge for any parcel. A cruise belongs to the forester's client, and
reaches LandForge only through the two channels in `0007`: push-back by the owner,
or derived and consented learning. Owning the prediction does not widen either
channel.

## Rejected

- **LandForge keeps its timber model; TimberForge only handles cruises.** This is
  the current de facto state. Rejected for the reasons above: two predictions and
  a split learning loop.
- **Both keep models and reconcile.** A reconciliation layer would need a rule for
  which one wins, which is this decision made implicitly and without a record.

## Revisit if

- TimberForge does not reach a working prediction service and LandForge's interim
  model becomes the only one in use for an extended period — then either invest
  in the move or record that LandForge owns it after all.
- A buyer or regulator needs the property decision and the timber estimate to come
  from one audited system.
