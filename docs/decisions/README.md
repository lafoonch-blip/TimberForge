# Decision records

One file per decision that would otherwise have to be re-litigated from memory.

A record here is worth writing when the decision was **contested, costly, or
non-obvious** — when a competent person arriving later would reasonably do the
opposite, and needs to know why we didn't. Decisions that follow directly from
the code, or that nobody would think to question, do not need a record.

## Format

Each record states the decision, the forces that produced it, what was rejected
and why, and what would make us revisit it. That last section is the one that
keeps this directory honest: a decision with no stated reversal condition is
usually a preference wearing a decision's clothes.

Records are **append-only in spirit**. When a decision changes, the old record
gets a `Superseded by 000N` line at the top and stays. Deleting it would erase
the reasoning that made the change necessary.

Numbering is sequential and permanent. Numbers are never reused.

## Index

| # | Decision | Status |
|---|---|---|
| [0001](0001-supabase-topology.md) | One Supabase project, separate schema, parcels shared by foreign key | Accepted |
| [0002](0002-mvp-cruise-methods.md) | Ship variable-radius and fixed-area plots only | Accepted |
| [0003](0003-pre-and-post-cruise-scoring.md) | Pre-cruise and post-cruise scores stay separate | Accepted |
| [0004](0004-species-vocabulary.md) | Expand `SP_LIST` in LandForge rather than degrade the bridge | Accepted, LandForge work pending |
| [0005](0005-shared-context-ownership.md) | LandForge is canonical; TimberForge mirrors with a drift check | Accepted |
| [0006](0006-cruise-data-rights.md) | Cruise data is held in custody; ground-truth learning is opt-in and derived-features only | Accepted, implementation pending |
| [0007](0007-landforge-metrics-surface.md) | Push-back and learning are separate objects; opt-in is per-custodian, stamped on the cruise | Accepted, implementation pending |
| [0008](0008-persistent-forest-assets.md) | Properties and stands persist; a cruise is an event that measures them | Accepted, **schema change pending — cost rises after first deployment** |
| [0009](0009-stratum-as-first-class-entity.md) | Stratum is a first-class entity | Accepted |
| [0010](0010-timberforge-owns-timber-predictions.md) | TimberForge is the source of truth for timber predictions; LandForge reads them | Accepted, implementation pending |

## Related

Decisions constrain what the shared mirror is allowed to contain. See
[`../shared/README.md`](../shared/README.md) for how mirrored facts are
distinguished from our interpretation of them, and
[`../integration/OPEN_QUESTIONS.md`](../integration/OPEN_QUESTIONS.md) for the
questions still unanswered — several of these decisions are provisional on those.
