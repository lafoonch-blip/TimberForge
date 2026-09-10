# Paste-ready handoff for ChatGPT (or any other assistant)

Copy everything below the line into a new ChatGPT conversation. It assumes the
GitHub connector has been given access to `lafoonch-blip/TimberForge` — see
`AGENTS.md` and the setup note at the bottom of this file.

---

## TimberForge — where the project lives and how to work on it

All TimberForge documentation and code live in one private GitHub repository:

**`lafoonch-blip/TimberForge`** (branch `main`)

This is the only source of truth. Not our chat history, not any document I've
pasted before. If something isn't in that repo, it isn't decided. When I ask you
about TimberForge, read the repo rather than relying on what you remember from
earlier conversations — several facts have changed, and a few earlier
assumptions turned out to be wrong.

**Start by reading `AGENTS.md` in the repository root.** It's written for you: it
lists where everything is, five rules that must not be broken, the commands that
verify your work, and the things that need a human decision rather than an
assistant's judgment. Then read `FOUNDATION.md`, then `docs/README.md`.

### What TimberForge is

A professional timber-cruising platform for independent consulting foresters.
It's pre-launch — nothing is deployed. The documentation is currently the main
artifact, so an error introduced into a document becomes an error in the product
later.

There's a second product, **LandForge** (land-investment intelligence, already
live, same owner). The two share a Supabase project and parcel records but are
deliberately separate products with separate repositories.

### The five rules, in short

1. **Never edit `docs/shared/`.** Those files mirror facts owned by LandForge
   and are hash-verified. If one is wrong, tell me — don't fix it.
2. **Never delete a decision record.** `docs/decisions/` is append-only.
   Supersede, don't overwrite. Numbers are permanent.
3. **Never expand the MVP.** `docs/product/VISION.md` is broad on purpose;
   `docs/product/PRD.md` is narrow on purpose. When they seem to conflict about
   scope, the PRD wins.
4. **Keep provenance tags intact.** Numbers are tagged `verified`, `modeled`, or
   `unknown`. Don't promote a tag without new evidence, and cite sources.
5. **Don't invent forestry.** If you don't know a log rule or a volume equation,
   say so. A plausible wrong constant is worse than an admitted gap.

### How I'd like you to work

- **Verify against the code, not memory.** Constants are in
  `packages/forestry-core/src/constants.ts`; the schema is in
  `supabase/migrations/`. Read the file before asserting a value.
- **Flag contradictions rather than smoothing them over.** Some documents
  disagree with each other on purpose, and each disagreement is tracked. If you
  find a new one, tell me instead of picking a side.
- **Update, don't rewrite.** These documents contain hard-won specifics —
  verified market numbers, named constraints, deliberate scoping decisions. A
  clean rewrite loses them silently, which is the most expensive kind of loss.
- **Tell me what you changed and why.** If you can commit, write commit messages
  that explain the reasoning; the diff already shows the mechanics.

### Where to look for what

- `FOUNDATION.md` — architecture; what's reused from LandForge, what's built fresh
- `docs/product/PRD.md` — what ships
- `docs/product/VISION.md` — the long-term destination
- `docs/product/STRATEGY_RECONCILIATION.md` — open conflicts awaiting my decision
- `docs/product/CONTEXT.md` — background, workflow, market takeaways, data model
- `docs/decisions/` — the eight architecture decision records
- `docs/market/` — business case, interview kit, forester outreach list
- `docs/integration/OPEN_QUESTIONS.md` — unanswered questions, meant to shrink
- `docs/domain/GLOSSARY.md` — forestry terms tied to the code implementing them

### Current state, as of 2026-09-09

Pre-launch. No deployment, no Vercel project, and the database migrations have
never been run against a live Supabase instance. The current focus is customer
discovery — interviewing consulting foresters in Virginia and North Carolina —
plus mock design. **No further application building until there's a mock and
feature feedback.** Please don't propose implementation work that assumes
otherwise.

Two things I'd especially like you to be aware of rather than "fix":

- The calc engine defaults to 95% confidence while LandForge uses 90%. This is
  deliberate and documented in decision `0003`.
- `timberforge.stand` is currently a child of `cruise`, which contradicts the
  persistent hierarchy the product documents describe. Known, recorded in
  decision `0008`, fix pending.

---

## Setup note (for me, not for ChatGPT)

The repository is **private**, so ChatGPT needs the GitHub connector granted
access to it specifically. The "ChatGPT Codex Connector" GitHub App is already
installed on the `lafoonch-blip` account — check
[github.com/settings/installations](https://github.com/settings/installations),
open it, and under **Repository access** make sure TimberForge is included
(either "All repositories" or explicitly selected).

Without that, ChatGPT will report the repository as not found — a 404 rather
than a permission error, because GitHub hides private repos it can't see. That
is exactly the failure the Claude connector hit before its installation scope
was widened.
