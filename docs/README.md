# TimberForge documentation

## The one rule

Documentation here is split by **who owns the fact**, not by topic. This is the
organising principle and everything else follows from it.

- **[`shared/`](shared/)** — facts owned by **LandForge**. A read-only mirror.
  Do not edit these to make something here work.
- **Everything else** — owned by TimberForge. Edit freely.

The reason for the split: `shared/landforge-constants.md` says what LandForge
*does*; `integration/LANDFORGE_BRIDGE.md` says what we've *decided to do about
it*. If those lived in one file, the first person to update our reasoning would
silently rewrite LandForge's behaviour, and nobody could tell afterwards which
sentences were observed and which were assumed.

Run `npm run check:mirror` to verify the mirror is intact. A green result means
**intact and recent** — not **correct**. LandForge's source is not reachable
from this repository, so nothing here can prove LandForge hasn't changed.

## Map

| Directory | Contents | Owner |
|---|---|---|
| [`shared/`](shared/) | LandForge constants, cruise intake, species vocabulary, parcel | **LandForge** — mirror, read-only |
| [`decisions/`](decisions/) | Numbered decision records, with what was rejected and why | TimberForge |
| [`integration/`](integration/) | Our interpretation of the LandForge contract; open questions | TimberForge |
| [`market/`](market/) | [Business case](market/BUSINESS_CASE.md) and [forester interview kit](market/INTERVIEW_KIT.md) | TimberForge |
| [`domain/`](domain/) | [Forestry glossary](domain/GLOSSARY.md) | TimberForge |
| [`product/`](product/) | PRD (what ships), VISION (where it's going), strategy reconciliation, context, branding | TimberForge |
| [`logo-concepts/`](logo-concepts/) | Logo *exploration* — concepts and SVG variants | TimberForge |
| [`reference/`](reference/) | Source PDFs and background material | External |

The architecture decision document, [`../FOUNDATION.md`](../FOUNDATION.md), is at
the repository root rather than in here, because it is the thing you read first
and it should be visible without opening a directory.

Note the distinction between [`logo-concepts/`](logo-concepts/) and the
repository-root [`../brand/`](../brand/): the first is exploration, the second is
the built asset library actually shipped (`android/`, `ios/`, `web/`, `print/`,
`social/`, `email/`, `master/`). Take assets from the root one.

## Start here

**New to the project?** [`../FOUNDATION.md`](../FOUNDATION.md), then
[`product/PRD.md`](product/PRD.md), then
[`domain/GLOSSARY.md`](domain/GLOSSARY.md) if the forestry terms are unfamiliar.

**About to change a calculation?** [`domain/GLOSSARY.md`](domain/GLOSSARY.md) and
[`shared/landforge-constants.md`](shared/landforge-constants.md). Changing a
mirrored number is a re-capture, not an edit — the procedure is in
[`shared/README.md`](shared/README.md) and includes bumping `CALC_ENGINE_VERSION`.

**Working on the LandForge integration?**
[`integration/LANDFORGE_BRIDGE.md`](integration/LANDFORGE_BRIDGE.md) first, then
[`integration/OPEN_QUESTIONS.md`](integration/OPEN_QUESTIONS.md). The adapter is
switched off (`ADAPTER_VERIFIED = false`) and should stay off until those
questions are answered.

**Wondering why something is the way it is?** [`decisions/`](decisions/). If the
answer isn't there and the decision was contested, add a record.

## The things currently blocked

Four, all recorded in
[`integration/OPEN_QUESTIONS.md`](integration/OPEN_QUESTIONS.md) with what each
one blocks. The cheapest is the parcel schema — it needs one parcel selected in
LandForge `/beta` to populate `PARCEL_HIT`, and it is what keeps migration `0004`
running in FK skip mode.

## Adding to the mirror

Don't, unless you observed it in a running LandForge. A file added to
`docs/shared/` without a `mirror.manifest.json` entry fails the drift check as
`unprovenanced`, on purpose: an unsourced document sitting among authoritative
ones acquires their authority by adjacency.

If you need something from LandForge that doesn't exist yet, it is a **question**
for `integration/OPEN_QUESTIONS.md` — not a value you pick and mirror back.

---

# How to maintain this

Documentation rots when every file has the same vague rule ("keep it updated").
These files have **four different and partly opposing rules**, and knowing which
class a file belongs to is most of the maintenance burden.

| Class | Files | Rule |
|---|---|---|
| **Never edit** | `shared/*` | Re-capture from LandForge only. Machine-enforced. |
| **Never delete** | `decisions/*` | Supersede; the old record stays. |
| **Delete as you go** | `integration/OPEN_QUESTIONS.md` | Success is an empty file. |
| **Living** | everything else | Edit freely; keep claims sourced. |

### Never edit — `shared/`

These are LandForge's facts, not ours. Changing a number here is a **re-capture**,
not an edit: observe it in a running LandForge, update the file, update
`mirror.manifest.json` (`capturedAt`, `capturedFrom`, `method`, `confidence`),
run `npm run check:mirror -- --update`, and bump `CALC_ENGINE_VERSION` if the
number feeds a calculation.

`npm run check:mirror` enforces this by hash. If it fails and you did not
knowingly re-capture, the correct response is `git checkout` on that file, not
`--update`. The specific failure this guards against is someone tweaking a
mirrored constant to make a test pass — after which the repo agrees with itself
and disagrees with production, and every test is green.

### Never delete — `decisions/`

Add a record when a decision was **contested, costly, or non-obvious** — when a
competent person arriving later would reasonably do the opposite. Not for
decisions that follow from the code.

When one changes, add `Superseded by 000N` at the top of the old record and leave
it. Numbering is permanent and never reused. Every record needs a "what would
make us revisit" section; without one it is a preference wearing a decision's
clothes.

### Delete as you go — `OPEN_QUESTIONS.md`

The only file here whose goal is to become empty. When a question is answered:
record the fact in the relevant `shared/` file, update the manifest, run the
mirror update, and **delete the question in the same commit**. Leaving an
answered question is worse than useless — it makes the file untrustworthy, and an
untrustworthy blocker list gets ignored.

Never resolve a question by picking a plausible answer. That is the exact failure
the file exists to prevent.

### Living — the rest

`product/PRD.md`, `product/CONTEXT.md`, `domain/GLOSSARY.md`,
`integration/LANDFORGE_BRIDGE.md`, `market/*` and root `FOUNDATION.md`.

Edit freely, with one discipline: **keep the provenance tags.** `market/*` tags
every number `verified` / `modeled` / `unknown`. When you refresh a figure,
re-tag it. A modeled number that quietly becomes an unmarked fact is how a
business case starts lying to its author.

For dated market figures, add the observation date rather than replacing silently
— the trend is usually more informative than the current value.

### Cadence

Nothing here needs a calendar except the mirror, which has a 90-day age limit
enforced by the drift check. Everything else is event-driven: a decision gets a
record when it is made, a question gets deleted when it is answered, the glossary
gains a term the first time someone has to ask what it means.

The one recurring habit worth having: run `npm run check:mirror` alongside the
test suite. It is the only part of the documentation with teeth, and it costs a
second.
