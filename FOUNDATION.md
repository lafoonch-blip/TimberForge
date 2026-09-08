# TimberForge — Foundation and Tech Stack

**Status:** foundation complete and running · **Date:** 2026-09-06 · **Engine:** `tf-calc-v0.1.0-vrp-fixed-formclass`

This document answers the question that opened the project: *what should TimberForge re-use from the GitHub, Supabase, and other developer tooling already running LandForge, and what should it build fresh?* It records the decisions, the reasoning behind each one, and — just as importantly — which parts are proven against a real system and which are still working assumptions waiting on evidence.

It is a companion to running code. Everything described here exists in this repository, typechecks, and is covered by 256 passing tests.

---

## 1. The shape of the answer

The instinct with a second product is to reach for one of two extremes: fork the first product and diverge, or start from nothing and share only a logo. Both are expensive in different ways. A fork inherits LandForge's assumptions about what a parcel is *for*, which is scoring, not cruising — and those assumptions will fight the field app within a month. A clean start pays twice for authentication, twice for parcel data, and creates two databases whose notion of "the same 80 acres" will drift the first time a boundary is corrected.

The line drawn here runs between **infrastructure**, which is reused wholesale, and **domain model**, which is built new. LandForge's Supabase project, its authentication, its parcel records and its versioning discipline all carry over. Its scoring engine, its organisation model and its user interface do not. The seam between them is a single package, `@timberforge/landforge-contract`, whose entire purpose is to make sure that when LandForge changes, exactly one file needs editing.

---

## 2. Reuse decisions, asset by asset

| LandForge asset | Verdict | Reasoning |
|---|---|---|
| **Supabase project** | Reuse — same project | One project means one auth system, one billing relationship, one set of connection strings, and — critically — the ability to join a cruise to a parcel in SQL rather than over HTTP. |
| **Postgres schema `public`** | Do not touch — new `timberforge` schema | TimberForge adds 13 tables. Putting them in `public` alongside LandForge's would make every future LandForge migration a merge hazard. A separate schema is namespace isolation at zero cost. |
| **Auth (`auth.users`)** | Reuse directly | A cruiser who already has a LandForge login should not need a second one. Every TimberForge table keys ownership off `auth.uid()`. |
| **Parcel records** | Reuse by foreign key, never copy | Copying parcel geometry would mean paying twice for the same acreage/boundary API calls and maintaining two copies that drift. `timberforge.parcel_link` holds a nullable FK to LandForge's parcel table. |
| **RLS patterns** | Rebuild, informed by LandForge | The policies are new because the sharing model is new — a cruise has a crew, a parcel has an owner. But the technique carried over. |
| **Version-stamping discipline** | Reuse the *idea*, new stamps | LandForge stamps `lfs-v3`, `hbu-v1`, `v18-valuation-coherence`. TimberForge stamps every `CruiseResult` with engine, log rule, region profile and volume method — for a stronger reason, since a cruise is a professional work product a client may rely on in a transaction. |
| **Scoring engine / HBU logic** | Do not reuse | Different question entirely. LandForge asks "what is this land worth and for what use"; TimberForge asks "what is standing on it". |
| **Organisation / team model** | Do not reuse | Cruise crews are formed per-job and dissolve. Modelling them as LandForge organisations would force a heavyweight structure onto a two-person afternoon. |
| **Front-end and UI** | Do not reuse | LandForge is a desktop analysis tool. TimberForge is a gloved thumb on a phone in the rain, offline. Nothing about the interaction model transfers. |
| **GitHub repo** | New repo, monorepo layout | A shared repo would couple release cadences. The shared surface is a published contract, not a shared checkout. |

### The parcel bridge, and why it refuses to guess

Migration `0004_landforge_bridge.sql` is the only file in the project with an opinion about LandForge. It creates nothing in `public`, adds no triggers to LandForge tables, and — the part worth knowing about — it will not bind a foreign key to a table it cannot positively identify. If the configured parcel table is missing, it prints the candidates it found and skips the constraint rather than attaching to something that merely looks plausible. A wrong FK to a similarly-named table would join cruises to the wrong parcels, and every downstream number would be confidently, quietly incorrect. Skipping is recoverable; a silent mis-join is not.

**Operator note, easy to miss:** Supabase's API only serves schemas on its exposed list, and `timberforge` is not on it by default. Until it is added under *Settings → API → Exposed schemas*, every table here is reachable by SQL and invisible to the client library — which presents as inexplicably empty results rather than as an error.

---

## 3. The stack, decision by decision

### PWA rather than native

A cruiser cannot be asked to visit an app store, and a two-platform native build doubles the cost of every feature before a single beta user exists. A PWA installs to the home screen, updates without review, and runs one codebase. The trade is no background location and no Bluetooth calliper integration — both of which matter eventually, neither of which is MVP. Should a calliper integration become the deciding feature, the calculation engine and data layer are already platform-agnostic and would survive the move.

### React + TypeScript + Vite

Unremarkable, and deliberately so. The interesting engineering in this product is in the forestry mathematics and the offline data model, not in the rendering. Vite's dev server is fast enough that the feedback loop stays tight, and its production build of the whole field app is **285 kB, 93 kB gzipped** — small enough to load over a single bar of signal.

### Dexie 4 over raw IndexedDB

Raw IndexedDB is a callback-era API that makes transactions awkward and compound indexes verbose. Dexie gives a typed schema, real `async`/`await` transactions, and `useLiveQuery`, which is what lets the "queued to sync" count in the header update itself without a single manual refresh. The tests run the identical code against `fake-indexeddb`, so the data layer is tested in Node with no browser.

### An outbox (intent log), not diff-based sync

Every local write goes into a `outbox` table **in the same Dexie transaction as the data itself**. There is no window in which a row exists on the device but is not queued for sync. Entries carry whole rows rather than patches, which makes replay idempotent: sending the same entry twice is harmless, and that matters enormously when the failure mode is a truck driving out of signal mid-request.

The drain sends oldest-first and **stops at the first failure** rather than skipping ahead. This is the entire reason parents arrive before children — a tree cannot be inserted before its plot. Attempts are counted; after five, an entry is abandoned rather than blocking the queue forever. All of this is tested, including the poison-entry case and resume-after-recovery.

Diff-based sync was rejected because it requires a shared base state to diff against, which an offline device may not have seen for days.

### One calculation engine, three runtimes

`@timberforge/forestry-core` has **zero runtime dependencies** and contains only pure functions — no network, no clock, no database. The constraint is not aesthetic. The same code must produce byte-identical numbers in the browser (offline, on a phone), in a Supabase Edge Function (when a cruise is recompiled server-side), and in a test (when a number is proven against a published forestry table). Anything that touches I/O lives elsewhere.

Log rules are pluggable by design — Doyle, Scribner Decimal C and International ¼-inch ship, `registerLogRule` and `makeTableRule` accept more — because which rule is correct is a matter of local custom and sometimes of contract, not of arithmetic. Region profiles (`us_south`, `pacific_northwest`, `lake_states_northeast`) are configuration rows, not branches in code, which is what makes "multi-region from the start" a real claim rather than an aspiration.

Two cruise methodologies are supported: **variable-radius/point sampling** and **fixed-area plots**. 100% tally and 3P are deliberately out of scope until beta cruisers ask for them.

### PGlite for migration testing

The migrations run against a real PostgreSQL 18 compiled to WebAssembly, in-process, in the test suite. Not a mock, not a linter — an actual database that enforces actual constraints and actual row-level security. This is the single highest-leverage decision in the project, and section 5 explains why.

### No router yet

Navigation is a `useState<View>`. Four screens, no deep-linking requirement, no back-button semantics worth arguing about yet. Adding a router later is an afternoon; carrying one now is a dependency and a bundle cost for nothing. The choice is documented in `App.tsx` so it reads as a decision rather than an oversight.

### npm workspaces + TypeScript project references

Test and build configs alias workspace packages to **source, not `dist`**, so tests can never pass against a stale build. A green test on yesterday's compiled output is worse than a red one.

---

## 4. Repository shape

```
packages/forestry-core/        the calculation engine — pure, dependency-free
packages/landforge-contract/   the LandForge seam, four layers deep
apps/field/                    the offline-first PWA
supabase/migrations/           five additive SQL migrations
supabase/migrations.test.ts    those migrations, run against real Postgres
scripts/                       region-seed generator with a drift guard
```

The contract package is layered from strongest guarantee to weakest: `assumptions.ts` (mirrored constants plus a sentinel-collision guard), `confidence.ts` (a replica of LandForge's §7.4 provenance ladder), `projection.ts` (cruise → a narrow, provenance-carrying payload), and `adapter.ts` — the seam, the one file that knows LandForge's actual field names.

Data provenance is tracked end to end on a ladder: *measured* beats *computed* beats *estimated* beats *predicted* beats *defaulted*. A number that came off a d-tape and a number that came off a default are never allowed to look alike downstream.

---

## 5. Two findings that justify the testing approach

Running the migrations against a real Postgres rather than reviewing them by eye caught two things that would otherwise have reached a live database.

**A privilege escalation in the `cruise_update` policy.** The `WITH CHECK` clause, as first written, let an *editor* set `owner_id` to themselves. Having done so they became the owner, could rewrite the membership list, and could then delete the cruise — taking the crew's field work with it. Found by a test that simply asked whether an editor could do something an editor should not.

**Postgres applies the SELECT policy as a WITH CHECK on UPDATE.** When a table has an UPDATE policy, Postgres also tests the *new* row against the SELECT policy. The rule is sound — you may not update a row into a state you could no longer read — but the consequence here was that a legitimate owner running `update cruise set owner_id = <somebody else>` was rejected, because the instant `owner_id` changed, the read policy stopped matching them. The error names the `WITH CHECK`, so it reads like a bug in the update policy; it is not, and eight rounds of debugging were needed to find that out. The fix is a `SECURITY DEFINER` function, `transfer_cruise`, which validates ownership explicitly, keeps the outgoing owner on as an editor, and performs the update. The bare-UPDATE rejection is now pinned by its own test, because it is exactly the kind of behaviour someone would later "fix" by loosening the read policy.

Neither of these is the sort of thing code review reliably catches. Both were free to fix at this stage.

---

## 6. What is proven, and what is still assumed

Proven: the calculation engine against published forestry tables; the migrations against real Postgres including RLS; the offline data layer including outbox ordering, retry accounting and replay; and the app itself, through a rendered walkthrough test that creates a cruise, adds a stand, takes a plot, tallies two trees, compiles, and asserts the resulting **20.0 ft²/acre** basal area on screen. That last test exists because a broken import or a hook called conditionally typechecks cleanly and still leaves a cruiser looking at a white rectangle.

Three things are explicitly not yet proven, and each is marked in code rather than left to memory:

`ADAPTER_VERIFIED = false` in `adapter.ts`. The LandForge field names and the `TIER_CONFIDENCE` point values are working figures inferred from the scoring manual, not read from `LF_ASSUMPTIONS`. The adapter refuses to emit while this flag is false. Reading LandForge's `index.html` resolves it — that is a half-hour of work once the file is available, and the file lists the exact six steps.

**The Supabase transport is an interface, not an implementation.** `drainOutbox` takes a `SyncTransport`; a memory transport exists for tests. The real one needs a project URL and an anon key, which do not exist yet. The queue mechanics are already tested against the memory transport, so wiring the real one is a small, well-defined job.

**`timberforge` is not on the PostgREST exposed-schemas list** until someone adds it in the dashboard.

It is also worth being precise about what the migration harness does *not* prove, since "tested against real Postgres" invites more confidence than it has earned. `auth.uid()` there reads a session variable, where Supabase reads a JWT claim — so policy *logic* is tested faithfully and JWT handling is not. PGlite is single-connection, so nothing exercises concurrency, locking, or two cruisers syncing at once. The harness proves the migrations are valid and the constraints and policies behave as intended; it does not prove the deployment works.

---

## 7. Running it

```bash
npm install
npm run typecheck     # tsc -b across all projects
npm test              # 256 tests, including real-Postgres migrations
npm run dev           # the field app
npm run build         # everything
```

The migration tests boot a fresh WebAssembly Postgres per test group, which is why timeouts are set to 60 seconds. They need no Docker and no running database.

---

## 8. What comes next

The immediate sequence is: read LandForge's `index.html` and flip `ADAPTER_VERIFIED`; create the Supabase project credentials and implement the real transport; then put the app in front of a cruiser for an afternoon. The third of those will teach more than the first two combined, and the foundation is deliberately built so that what it teaches can be acted on — regions are rows, log rules are registrable, and the calculation engine can be recompiled server-side over historical data when the math improves.
