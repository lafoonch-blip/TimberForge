# Strategy reconciliation — September 2026

**Status:** open. This file exists to be emptied, like
[`../integration/OPEN_QUESTIONS.md`](../integration/OPEN_QUESTIONS.md). Delete
each item in the same commit that resolves it.

A new strategic direction was handed down on 2026-09-09 (recorded in
[`VISION.md`](VISION.md)). This file is the audit of that direction against
what is already written and already built: what genuinely conflicts, what would
grow the MVP, what an uncritical rewrite would destroy, and the decisions that
are still yours to make.

Everything below cites a location. Nothing here is a recollection.

---

## 1. The one thing to decide before anything else

### 1.1 Intelligence customers versus the counterparty constraint

The new direction (§16) lists TimberForge Intelligence customers as TIMOs,
REITs, timber companies, investors, **banks, insurers**, land marketplaces and
**acquisition teams**, selling *remote timber inventory, acquisition screening,
timber value APIs, portfolio monitoring* and *valuation validation*.

[`../decisions/0006-cruise-data-rights.md`](../decisions/0006-cruise-data-rights.md)
already examined this and closed part of it:

> Some version of Intelligence — one that sells sharper tract-level valuations
> to acquisitive buyers — is foreclosed by it.

The reasoning was not squeamishness. Several of those buyers sit **across the
negotiating table from the primary user's client**. A timber inventory is the
direct basis for a stumpage negotiation, the forester's duty runs to the
landowner, and the community is small enough (roughly 2,000–3,000 practitioners;
see [`../market/BUSINESS_CASE.md`](../market/BUSINESS_CASE.md)) that one
forester concluding you monetize client inventories against them is a
distribution event rather than a complaint.

**The new direction does not acknowledge this, and it cannot simply override it
by listing more customers.** §15 of the handoff does say data rights and
anonymization "must therefore be designed carefully," which is consistent — but
"carefully" is not a decision.

What remains available under `0006` and
[`0007`](../decisions/0007-landforge-metrics-surface.md) is substantial and
covers most of the §16 list: regional yield and growth models, harvest
readiness, change detection, confidence scoring, predicted-versus-actual
calibration. All work on derived features. **What is foreclosed is narrow:
tract-level inventory or valuation, re-identifiable to a parcel or landowner,
sold to a party who may transact against that landowner.**

**Decide:** confirm that `0006` still holds and scope §16 to derived products,
or supersede `0006` with a new record that argues the other way. Do not leave
both documents in the repository asserting different things.

---

## 2. Hard contradictions

### 2.1 The vision statements are bounded at cruise-and-score

`PRD.md:781`, `PRD.md:10`, `CONTEXT.md:5`, `CONTEXT.md:745` all frame
TimberForge as timber cruising, intelligence and valuation. No inventory
management, no persistent forest asset, no mobile GIS, no enterprise layer.

**Careful reading matters here.** `PRD.md:58` ("Replace every feature in Forest
Metrix, TCruise, or FScruiser") and `CONTEXT.md:519` ("Do **not** try to rebuild
Forest Metrix feature-for-feature") are scoped to **MVP** and remain correct.
Only the unbounded vision sentences conflict. Fixed by pointing them at
[`VISION.md`](VISION.md), not by deleting the guardrails.

### 2.2 The workflow omits INVENTORY and LEARN

`PRD.md:8` and `CONTEXT.md:9`: **Assess → Cruise → Value → Score**.
`CONTEXT.md:400` is closest: Property → Assess → Design → Cruise → QA → Value →
Report → Score.

New: PROPERTY → ASSESS → PLAN → CRUISE → QA → **INVENTORY** → VALUE → REPORT →
**LEARN**.

Load-bearing: the 8-step journey (`PRD.md:119–262`), the functional requirements
ordering (`PRD.md:266–442`) and CONTEXT's five workflow phases
(`CONTEXT.md:95–254`) all mirror the old chain.

### 2.3 The implemented schema contradicts TimberForge's own documented data model

**This is the most important finding in the audit, and neither the handoff nor
the product documents are aware of it.**

The *documents* already describe a persistent-asset hierarchy —
`PRD.md:500–516` and `CONTEXT.md:440–453` both run Organization → Property →
**Stand** → Cruise → Stratum → Plot → Tree. So the new direction's "the cruise
should not be the fundamental object" is **already what the PRD says**.

The *schema* does the opposite. In
[`0001_timberforge_schema.sql`](../../supabase/migrations/0001_timberforge_schema.sql):

```sql
create table timberforge.stand (
  id        uuid primary key,
  cruise_id uuid not null references timberforge.cruise (id) on delete cascade,
  ...
```

A stand belongs to exactly one cruise and **is deleted with it**. Cruising the
same tract next year creates a second, unrelated stand row. There is no path
from a stand to its own history because the stand does not outlive the
engagement that created it. Row-level security compounds it: every read policy
in [`0005_rls.sql`](../../supabase/migrations/0005_rls.sql) resolves through
`can_read_cruise(cruise_id)`, so *reachability itself* is defined by cruise
membership.

So the contradiction is not doc-versus-strategy. It is **doc-versus-code**, and
the new direction makes it load-bearing.

Two further gaps, stated precisely so nobody rewrites more than necessary:

- there is **no Inventory entity** between Stand and Cruise in either model
- there is **no temporal dimension** anywhere — no stand-state-over-time, no
  treatment, thinning, harvest, regeneration, growth or disturbance record
  (searched: zero occurrences in either document)

Recorded as [`0008`](../decisions/0008-persistent-forest-assets.md). **The cost
of fixing this is near zero today and rises steeply the moment migrations run
against a live database.** Nothing is deployed yet.

### 2.4 Secondary segments are marked "explicitly not now"

`PRD.md:86–101` heads a list of procurement foresters, timber buyers, TIMOs and
agencies with "**Secondary / Future — explicitly not now**", and closes:

> Building for more than one at a time is the most likely way to build for none.

New direction §20 broadens the discovery cohort to include several of them.

**These are compatible, and the fix is wording, not deletion.** The PRD sentence
is about who you *build for*; the new direction is about who you *interview*.
Distinguish build-target from research-target. `PRD.md:98–101` remains correct
and is a guardrail for "narrow MVP" — keep it.

### 2.5 The beta gate degrades under a broadened cohort

`PRD.md:569–583` sets the stop/go condition: 15–20 interviews with consulting
foresters in VA/NC, and **at least three naming a real tract and a date.**

Academics and procurement foresters **structurally cannot name a tract they will
let you cruise.** Spreading ~20 interviews across four segments is ~5 each,
below the point where `PRD.md:577`'s convergence test can be judged at all.

**Resolution:** the gate stays scoped to the consulting sub-cohort — 15–20 of
those, three tracts — and the other segments are *additional* conversations
serving a different question (enterprise/ArcGIS reality, buyer-side demand), not
substitutes counted against the same total.

The documents also disagree with each other on cohort size: `PRD.md:569` says
15–20, `PRD.md:734` and `CONTEXT.md:595` say 10–20.

### 2.6 One stale word on LandForge

`PRD.md:12` — "TimberForge will operate as a standalone product **initially**"
implies eventual merger. The rest is already right: `CONTEXT.md:66` says
LandForge integration is not an MVP requirement, `PRD.md:62` lists it as a
non-goal, `CONTEXT.md:737` says keep them separate. One word, not a section.

### 2.7 `parcel_link.landforge_parcel_id` is `not null`

`0004_landforge_bridge.sql:61`. TimberForge cannot currently record a tract that
has no LandForge parcel — which contradicts "TimberForge must create standalone
value for professional forestry customers" (§17). A consulting forester with no
LandForge account has nowhere to put a property.

---

## 3. Where the new direction would grow the MVP

The instruction says keep the MVP narrow. These are the places the new direction
pushes against that, and they should be resolved explicitly rather than absorbed.

**3.1 §2 and §19 contradict each other.** Putting INVENTORY in the core
workflow while placing Inventory Management in Phase 3 is inconsistent. If the
workflow sentence is read as MVP scope, the MVP grows by an entire product
surface: inventory versioning, effective dating, reconciliation of a new cruise
against a prior one, and conflict handling against the offline sync model at
`PRD.md:529–545`.

**Resolution:** the nine-stage workflow is the **product architecture**, not the
MVP scope. MVP delivers PROPERTY → ASSESS → PLAN → CRUISE → QA → VALUE → REPORT
against a schema that *can* hold inventory, with a single-inventory stub.

**3.2 "No separate export step" is not free.** It requires the inventory entity,
an as-of state, and a defined supersede rule. Real growth if taken literally in
MVP. The architecture must support it; the MVP need not exercise it.

**3.3 "GIS interpreted into forestry information" is more than rendering.**
`PRD.md:302–307` lists Terrain/slope, Streams/wetlands, Access/roads as raw
must-haves. Producing "82% favorable operating terrain" needs a slope and
hydrology pipeline **and a chosen data stack** — still an open decision
(`PRD.md:719`, `CONTEXT.md:688`). Modest growth with an unresolved dependency.

**3.4 Interoperability (§14) is correctly "Later"** — `CONTEXT.md:548–556`
already places enterprise GIS and APIs there. Keep it there; it is Phase 5.

**3.5 Intelligence (§16) is a second business** with different buyers, contracts
and compliance. `PRD.md:99–101` already warns institutions "want contracts and
security review"; banks and insurers add regulatory diligence. See §1.1 above.

---

## 4. What a blind rewrite would destroy

Listed because the instruction is to update, not rewrite. Each is hard-won and
sourced, and none of it appears in the new direction.

**4.1 The TimberForge Score is absent from the new direction entirely.** It is
pervasive in the existing docs — `PRD.md:446–474` (eight dimensions, 0–100, "do
not present score as a substitute for professional judgment"), `PRD.md:420`,
`PRD.md:773`, `CONTEXT.md:287–318` with a worked example, `CONTEXT.md:318` ("the
score must never hide the underlying professional metrics") — and it has a
committed ADR behind it,
[`0003`](../decisions/0003-pre-and-post-cruise-scoring.md). **Decide
deliberately: keep, demote, or kill. Do not drop it by omission.**

**4.2 The "wedge, not a market" sizing.** `PRD.md:14–21` — the entire US
consulting segment supports roughly **$2M–$7.5M** of annual software spend
across all vendors, so this PRD "should not be read as a revenue plan." This is
the analytical justification for why a second business exists at all. Without
it, §16 reads as unfocused ambition rather than a reasoned consequence.

**4.3 The data-rights constraints.** `PRD.md:436–442`, `PRD.md:277–279`
(ground-truth flag default OFF, surfaced at first run), `PRD.md:280–282` (full
export on demand, including on termination). Note carefully: that export right
is **portability**, and is *not* the "export step" §10 wants to eliminate. Do
not delete one by conflating it with the other.

**4.4 VA/NC justified on market grounds with numbers.** `PRD.md:75–79` —
sawtimber over $30/ton in NC against $17–21 in TN/SC/AL; pulpwood $9–14/ton in
VA and eastern NC against under $4 in AR/LA/TN (TimberMart-South, Q4 2025).

**4.5 The market can be enumerated by name.** `PRD.md:81–84`. The entire
go-to-market in three sentences, now backed by counted directories.

**4.6 Canada/BC deliberately off the roadmap.** `PRD.md:108–115` — the incumbent
claims over 90% of the BC industry and **already ships its own field tablet**, so
entering as "the modern field layer feeding their compiler" means competing with
their handheld for that right. An all-in-one framing would reopen this by
accident.

**4.7 The beta go/no-go gate.** `PRD.md:571–583`, especially: if the Q2 hours
are dominated by field work and travel, "the bottleneck is physical, software
cannot fix it, and this PRD is aimed at the wrong part of the job." Nothing in
the new direction replaces this.

**4.8 The commoditisation finding that *justifies* the new §4.**
`CONTEXT.md:347–358` — mobile-first entrants with free core features mean "basic
field-cruise functionality is becoming commoditized," and `CONTEXT.md:386–392`
("should not position itself as a nicer timber tally app"). The new direction
asserts that cruising is not the differentiator; these lines are the evidence.

**4.9 Verified competitor pricing.** `CONTEXT.md:336–338` — Forest Metrix
$1,000/yr Pro, $1,500/yr Pro Plus. The only hard price anchor.

**4.10 Predicted and measured must be stored separately.** `CONTEXT.md:455–464`,
`PRD.md:518–525`. This is the schema-level mechanism that makes the ground-truth
loop work at all, and any inventory-update model **must not overwrite it** — see
[`0008`](../decisions/0008-persistent-forest-assets.md).

**4.11 The forestry-credibility foundation.** `CONTEXT.md:617–633` — named
sources and the discipline of separating accepted science from federal policy
from regional convention. Plus `CONTEXT.md:646`: "Do not sacrifice forestry
credibility for simplified UX" — the direct counterweight to §12's
simplification push.

**4.12 AI guardrails.** `PRD.md:679–689`, `CONTEXT.md:667–676` — the explicit
no-fabrication list and "all AI-generated analysis should be traceable to source
data."

**4.13 Offline failure is a critical product failure.** `PRD.md:529–545`.

**4.14 MVP methods already decided.**
[`0002`](../decisions/0002-mvp-cruise-methods.md) — variable-radius and
fixed-area only. A rewrite would orphan `0002`, `0003`, `0004`, `0006`, `0007`.

---

## 5. Naming collision to fix

`CONTEXT.md:97–254` labels the *workflow stages* "Phase 1–5". The new roadmap
labels *capability tranches* "Phase 1–6". Two different axes, same word.
Rename the workflow stages to **stages** and reserve "Phase" for the roadmap.

---

## 6. Gaps — net-new content, nothing to contradict

Searched: neither document mentions **ArcGIS, Esri, shapefile, MobileMap Cruise,
or InventoryManager** anywhere. §13's position (Pro needs no ArcGIS; Enterprise
integrates bidirectionally; ArcGIS remains the enterprise system of record) is
purely additive.

Also missing from `PRD.md:295–316` pre-cruise must-haves: **soils** (only at
`CONTEXT.md:481`), **mills and markets** (in the journey at `PRD.md:147–148` but
not in §6.3), and **historical imagery** (`CONTEXT.md:122` only).
