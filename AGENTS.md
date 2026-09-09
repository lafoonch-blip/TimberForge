# Instructions for AI assistants working on TimberForge

Read this before editing anything. It applies to ChatGPT/Codex, Claude, and any
other assistant with access to this repository.

TimberForge is a professional timber-cruising platform for consulting foresters.
It is pre-launch: nothing is deployed, and the documentation is currently the
main artifact. Treat it accordingly — a wrong number in a document here becomes
a wrong number in the product later.

---

## Where things are

Everything canonical lives in **this repository**, `docs/`. There is no other
source of truth — not a chat history, not a Google Doc, not a project sidebar.
If a fact isn't here, it isn't decided.

| Path | What it is |
|---|---|
| [`FOUNDATION.md`](FOUNDATION.md) | Architecture: what TimberForge reuses from LandForge and what it builds fresh. **Read first.** |
| [`docs/README.md`](docs/README.md) | Index and the maintenance rules in full |
| [`docs/product/PRD.md`](docs/product/PRD.md) | **What ships.** Wins any scope disagreement. |
| [`docs/product/VISION.md`](docs/product/VISION.md) | Long-term destination. **May not be used to expand MVP scope.** |
| [`docs/product/STRATEGY_RECONCILIATION.md`](docs/product/STRATEGY_RECONCILIATION.md) | Open conflicts between the vision and existing decisions |
| [`docs/product/CONTEXT.md`](docs/product/CONTEXT.md) | Background, workflow stages, competitive landscape, data model |
| [`docs/product/BRANDING.md`](docs/product/BRANDING.md) | Brand and voice |
| [`docs/decisions/`](docs/decisions/) | Architecture decision records, 0001–0008 |
| [`docs/domain/GLOSSARY.md`](docs/domain/GLOSSARY.md) | Forestry terms, each tied to the code that implements it |
| [`docs/market/`](docs/market/) | Business case, interview kit, outreach list and scripts |
| [`docs/integration/`](docs/integration/) | LandForge contract and open questions |
| [`docs/shared/`](docs/shared/) | **Mirrored from LandForge. Do not edit.** See below. |
| `packages/`, `apps/`, `supabase/` | Code and migrations |

---

## The five rules

**1. Never edit `docs/shared/`.** These files mirror facts owned by LandForge, a
separate live product. They are hash-verified by `npm run check:mirror`, which
will fail if you change one. Changing a number here to make something agree is
the specific failure this structure exists to prevent — it produces a repository
that agrees with itself and disagrees with production. If a mirrored fact is
wrong, say so; do not fix it. Only a re-capture from a running LandForge can
change these files.

**2. Never delete a decision record.** `docs/decisions/` is append-only in
spirit. If a decision changes, add a new record and mark the old one
`Superseded by 000N`. Numbers are permanent and never reused. Every new record
needs a "what would make us revisit" section — a decision without a stated
reversal condition is a preference in disguise.

**3. Do not expand the MVP.** `VISION.md` is broad on purpose and `PRD.md` is
narrow on purpose. When they seem to disagree about scope, **the PRD wins.** The
PRD's non-goals list is load-bearing, not decorative. If the vision seems to
require something the PRD excludes, that is a conflict to raise, not resolve.

**4. Keep provenance tags intact.** Numbers in `docs/market/` are tagged
`verified` (checked against a named source, with the source cited), `modeled`
(constructed, only as good as its assumptions), or `unknown` (nobody has it).
Never promote a tag without new evidence, never drop one, and never state a
modeled number as fact. Cite a source URL for anything new.

**5. Don't invent forestry.** This domain has real standards and real
consequences — a cruise is a professional work product a client may rely on in a
transaction. If you don't know a log rule, a volume equation, or a regional
convention, say so. A plausible-sounding wrong constant is worse than an
acknowledged gap, because nobody will catch it. Cited sources live in
`CONTEXT.md` §16 (Forestry Reference Material) and `GLOSSARY.md`.

---

## Before you claim something is true

Check it against the code, not against memory or a previous conversation.
Constants live in `packages/forestry-core/src/constants.ts`; the schema is in
`supabase/migrations/`. Several documents have already had errors introduced by
recalling a value rather than reading it.

Two known live discrepancies, so you don't "fix" them by accident:

- `packages/forestry-core` defaults to **95%** confidence while LandForge uses
  **90%**. This divergence is deliberate and documented in
  [`0003`](docs/decisions/0003-pre-and-post-cruise-scoring.md).
- `timberforge.stand` is a child of `cruise`, which contradicts the persistent
  hierarchy the product documents describe. Known, recorded in
  [`0008`](docs/decisions/0008-persistent-forest-assets.md), fix pending.

---

## Verifying your work

```
npx tsc -b              # must exit 0
npm test                # must pass
npm run check:mirror    # must print "Mirror intact."
```

If `check:mirror` fails and you did not knowingly re-capture from LandForge, the
fix is `git checkout` on the file — **not** `--update`.

---

## Conventions

- Commit messages explain **why**, not what. The diff shows what.
- `docs/integration/OPEN_QUESTIONS.md` exists in order to become empty. Delete a
  question in the same commit that answers it. Never resolve one by choosing a
  plausible answer — that is precisely what the file guards against.
- Prose over bullet lists in the documents themselves, and no em-dash-heavy
  filler. Match the voice already there.
- Flag contradictions rather than silently reconciling them. Several documents
  disagree with each other right now, deliberately, and each disagreement is
  tracked somewhere.

## What needs a human

Do not decide these alone: anything changing `docs/shared/`, superseding a
decision record, expanding MVP scope, running a migration against a live
database, or resolving the open conflict in
[`STRATEGY_RECONCILIATION.md` §1.1](docs/product/STRATEGY_RECONCILIATION.md)
about which Intelligence customers are permissible.
