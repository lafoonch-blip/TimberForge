# docs/shared — mirrored from LandForge

**Nothing in this directory is owned by TimberForge. Do not edit these files to change behaviour.**

Parcel data and the scoring constants are LandForge's concepts. LandForge had them first, LandForge's users depend on them, and LandForge is where they change. TimberForge keeps a **read-only mirror** here so that its code can be written against something concrete instead of against a guess.

That means there is exactly one correct way to change anything in this directory: change it in LandForge, then re-capture the mirror. Editing a file here to make a TimberForge test pass produces a repository that agrees with itself and disagrees with production — which is the specific failure this structure exists to prevent.

## Why mirror at all, rather than import?

The two products share a Supabase project but not a codebase or a release cycle. A build-time import would couple their deploys; a runtime fetch would make TimberForge's offline field app depend on LandForge being up. A checked-in mirror with a provenance record couples nothing, and makes staleness visible instead of silent.

## What the drift check does and does not do

`npm run check:mirror` hashes every file here and compares against `mirror.manifest.json`.

It **will** catch a TimberForge-side edit — someone "fixing" a constant locally to make something pass. It **will** flag a mirror that has gone stale past `maxAgeDays`.

It **cannot** tell you that LandForge changed. Nothing in this repository can, because LandForge's source is not reachable from here. Reconciliation is a deliberate act: someone re-captures from LandForge and updates the manifest. The age check exists precisely because that act is easy to forget.

So: a green drift check means "this mirror is intact and recent", not "this mirror is correct".

## How to refresh a mirrored file

1. Get the current value from LandForge — from its source if you have the repo, otherwise by reading the running application.
2. Edit the file here to match, and update its `capturedAt`, `method`, and `confidence` in `mirror.manifest.json`.
3. Run `npm run check:mirror -- --update` to rewrite the hashes, then read the diff before committing it.
4. If the change alters a number TimberForge computes with, bump `CALC_ENGINE_VERSION` in `packages/forestry-core/src/version.ts`. A cruise compiled before and after must not silently differ.

## Confidence levels used in the manifest

- `confirmed` — read directly from the running system, or verified by reproducing its output exactly.
- `derived` — reverse-engineered from observed behaviour and then checked against further live cases.
- `inferred` — a reasonable reading that has **not** been proven. Treat as provisional.
- `pending` — known to exist, not yet captured. The file is a placeholder.

## Capture hygiene

Two rules held during the 2026-09-07 capture, worth holding again.

**Read; do not invoke.** Capture was done against a live, authenticated session
on a production application holding real customer data. Runtime *values* and
function *arities* were read; no page function was called. This is why
`applyParsedFields()`'s expected object keys are recorded as unknown rather than
guessed — see
[`../integration/OPEN_QUESTIONS.md`](../integration/OPEN_QUESTIONS.md). Reading
is observation; calling is a side effect on someone's real data.

**Credentials do not get mirrored.** The beta page holds a Supabase project URL
and anon key in `SUPA_URL` / `SUPA_ANON`. These were deliberately **not** recorded
here. The anon key is public by design and this is not a leak — but a key in a
repository file outlives the reason it was put there, and a mirror of a live
system is exactly the kind of file that quietly accumulates them.
